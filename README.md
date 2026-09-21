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
  próprio estabelecimento). Ainda sem Pix — isso entra na etapa 5.
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

## Roadmap

1. ✅ Setup do projeto Next.js + Supabase
2. ✅ Schema completo do banco (merchants, staff, customers, wallets, wallet_transactions, order_items_catalog, orders, order_lines)
3. ✅ Autenticação: cliente, staff, admin (+ políticas de RLS)
4. ✅ Módulo Fichas: saldo, código temporário de débito, tela do staff (crédito manual de saldo, sem Pix)
5. ✅ Integração de pagamento real (Asaas/Pix)
6. Módulo Pedidos: catálogo, montagem de pedido, pagamento obrigatório, código de retirada, painel do staff
7. Teste end-to-end dos dois módulos juntos
8. Multi-merchant real, PWA instalável
