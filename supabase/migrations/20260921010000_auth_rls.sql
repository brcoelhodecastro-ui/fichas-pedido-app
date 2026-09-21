-- Autenticação e RLS (etapa 3).
--
-- Papéis:
--   - admin: super-admin da plataforma. Identificado por app_metadata.role = 'admin'
--            no JWT (setado manualmente via service role, nunca auto-atribuível).
--   - staff: funcionário de UM merchant. Identidade vem da tabela staff (não do
--            JWT) — quem tem uma linha em staff com user_id = auth.uid() é staff.
--   - customer: identidade vem da tabela customers, da mesma forma.
--
-- Staff e customer não usam claims customizadas: a fonte da verdade é a própria
-- linha na tabela, criada por quem tem permissão de criá-la (customer se
-- autocadastra; staff só é criado por um admin).

-- =========================================================================
-- Funções auxiliares (SQL, stable — reaproveitadas nas políticas abaixo)
-- =========================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.my_customer_id()
returns uuid
language sql
stable
as $$
  select id from public.customers where user_id = auth.uid();
$$;

create or replace function public.my_staff_merchant_id()
returns uuid
language sql
stable
as $$
  select merchant_id from public.staff where user_id = auth.uid();
$$;

-- =========================================================================
-- merchants
-- Leitura liberada para qualquer usuário autenticado (staff/customer
-- precisam ver nome do merchant). Atenção: dados_recebedor_asaas fica
-- exposto nessa leitura ampla — aceitável para o MVP porque só admin
-- escreve nesses dados, mas antes de ligar pagamento real (etapa 5) vale
-- revisar se esse campo deveria sair para uma view separada.
-- =========================================================================

create policy merchants_select_authenticated on merchants
  for select
  using (auth.role() = 'authenticated');

create policy merchants_admin_insert on merchants
  for insert
  with check (is_admin());

create policy merchants_admin_update on merchants
  for update
  using (is_admin())
  with check (is_admin());

create policy merchants_admin_delete on merchants
  for delete
  using (is_admin());

-- =========================================================================
-- staff
-- =========================================================================

create policy staff_select_self_or_admin on staff
  for select
  using (user_id = auth.uid() or is_admin());

create policy staff_admin_insert on staff
  for insert
  with check (is_admin());

create policy staff_admin_update on staff
  for update
  using (is_admin())
  with check (is_admin());

create policy staff_admin_delete on staff
  for delete
  using (is_admin());

-- =========================================================================
-- customers
-- Autocadastro: o próprio usuário cria sua linha logo após o signup.
-- =========================================================================

create policy customers_select_self_or_admin on customers
  for select
  using (user_id = auth.uid() or is_admin());

create policy customers_self_insert on customers
  for insert
  with check (user_id = auth.uid());

create policy customers_self_update_or_admin on customers
  for update
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy customers_admin_delete on customers
  for delete
  using (is_admin());

-- =========================================================================
-- wallets
-- Sem policy de UPDATE para staff/customer: saldo só muda via
-- wallet_transactions (trigger abaixo). Isso mantém o extrato como fonte
-- única da verdade e evita staff "ajustar" saldo por fora do audit trail.
-- =========================================================================

create policy wallets_select on wallets
  for select
  using (
    is_admin()
    or customer_id = my_customer_id()
    or merchant_id = my_staff_merchant_id()
  );

create policy wallets_staff_insert on wallets
  for insert
  with check (is_admin() or merchant_id = my_staff_merchant_id());

create policy wallets_admin_update on wallets
  for update
  using (is_admin())
  with check (is_admin());

-- =========================================================================
-- wallet_transactions
-- Log imutável: sem policy de UPDATE/DELETE para ninguém.
-- =========================================================================

create policy wallet_transactions_select on wallet_transactions
  for select
  using (
    is_admin()
    or exists (
      select 1 from wallets w
      where w.id = wallet_transactions.wallet_id
        and (w.customer_id = my_customer_id() or w.merchant_id = my_staff_merchant_id())
    )
  );

create policy wallet_transactions_staff_insert on wallet_transactions
  for insert
  with check (
    is_admin()
    or exists (
      select 1 from wallets w
      where w.id = wallet_transactions.wallet_id
        and w.merchant_id = my_staff_merchant_id()
    )
  );

-- Aplica o crédito/débito ao saldo da wallet. SECURITY DEFINER: staff só
-- precisa de permissão de INSERT em wallet_transactions, não de UPDATE
-- direto em wallets — o saldo negativo continua bloqueado pelo check
-- constraint da tabela wallets, que roda dentro desta função também.
create or replace function public.apply_wallet_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'credito' then
    update wallets set saldo = saldo + new.valor where id = new.wallet_id;
  else
    update wallets set saldo = saldo - new.valor where id = new.wallet_id;
  end if;
  return new;
end;
$$;

create trigger wallet_transactions_apply
  after insert on wallet_transactions
  for each row
  execute function public.apply_wallet_transaction();

-- =========================================================================
-- order_items_catalog
-- =========================================================================

create policy catalog_select_authenticated on order_items_catalog
  for select
  using (auth.role() = 'authenticated');

create policy catalog_staff_insert on order_items_catalog
  for insert
  with check (is_admin() or merchant_id = my_staff_merchant_id());

create policy catalog_staff_update on order_items_catalog
  for update
  using (is_admin() or merchant_id = my_staff_merchant_id())
  with check (is_admin() or merchant_id = my_staff_merchant_id());

create policy catalog_staff_delete on order_items_catalog
  for delete
  using (is_admin() or merchant_id = my_staff_merchant_id());

-- =========================================================================
-- orders
-- Sem policy de DELETE: cancelamento é feito via status = 'cancelado'.
-- =========================================================================

create policy orders_select on orders
  for select
  using (
    is_admin()
    or customer_id = my_customer_id()
    or merchant_id = my_staff_merchant_id()
  );

create policy orders_insert on orders
  for insert
  with check (
    is_admin()
    or customer_id = my_customer_id()
    or merchant_id = my_staff_merchant_id()
  );

create policy orders_staff_update on orders
  for update
  using (is_admin() or merchant_id = my_staff_merchant_id())
  with check (is_admin() or merchant_id = my_staff_merchant_id());

-- =========================================================================
-- order_lines
-- =========================================================================

create policy order_lines_select on order_lines
  for select
  using (
    is_admin()
    or exists (
      select 1 from orders o
      where o.id = order_lines.order_id
        and (o.customer_id = my_customer_id() or o.merchant_id = my_staff_merchant_id())
    )
  );

create policy order_lines_insert on order_lines
  for insert
  with check (
    is_admin()
    or exists (
      select 1 from orders o
      where o.id = order_lines.order_id
        and (o.customer_id = my_customer_id() or o.merchant_id = my_staff_merchant_id())
    )
  );
