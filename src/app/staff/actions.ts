"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

function parseValor(formData: FormData): number | null {
  const valor = Number(formData.get("valor"));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

export async function creditarSaldo(formData: FormData) {
  await requireRole("staff");

  const login = String(formData.get("login") ?? "").trim();
  const valor = parseValor(formData);

  if (!login || valor === null) {
    redirect("/staff?erro=Preencha login e um valor válido");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("credit_wallet", { p_customer_login: login, p_valor: valor })
    .single<{ wallet_id: string; novo_saldo: number }>();

  if (error) {
    redirect(`/staff?erro=${encodeURIComponent(error.message)}`);
  }

  redirect(`/staff?sucesso=Saldo creditado. Novo saldo: R$ ${data.novo_saldo}`);
}

export async function debitarComCodigo(formData: FormData) {
  await requireRole("staff");

  const code = String(formData.get("code") ?? "").trim();
  const valor = parseValor(formData);

  if (!code || valor === null) {
    redirect("/staff?erro=Preencha o código e um valor válido");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("redeem_wallet_debit_code", { p_code: code, p_valor: valor })
    .single<{ wallet_id: string; novo_saldo: number }>();

  if (error) {
    redirect(`/staff?erro=${encodeURIComponent(error.message)}`);
  }

  redirect(`/staff?sucesso=Ficha debitada. Novo saldo: R$ ${data.novo_saldo}`);
}
