-- Módulo Fichas: código temporário de débito + crédito manual (etapa 4).
--
-- wallet_debit_codes guarda os códigos de 6 dígitos que o cliente gera no
-- app e mostra pro staff no balcão. O staff nunca navega essa tabela
-- diretamente (sem policy de select/update pra staff) — toda a validação
-- e o débito passam pela função redeem_wallet_debit_code(), que reivindica
-- o código de forma atômica (evita duas caixas debitando o mesmo código
-- ao mesmo tempo) e confere se o código é do merchant do staff que chamou.

create table wallet_debit_codes (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references wallets (id) on delete cascade,
  code text not null
    constraint code_seis_digitos check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index wallet_debit_codes_wallet_id_idx on wallet_debit_codes (wallet_id);

-- Só pode existir um código ativo (não usado) com aquele valor por vez,
-- em toda a base — evita ambiguidade na hora do staff digitar o código.
create unique index wallet_debit_codes_code_ativo_idx
  on wallet_debit_codes (code)
  where used_at is null;

alter table wallet_debit_codes enable row level security;

create policy wallet_debit_codes_customer_insert on wallet_debit_codes
  for insert
  with check (
    exists (
      select 1 from wallets w
      where w.id = wallet_debit_codes.wallet_id
        and w.customer_id = my_customer_id()
    )
  );

create policy wallet_debit_codes_select on wallet_debit_codes
  for select
  using (
    is_admin()
    or exists (
      select 1 from wallets w
      where w.id = wallet_debit_codes.wallet_id
        and w.customer_id = my_customer_id()
    )
  );

-- =========================================================================
-- credit_wallet: staff credita saldo manualmente (sem Pix ainda).
-- O merchant é sempre o do staff que chama — staff não escolhe merchant,
-- então não tem como creditar fora do próprio estabelecimento. Cria a
-- wallet do cliente nesse merchant se ainda não existir.
-- =========================================================================

create or replace function public.credit_wallet(
  p_customer_login text,
  p_valor numeric
)
returns table (wallet_id uuid, novo_saldo numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_merchant_id uuid;
  v_customer_id uuid;
  v_wallet_id uuid;
begin
  select id, merchant_id into v_staff_id, v_merchant_id
    from staff where user_id = auth.uid();
  if v_staff_id is null then
    raise exception 'apenas staff pode creditar fichas';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'valor deve ser positivo';
  end if;

  select id into v_customer_id from customers where login = p_customer_login;
  if v_customer_id is null then
    raise exception 'cliente não encontrado';
  end if;

  insert into wallets (customer_id, merchant_id, saldo)
    values (v_customer_id, v_merchant_id, 0)
  on conflict (customer_id, merchant_id) do nothing;

  select id into v_wallet_id from wallets
    where customer_id = v_customer_id and merchant_id = v_merchant_id;

  insert into wallet_transactions (wallet_id, tipo, valor, staff_id)
    values (v_wallet_id, 'credito', p_valor, v_staff_id);

  return query select v_wallet_id, w.saldo from wallets w where w.id = v_wallet_id;
end;
$$;

-- =========================================================================
-- redeem_wallet_debit_code: staff debita usando o código temporário.
-- =========================================================================

create or replace function public.redeem_wallet_debit_code(
  p_code text,
  p_valor numeric
)
returns table (wallet_id uuid, novo_saldo numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_staff_merchant_id uuid;
  v_wallet_id uuid;
  v_wallet_merchant_id uuid;
begin
  select id, merchant_id into v_staff_id, v_staff_merchant_id
    from staff where user_id = auth.uid();
  if v_staff_id is null then
    raise exception 'apenas staff pode debitar fichas';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'valor deve ser positivo';
  end if;

  -- Reivindica o código atomicamente: só um chamador consegue "ganhar"
  -- a corrida se dois terminais tentarem o mesmo código ao mesmo tempo.
  update wallet_debit_codes
    set used_at = now()
    where code = p_code
      and used_at is null
      and expires_at > now()
    returning wallet_debit_codes.wallet_id into v_wallet_id;

  if v_wallet_id is null then
    raise exception 'código inválido, expirado ou já utilizado';
  end if;

  select merchant_id into v_wallet_merchant_id from wallets where id = v_wallet_id;
  if v_wallet_merchant_id is distinct from v_staff_merchant_id then
    -- levanta exceção -> desfaz também o UPDATE acima (mesma transação),
    -- então o código continua válido pro staff do merchant correto usar.
    raise exception 'código pertence a outro estabelecimento';
  end if;

  insert into wallet_transactions (wallet_id, tipo, valor, staff_id)
    values (v_wallet_id, 'debito', p_valor, v_staff_id);

  return query select v_wallet_id, w.saldo from wallets w where w.id = v_wallet_id;
end;
$$;
