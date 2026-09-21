# Guia de setup e teste (etapa 7)

Este guia tem duas partes: (1) configurar um Supabase e um Asaas sandbox
de verdade, do zero, e (2) o roteiro de teste manual dos dois módulos.

Tudo que foi construído até aqui (schema, RLS, funções, lógica de
pagamento) já foi validado automaticamente contra um Postgres local
durante o desenvolvimento — o que falta é justamente o que só dá pra
testar com infraestrutura real: Supabase Auth de verdade, e o
handshake HTTP completo com o Asaas.

## Parte 1 — Setup

### 1.1 Criar o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (grava a
   senha do banco que você escolher, vai precisar dela pra linkar o CLI).
2. Espere o projeto terminar de provisionar (leva um a dois minutos).

### 1.2 Aplicar as migrações

Com o projeto rodando localmente (`npm install` primeiro):

```bash
npx supabase login
npx supabase link --project-ref <seu-project-ref>
npx supabase db push
```

O `<project-ref>` está na URL do dashboard do projeto
(`https://supabase.com/dashboard/project/<project-ref>`) ou em
Settings → General. O `db push` vai aplicar as 5 migrações de
`supabase/migrations/` em ordem.

Se preferir não usar o CLI, dá pra colar o conteúdo de cada arquivo de
`supabase/migrations/` (em ordem, pelo nome) no SQL Editor do dashboard
e rodar um por um.

### 1.3 Pegar as credenciais e preencher o `.env.local`

Em Settings → API do projeto Supabase:

```bash
cp .env.example .env.local
```

Preencha:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave `anon` `public`
- `SUPABASE_SERVICE_ROLE_KEY` — chave `service_role` (**secreta**, nunca
  commitar nem expor no client)

### 1.4 Criar o primeiro admin

1. Rode `npm run dev` e cadastre uma conta normal em `/signup` (com o
   e-mail que você quer usar como admin da plataforma).
2. No SQL Editor do Supabase, rode:

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   where email = 'seu-email@exemplo.com';
   ```

3. Faça login de novo (o token antigo não tem a claim nova) — agora cai
   em `/admin`.

### 1.5 Criar uma conta Asaas sandbox

1. Crie uma conta em [sandbox.asaas.com](https://sandbox.asaas.com) —
   é um ambiente de testes separado da conta de produção, não precisa
   de dados reais de empresa pra começar.
2. Pegue a API key em algo como Configurações → Integrações → API
   (o caminho exato pode variar conforme a versão do painel deles).
3. No `.env.local`:

   ```bash
   ASAAS_API_KEY=<sua chave sandbox>
   ASAAS_ENV=sandbox
   ASAAS_WEBHOOK_TOKEN=<invente uma string aleatória, ex: openssl rand -hex 16>
   ```

### 1.6 Expor o servidor local pro Asaas conseguir chamar o webhook

O Asaas precisa alcançar `/api/webhooks/asaas` pela internet. Duas
opções:

**Opção A — túnel local (mais rápido pra testar agora):**

```bash
npx ngrok http 3000
```

Isso dá uma URL tipo `https://algo.ngrok-free.app`. O webhook fica em
`https://algo.ngrok-free.app/api/webhooks/asaas`.

**Opção B — deploy (mais estável, recomendado se for testar mais de
uma vez):** suba o projeto na Vercel (`vercel deploy`, ou conectando o
repo do GitHub direto no dashboard da Vercel) e preencha as mesmas
variáveis de ambiente por lá. A URL do webhook vira
`https://seu-projeto.vercel.app/api/webhooks/asaas`.

### 1.7 Configurar o webhook no Asaas

No painel do Asaas sandbox, em algo como Configurações → Integrações →
Webhooks:

