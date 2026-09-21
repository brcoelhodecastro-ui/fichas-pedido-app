-- Schema inicial: módulo Fichas (saldo de balcão) + módulo Pedidos (encomendas).
-- Os dois módulos são independentes: fichas nunca pagam pedidos, e pedidos nunca
-- debitam saldo de fichas.

create extension if not exists pgcrypto;

-- =========================================================================
-- Base: merchants, staff, customers
-- =========================================================================

create table merchants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados_recebedor_asaas jsonb,
  taxa_plataforma numeric(5, 2) not null default 0
    constraint taxa_plataforma_nao_negativa check (taxa_plataforma >= 0),
  created_at timestamptz not null default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete cascade,
  login text not null,
  created_at timestamptz not null default now(),
  constraint staff_login_unico_por_merchant unique (merchant_id, login)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  login text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Módulo Fichas
-- =========================================================================

create table wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  merchant_id uuid not null references merchants (id) on delete cascade,
  saldo numeric(10, 2) not null default 0
    constraint saldo_nunca_negativo check (saldo >= 0),
  created_at timestamptz not null default now(),
  constraint wallet_unica_por_cliente_merchant unique (customer_id, merchant_id)
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets (id) on delete cascade,
  tipo text not null
    constraint tipo_transacao_valido check (tipo in ('credito', 'debito')),
  valor numeric(10, 2) not null
    constraint valor_transacao_positivo check (valor > 0),
  staff_id uuid references staff (id),
  created_at timestamptz not null default now()
);

create index wallet_transactions_wallet_id_idx on wallet_transactions (wallet_id);

-- =========================================================================
-- Módulo Pedidos
-- =========================================================================

create table order_items_catalog (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  nome text not null,
  preco_reais numeric(10, 2) not null
    constraint preco_catalogo_positivo check (preco_reais > 0),
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  status text not null default 'recebido'
    constraint order_status_valido check (
      status in ('recebido', 'preparando', 'pronto', 'retirado', 'cancelado')
    ),
  pickup_code text,
  payment_status text not null default 'pendente'
    constraint payment_status_valido check (
      payment_status in ('pendente', 'pago', 'falhou', 'estornado')
    ),
  total_reais numeric(10, 2) not null
    constraint total_pedido_nao_negativo check (total_reais >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pickup_code_unico unique (pickup_code)
);

create index orders_merchant_id_idx on orders (merchant_id);
create index orders_customer_id_idx on orders (customer_id);

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  catalog_item_id uuid not null references order_items_catalog (id),
  quantidade integer not null
    constraint quantidade_positiva check (quantidade > 0),
  preco_unitario numeric(10, 2) not null
    constraint preco_unitario_positivo check (preco_unitario > 0)
);

create index order_lines_order_id_idx on order_lines (order_id);

-- =========================================================================
-- RLS: habilitado sem políticas por enquanto.
-- As políticas (cliente vê só seus próprios dados, staff vê só seu merchant,
-- etc.) entram na etapa 3 (autenticação), junto com os papéis de app.
-- Até lá, o acesso é feito exclusivamente via service role no backend.
-- =========================================================================

alter table merchants enable row level security;
alter table staff enable row level security;
alter table customers enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table order_items_catalog enable row level security;
alter table orders enable row level security;
alter table order_lines enable row level security;
