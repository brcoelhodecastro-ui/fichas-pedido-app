"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
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
  const { data, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !data.user) {
    redirect(
      `/admin/staff/new?erro=${encodeURIComponent(createUserError?.message ?? "Falha ao criar usuário")}`,
    );
  }

  const supabase = await createClient();
  const { error: staffError } = await supabase.from("staff").insert({
    merchant_id: merchantId,
    user_id: data.user.id,
    login,
  });

  if (staffError) {
    redirect(`/admin/staff/new?erro=${encodeURIComponent(staffError.message)}`);
  }

  redirect("/admin?sucesso=Staff criado");
}
