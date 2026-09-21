"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function gerarCodigoDebito(formData: FormData) {
  await requireRole("customer");

  const walletId = String(formData.get("wallet_id") ?? "");
  if (!walletId) {
    redirect("/cliente?erro=Ficha inválida");
  }

  const supabase = await createClient();

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const { error } = await supabase
      .from("wallet_debit_codes")
      .insert({ wallet_id: walletId, code });

    if (!error) {
      redirect("/cliente");
    }
    // 23505 = unique_violation: código já ativo em outra wallet, tenta outro.
    if (error.code !== "23505") {
      redirect(`/cliente?erro=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/cliente?erro=Não foi possível gerar o código, tente novamente");
}
