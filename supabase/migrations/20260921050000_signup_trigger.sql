-- Corrige uma condição de corrida real: inserir a linha em customers/staff
-- numa chamada separada, DEPOIS que signUp()/createUser() retorna, corre o
-- risco de o service role tentar gravar antes da linha em auth.users estar
-- visível pra ele (a violação de FK "customers_user_id_fkey" observada em
-- teste real). A correção recomendada pelo próprio Supabase é criar a
-- linha via trigger em auth.users, na MESMA transação do GoTrue —
-- elimina a corrida por completo, e de brinde torna a criação atômica:
-- se o trigger falhar (ex: login duplicado), o INSERT inteiro em
-- auth.users é revertido, então nunca mais sobra um usuário de auth órfão.
--
-- Sinal de "isso é staff, não customer" vem de app_metadata (só o service
-- role escreve lá — nunca confiar em user_metadata pra isso, que o próprio
-- cliente controla via signUp()).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_staff jsonb;
begin
  v_pending_staff := new.raw_app_meta_data -> 'pending_staff';

  if v_pending_staff is not null then
    insert into public.staff (user_id, merchant_id, login)
      values (
        new.id,
        (v_pending_staff ->> 'merchant_id')::uuid,
        v_pending_staff ->> 'login'
      );

    -- limpa o sinal temporário, não precisa ficar pra sempre no token
    update auth.users
      set raw_app_meta_data = raw_app_meta_data - 'pending_staff'
      where id = new.id;
  else
    insert into public.customers (user_id, login)
      values (new.id, new.raw_user_meta_data ->> 'login');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- customers_self_insert (etapa 3) não é mais usada por nenhum código do
-- app — a criação agora é sempre pelo trigger acima (SECURITY DEFINER,
-- ignora RLS). Removendo fecha mais uma policy que ninguém precisa.
drop policy customers_self_insert on customers;
