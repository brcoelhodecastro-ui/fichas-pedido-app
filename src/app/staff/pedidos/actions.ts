"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const STATUS_PERMITIDOS = ["preparando", "pronto", "cancelado"];

export async function avancarStatus(formData: FormData) {
  await requireRole("staff");

  const orderId = String(formData.get("order_id") ?? "");
  const novoStatus = String(formData.get("novo_status") ?? "");

  if (!orderId || !STATUS_PERMITIDOS.includes(novoStatus)) {
    redirect("/staff/pedidos?erro=Status inválido");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: novoStatus })
    .eq("id", orderId);

  if (error) {
    redirect(`/staff/pedidos?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/staff/pedidos?sucesso=Status atualizado");
}

export async function confirmarRetirada(formData: FormData) {
  await requireRole("staff");

  const code = String(formData.get("pickup_code") ?? "")
    .trim()
    .toUpperCase();

  if (!code) {
    redirect("/staff/pedidos?erro=Informe o código de retirada");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "retirado" })
    .eq("pickup_code", code)
    .in("status", ["recebido", "preparando", "pronto"])
    .select("id")
    .maybeSingle();

  if (error) {
    redirect(`/staff/pedidos?erro=${encodeURIComponent(error.message)}`);
  }
  if (!data) {
    redirect(
      "/staff/pedidos?erro=Código inválido ou pedido não está disponível pra retirada",
    );
  }

  redirect("/staff/pedidos?sucesso=Retirada confirmada");
}
