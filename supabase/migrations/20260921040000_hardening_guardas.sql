-- Revisão de segurança pós-etapa 6: fecha lacunas que a UI do app nunca
-- explora, mas que ficavam abertas pra qualquer cliente com acesso direto
-- à API REST do Supabase (fora do nosso Next.js), usando a própria sessão
-- autenticada de staff/customer.

-- =========================================================================
-- 1) CRÍTICO: wallets_staff_insert permitia INSERT em wallets com QUALQUER
-- saldo, contanto que o merchant_id fosse o do staff. Nenhum código do app
-- usa esse caminho — credit_wallet() é SECURITY DEFINER e insere via
-- privilégio de dono de função, sem depender dessa policy. Removê-la fecha
-- a lacuna sem tirar nenhuma funcionalidade real: staff só consegue criar
-- uma wallet (sempre com saldo 0) através de credit_wallet(), que sempre
-- gera o wallet_transactions correspondente.
-- =========================================================================

drop policy wallets_staff_insert on wallets;

-- =========================================================================
-- 2) customers.login não tinha unique constraint, mas credit_wallet()
-- busca o cliente por login sem STRICT — se dois clientes tivessem o
-- mesmo login (nada impedia isso), o crédito podia ir pro cliente errado
-- silenciosamente. NULL continua permitido (múltiplos NULLs não colidem).
-- =========================================================================

alter table customers add constraint customers_login_unico unique (login);

-- =========================================================================
-- 3) orders_staff_update (etapa 3) libera UPDATE em QUALQUER coluna do
-- pedido pro merchant do staff, mas a única coisa que a UI muda é
-- `status`. Sem essa guarda, dava pra sobrescrever total_reais,
-- customer_id, merchant_id ou o pickup_code de outro pedido via API
-- direta. Só o service_role escreve nesses campos agora.
-- =========================================================================

create or replace function public.orders_guard_operational_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.total_reais := old.total_reais;
    new.customer_id := old.customer_id;
    new.merchant_id := old.merchant_id;
    new.pickup_code := old.pickup_code;
  end if;
  return new;
end;
$$;

create trigger orders_before_update_guard_operational
  before update on orders
  for each row
  execute function public.orders_guard_operational_fields();

-- =========================================================================
-- 4) orders_force_pending_payment (etapa 5) já zerava payment_status/
-- paid_at/status no INSERT, mas esquecia asaas_payment_id — um cliente
-- podia inserir o próprio pedido já com um asaas_payment_id arbitrário.
-- =========================================================================

create or replace function public.orders_force_pending_payment()
returns trigger
language plpgsql
as $$
begin
  new.payment_status := 'pendente';
  new.paid_at := null;
  new.status := 'aguardando_pagamento';
  new.asaas_payment_id := null;
  return new;
end;
$$;

-- =========================================================================
-- 5) customers_self_update_or_admin (etapa 3) libera UPDATE em qualquer
-- coluna própria, incluindo asaas_customer_id — o app nunca deixa o
-- cliente editar isso, mas a policy também não impedia. Só o service_role
-- escreve nesse campo (é ele quem de fato cria o cliente no Asaas).
-- =========================================================================

create or replace function public.customers_guard_asaas_customer_id()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.asaas_customer_id := null;
    else
      new.asaas_customer_id := old.asaas_customer_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_before_write_guard_asaas
  before insert or update on customers
  for each row
  execute function public.customers_guard_asaas_customer_id();

-- =========================================================================
-- 6) wallet_debit_codes.expires_at tinha só um DEFAULT de 2 minutos — um
-- cliente podia inserir o próprio código já com expires_at lá na frente,
-- driblando o antifraude por tempo. Agora é forçado sempre, independente
-- do que vier no INSERT.
-- =========================================================================

create or replace function public.wallet_debit_codes_force_expiry()
returns trigger
language plpgsql
as $$
begin
  new.expires_at := now() + interval '2 minutes';
  new.used_at := null;
  return new;
end;
$$;

create trigger wallet_debit_codes_before_insert_force_expiry
  before insert on wallet_debit_codes
  for each row
  execute function public.wallet_debit_codes_force_expiry();