1. URL: a que você pegou no passo anterior.
2. Eventos: pelo menos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` e
   `PAYMENT_REFUNDED` (o código também entende
   `PAYMENT_CHARGEBACK_REQUESTED`, mas isso é raro em teste).
3. Token de autenticação / token de acesso: cole o mesmo valor que você
   colocou em `ASAAS_WEBHOOK_TOKEN`. O Asaas manda esse valor de volta
   no header `asaas-access-token` em toda chamada, e é isso que o
   `route.ts` do webhook confere antes de processar.

## Parte 2 — Roteiro de teste

Convenção: abra o staff numa aba anônima/outro navegador enquanto
testa como cliente na aba normal, já que as sessões são por navegador.

### Módulo Fichas

1. Logado como **admin**, crie um merchant (`/admin/merchants/new`) —
   ex: "Bar Teste".
2. Ainda como admin, crie um staff (`/admin/staff/new`) vinculado a
   esse merchant — anote login, e-mail e senha.
3. Cadastre um cliente novo em `/signup` (conta separada do admin).
4. Logado como **staff**, vá em `/staff` e credite saldo pro cliente
   pelo login dele (ex: R$ 50).
5. Logado como **cliente**, veja em `/cliente` o saldo de R$ 50
   aparecendo pro Bar Teste.
6. Como cliente, clique em "Gerar código de débito" — aparece um código
   de 6 dígitos válido por 2 minutos.
7. Como **staff**, em `/staff`, debite usando esse código (ex: R$ 20).
   Confirme que o saldo do cliente caiu pra R$ 30.
8. Casos de erro que devem falhar (confirme a mensagem de erro, não
   deve travar a aplicação):
   - Gerar um código novo, esperar passar de 2 minutos, tentar debitar
     → "código inválido, expirado ou já utilizado".
   - Tentar debitar o mesmo código usado no passo 7 de novo → mesmo erro.
   - Gerar um código e tentar debitar um valor maior que o saldo atual
     → erro de saldo insuficiente; gere um valor menor em seguida com o
     **mesmo código** e confirme que ainda funciona (ele não foi
     invalidado pela tentativa que falhou).

### Módulo Pedidos

1. Como **staff**, em `/staff/catalogo`, cadastre um item (ex:
   "Picanha 1kg", R$ 80).
2. Como **cliente**, vá em `/cliente/pedidos/novo`, escolha o Bar
   Teste, marque quantidade 1 na Picanha, informe um CPF válido
   (qualquer CPF com dígito verificador correto deve passar no
   sandbox — se o Asaas rejeitar, o erro aparece na tela) e confirme.
3. Você deve cair em `/cliente/pedidos/[id]` vendo o QR code Pix e o
   código copia-e-cola.
4. No painel do Asaas sandbox, procure a cobrança criada (pelo valor ou
   pela referência externa, que é o ID do pedido) e confirme o
   pagamento manualmente — sandboxes de gateway de pagamento costumam
   ter uma opção de simular confirmação sem precisar pagar de verdade;
   se não encontrar, pagar o Pix de teste normalmente também funciona.
5. Espere alguns segundos e recarregue a página do pedido — ela deve
   trocar o QR code por "Pago! Mostre esse código pro staff", com um
   código de retirada de 6 caracteres.
6. Como **staff**, em `/staff/pedidos`, veja o pedido como "Recebido
   pela cozinha". Avance pra "Iniciar preparo" e depois "Marcar como
   pronto".
7. Ainda como staff, no formulário "Confirmar retirada", digite o
   código de retirada do passo 5 → pedido vira "Retirado".
8. Casos de erro que devem falhar:
   - Confirmar retirada com um código inventado → erro claro, não
     trava.
   - Se você tiver um segundo merchant/staff, confirme que o código de
     retirada de um pedido do Bar Teste não funciona pro staff de outro
     merchant.

### Se algo quebrar

Me manda a mensagem de erro (ou print) e em qual passo — como não
tenho acesso ao seu Supabase/Asaas nesta sessão, o diagnóstico depende
do que você conseguir me passar daqui.
