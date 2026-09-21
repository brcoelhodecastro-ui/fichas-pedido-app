"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function createMerchant(formData: FormData) {
  await requireRole("admin");

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    redirect("/admin/merchants/new?erro=Nome é obrigatório");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").insert({ nome });

  if (error) {
    redirect(`/admin/merchants/new?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?sucesso=Merchant criado");
}
