-- Integração de pagamento real (Asaas/Pix) — etapa 5.
--
-- Ponto central: ninguém além do webhook do Asaas (autenticado como
-- service_role) pode marcar um pedido como pago. Sem isso, a garantia de
-- "pedido só libera depois que o pagamento confirma" seria só decorativa —
-- um cliente poderia inserir payment_status='pago' direto, ou um staff
-- poderia "confirmar" na mão.

alter table customers add column cpf_cnpj text;
alter table customers add column asaas_customer_id text;
alter table customers add constraint customers_asaas_customer_id_unico unique (asaas_customer_id);

alter table orders add column asaas_payment_id text;
alter table orders add constraint orders_asaas_payment_id_unico unique (asaas_payment_id);

-- Pedido nasce aguardando pagamento; só vira "recebido" (liberado pra
-- cozinha) quando o webhook confirma. Substitui o enum antigo, que não
-- tinha esse estado inicial.
alter table orders drop constraint order_status_valido;
alter table orders add constraint order_status_valido check (
  status in ('aguardando_pagamento', 'recebido', 'preparando', 'pronto', 'retirado', 'cancelado')
);
alter table orders alter column status set default 'aguardando_pagamento';

-- Todo pedido novo nasce com pagamento pendente, não importa o que o
-- cliente mande no INSERT.
create or replace function public.orders_force_pending_payment()
returns trigger
language plpgsql
as $$
begin
  new.payment_status := 'pendente';
  new.paid_at := null;
  new.status := 'aguardando_pagamento';
  return new;
end;
$$;

create trigger orders_before_insert_force_pending
  before insert on orders
  for each row
  execute function public.orders_force_pending_payment();

-- Staff/admin seguem podendo mudar o status operacional (preparando,
-- pronto, retirado, cancelado) pela UPDATE policy já existente, mas os
-- campos de pagamento só mudam se quem está chamando é o service_role
-- (ou seja: o webhook do Asaas, nunca um staff ou o próprio cliente).
create or replace function public.orders_guard_payment_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.payment_status := old.payment_status;
    new.paid_at := old.paid_at;
    new.asaas_payment_id := old.asaas_payment_id;
  end if;
  return new;
end;
$$;

create trigger orders_before_update_guard_payment
  before update on orders
  for each row
  execute function public.orders_guard_payment_fields();
