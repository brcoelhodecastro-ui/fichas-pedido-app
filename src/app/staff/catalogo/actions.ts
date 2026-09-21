"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function adicionarItemCatalogo(formData: FormData) {
  const actor = await requireRole("staff");

  const nome = String(formData.get("nome") ?? "").trim();
  const preco = Number(formData.get("preco_reais"));

  if (!nome || !Number.isFinite(preco) || preco <= 0) {
    redirect("/staff/catalogo?erro=Preencha nome e um preço válido");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("order_items_catalog").insert({
    merchant_id: actor.merchantId,
    nome,
    preco_reais: preco,
  });

  if (error) {
    redirect(`/staff/catalogo?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/staff/catalogo?sucesso=Item adicionado");
}
