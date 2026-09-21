"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createStaff(formData: FormData) {
  await requireRole("admin");

  const merchantId = String(formData.get("merchant_id") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const login = String(formData.get("login") ?? "").trim();

  if (!merchantId || !email || !password || !login) {
    redirect("/admin/staff/new?erro=Preencha todos os campos");
  }

  const admin = createAdminClient();
  // pending_staff vai em app_metadata (só o service role escreve lá) e é
  // lido pelo trigger on_auth_user_created, que cria a linha em staff na
  // MESMA transação do INSERT em auth.users — mesma lógica do /signup,
  // evita a corrida e torna a criação atômica.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      pending_staff: { merchant_id: merchantId, login },
    },
  });

  if (error) {
    redirect(`/admin/staff/new?erro=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?sucesso=Staff criado");
}
