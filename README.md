# Fichas & Pedidos

App multi-merchant com dois módulos independentes:

- **Fichas**: saldo pré-carregado para consumo no balcão (churrasquinho/cerveja). Débito feito pelo staff via código temporário.
- **Pedidos**: encomendas (ex: picanha) pagas antecipadamente via Pix/cartão. Pedido só é liberado após confirmação de pagamento; retirada validada por código temporário.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth)
- Asaas (Pix/cartão) — integração de pagamento

## Setup local

```bash
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

## Banco de dados

O schema vive em `supabase/migrations/`. Para aplicar num projeto Supabase real:

```bash
npx supabase link --project-ref <seu-project-ref>
npx supabase db push
```

Todas as tabelas têm RLS habilitado. As políticas por papel (cliente/staff/admin)
foram adicionadas na etapa 3, junto com o trigger que aplica crédito/débito
em `wallet_transactions` ao saldo da wallet.

## Autenticação e papéis

- **customer**: se autocadastra em `/signup`. A linha em `customers` é criada
  automaticamente no cadastro.
- **staff**: só é criado por um admin, em `/admin/staff/new` (cria o usuário
  de auth + a linha em `staff`, vinculada a um merchant).
- **admin**: não tem self-signup. O primeiro admin precisa ser promovido
  manualmente rodando isso no SQL Editor do Supabase (com o usuário já
  cadastrado via `/signup` ou pelo dashboard de Auth):

  ```sql
  update auth.users
  set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  where email = 'seu-email@exemplo.com';
  ```

  Depois de promovido, esse usuário passa a acessar `/admin` e pode cadastrar
  merchants e staff pela UI.

As políticas de RLS foram validadas rodando os cenários reais (cliente só vê
sua própria wallet, staff só vê dados do seu merchant, débito que deixaria o
saldo negativo é bloqueado, etc.) contra um Postgres local antes de subir a
migração — não é só sintaxe, o isolamento entre papéis foi de fato testado.

## Módulo Fichas

- Cliente gera um código de 6 dígitos válido por 2 minutos (`wallet_debit_codes`)
  e mostra pro staff no balcão.
- Staff debita chamando a função `redeem_wallet_debit_code(code, valor)`: o
  código é reivindicado de forma atômica (evita duas caixas debitando o
  mesmo código ao mesmo tempo), só funciona pro merchant do staff que chama,
  e se o débito deixaria o saldo negativo a operação inteira é revertida —
  o código continua válido pra tentar de novo com um valor menor.
- Staff credita saldo manualmente chamando `credit_wallet(login, valor)`:
  cria a wallet do cliente nesse merchant se ainda não existir, sempre
  escopado ao merchant do staff que chama (não dá pra creditar fora do
  próprio estabelecimento). Continua sem Pix de propósito: crédito de
  fichas é sempre manual no balcão, só o módulo Pedidos usa a integração
  de pagamento (etapa 5).
- As duas funções, o trigger de saldo e a política de único-código-ativo
  foram validados com os mesmos testes reais contra Postgres local:
  isolamento entre merchants, código expirado, código já usado, débito
  maior que o saldo (com o rollback correto do código), staff tentando
  agir fora do próprio merchant.

## Integração de pagamento (Asaas/Pix)

- `src/lib/asaas/client.ts` (`server-only`) é a única forma de chamar a API
  do Asaas no app; a lógica de fato mora em `http.ts`, sem o selo
  `server-only`, justamente pra poder ser testada fora do Next.js.
- Garantia central: **ninguém além do próprio webhook consegue marcar um
  pedido como pago**. Um trigger (`orders_before_insert_force_pending`)
  força todo pedido novo a nascer com `payment_status = 'pendente'` e
  `status = 'aguardando_pagamento'`, não importa o que o cliente mande no
  INSERT. Outro trigger (`orders_before_update_guard_payment`) ignora
  qualquer tentativa de mudar `payment_status`/`paid_at`/`asaas_payment_id`
  que não venha do `service_role` — ou seja, nem staff nem cliente
  conseguem "confirmar" pagamento na mão, só o webhook do Asaas.
- `src/app/api/webhooks/asaas/route.ts` recebe os eventos, confere o header
  `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`, e usa o client admin
  (service role) pra achar o pedido pelo `asaas_payment_id` e aplicar a
  mudança — decidida por uma função pura (`decideOrderUpdate`) que também
  cuida de idempotência (webhook duplicado não faz nada) e não reabre um
  pedido cancelado por causa de uma confirmação atrasada.
- `src/lib/pagamentos/criar-cobranca-pedido.ts` é o helper que o módulo
  Pedidos (etapa 6) vai chamar: cria/reaproveita o cliente no Asaas, gera
  a cobrança Pix vinculada ao pedido (`externalReference`) e devolve o QR
  code pra UI mostrar. Cliente precisa ter `cpf_cnpj` preenchido — o Asaas
  exige isso pra criar a cobrança.
- Testado sem precisar de credenciais reais: os triggers de guarda foram
  validados contra Postgres local simulando o papel `service_role` de
  verdade (com `BYPASSRLS`, como o Supabase configura); a lógica pura do
  webhook (`mapAsaasEventToOutcome`/`decideOrderUpdate`) e a montagem das
  requisições do client Asaas foram testadas com `fetch` mockado seguindo
  o formato real da API. O que falta testar só dá com uma conta Asaas de
  verdade: o handshake HTTP completo com a API e o disparo do webhook por
  um pagamento Pix de fato.
- Durante o teste de fumaça do endpoint achei e corrigi um bug real: o
  `proxy.ts` (middleware) rodava em cima de `/api/webhooks/*` tentando
  atualizar sessão de usuário — o que não existe numa chamada
  servidor-a-servidor do Asaas — e quebrava toda chamada ao webhook com
  500. O matcher agora exclui `api/webhooks`.

## Módulo Pedidos

- `/staff/catalogo`: staff cadastra itens do merchant (nome + preço).
- `/cliente/pedidos/novo`: cliente escolhe o estabelecimento, monta o
  pedido (quantidade por item) e informa CPF/CNPJ. O preço usado é sempre
  o que está no catálogo no momento do checkout — nunca o que vier do
  formulário — pra não dar pra adulterar valor pelo client.
- Ao confirmar, o pedido é criado (nasce `aguardando_pagamento` por causa
  do trigger da etapa 5) e a cobrança Pix é gerada na hora
  (`criarCobrancaPixParaPedido`). O cliente cai direto na página do
  pedido (`/cliente/pedidos/[id]`), que mostra o QR code e o
  copia-e-cola — buscados de novo no Asaas a cada carregamento da
  página, então continuam válidos mesmo se o cliente sair e voltar.
- Quando o webhook confirma o pagamento, o pedido vira `recebido` e ganha
  um código de retirada de 6 caracteres (`generatePickupCode`, alfabeto
  sem 0/O/1/I/L pra evitar confusão) — ao contrário do código de débito
  de fichas, esse não expira em 2 minutos: fica vinculado ao pedido até
  ser retirado ou cancelado, porque o cliente pode demorar pra chegar no
  balcão depois de pagar.
- `/staff/pedidos`: staff acompanha os pedidos do próprio merchant, avança
  o status (preparando → pronto, ou cancela) e confirma a retirada
  digitando o código — sem função especial no banco pra isso, porque
  diferente do débito de fichas não tem valor monetário em disputa: a
  política de RLS já escopa a UPDATE ao merchant do staff, então um
  código incorreto ou de outro merchant simplesmente não afeta nenhuma
  linha.
- A etapa 6 em si não precisou de migração nova — toda a garantia de
  segurança que ela usa (só o webhook confirma pagamento, staff só mexe
  no próprio merchant) já tinha sido validada nas etapas 3 e 5. Mas
  escrever essa UI foi o que expôs as lacunas corrigidas na revisão
  abaixo (`orders_staff_update` liberava UPDATE em colunas que a UI do
  staff nunca deveria tocar).

## Revisão de segurança (pós-etapa 6)

Antes de partir pro teste end-to-end, revisei o projeto inteiro de novo
— schema, políticas de RLS e o app — e achei lacunas reais que a UI do
Next.js nunca explora, mas que ficavam abertas pra qualquer sessão
autenticada de staff/cliente com acesso direto à API REST do Supabase
(fora do nosso app). Fechadas na migração
`20260921040000_hardening_guardas.sql`, cada uma validada contra
Postgres local (não só aplicada — testei que cada brecha realmente
fecha e que o caminho legítimo continua funcionando):

- **Crítico**: a política `wallets_staff_insert` (etapa 3) deixava staff
  inserir uma wallet com **qualquer saldo**, contornando por completo a
  função auditada `credit_wallet()` e o extrato de `wallet_transactions`
  — bastava chamar a API do Supabase direto. Removida; nada do app
  dependia dela, já que `credit_wallet()` é `SECURITY DEFINER` e nunca
  passou por essa policy.
- **Alto**: `customers.login` não tinha `unique`, mas `credit_wallet()`
  busca o cliente por login sem `STRICT` — dois clientes com o mesmo
  login podiam fazer o crédito cair silenciosamente no cliente errado.
  Adicionado `unique (login)`.
- **Médio**: `orders_staff_update` liberava UPDATE em qualquer coluna do
  pedido (não só `status`) pro merchant do staff — dava pra sobrescrever
  `total_reais`, `customer_id` ou o `pickup_code` de outro pedido via
  API direta. Novo trigger restringe esses campos ao `service_role`.
- **Médio**: um cliente conseguia sobrescrever o próprio
  `asaas_customer_id` via API direta (o app nunca expõe esse campo pra
  edição), o que podia atrelar cobranças futuras ao perfil Asaas errado.
  Guardado do mesmo jeito.
- **Baixo**: pedido podia nascer com `asaas_payment_id` escolhido pelo
  cliente (podia colidir com um pagamento real, ainda que IDs do Asaas
  sejam difíceis de adivinhar); e o código de débito de fichas podia
  nascer com validade escolhida pelo cliente em vez dos 2 minutos
  padrão. Ambos forçados agora, ignorando o que vier no INSERT.
- Também troquei a comparação do token do webhook por
  `crypto.timingSafeEqual` (a anterior comparava string por `!==`,
  vulnerável a timing attack em teoria) e corrigi um caminho de conta
  órfã no `/signup`: se a criação da linha em `customers` falhar (ex:
  login duplicado), o usuário de auth recém-criado agora é desfeito, em
  vez de ficar uma conta travada com e-mail já "usado" mas sem `customers`.

## Roadmap

1. ✅ Setup do projeto Next.js + Supabase
2. ✅ Schema completo do banco (merchants, staff, customers, wallets, wallet_transactions, order_items_catalog, orders, order_lines)
3. ✅ Autenticação: cliente, staff, admin (+ políticas de RLS)
4. ✅ Módulo Fichas: saldo, código temporário de débito, tela do staff (crédito manual de saldo, sem Pix)
5. ✅ Integração de pagamento real (Asaas/Pix)
6. ✅ Módulo Pedidos: catálogo, montagem de pedido, pagamento obrigatório, código de retirada, painel do staff
7. 🔄 Teste end-to-end dos dois módulos juntos — guia de setup (Supabase +
   Asaas sandbox) e roteiro de teste manual em [`TESTING.md`](./TESTING.md)
8. Multi-merchant real, PWA instalável
