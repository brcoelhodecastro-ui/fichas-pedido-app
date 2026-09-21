import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Actor =
  | { type: "admin" }
  | { type: "staff"; staffId: string; merchantId: string }
  | { type: "customer"; customerId: string }
  | { type: "none" };

export function homeForActor(actor: Actor): string {
  switch (actor.type) {
    case "admin":
      return "/admin";
    case "staff":
      return "/staff";
    case "customer":
      return "/cliente";
    case "none":
      return "/login";
  }
}

/**
 * Resolve o papel do usuário logado. Admin vem de uma claim no JWT
 * (app_metadata.role), setada manualmente via service role — nunca
 * auto-atribuível. Staff e customer vêm da própria linha na tabela
 * (fonte da verdade), não de claims.
 */
export async function getActor(): Promise<Actor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { type: "none" };

  if (user.app_metadata?.role === "admin") return { type: "admin" };

  const { data: staff } = await supabase
    .from("staff")
    .select("id, merchant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (staff) return { type: "staff", staffId: staff.id, merchantId: staff.merchant_id };

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (customer) return { type: "customer", customerId: customer.id };

  return { type: "none" };
}
