import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client com a service role key: ignora RLS. Só pode ser usado em código
 * server-only (route handlers, server actions) e nunca deve ser exposto
 * ao browser. É usado para operações administrativas na API de Auth do
 * Supabase (ex: criar usuário de staff), que a anon key não alcança.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
