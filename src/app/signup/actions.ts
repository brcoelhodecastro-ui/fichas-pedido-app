"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const login = String(formData.get("login") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?erro=${encodeURIComponent(error.message)}`);
  }
  if (!data.user) {
    redirect("/signup?erro=Não foi possível criar a conta");
  }

  // Provisiona a linha em customers via service role: a sessão pode ainda
  // não existir aqui se a confirmação de e-mail estiver habilitada, então
  // não dá pra depender de RLS (auth.uid()) neste passo.
  const admin = createAdminClient();
  const { error: customerError } = await admin
    .from("customers")
    .insert({ user_id: data.user.id, login: login || null });

  if (customerError) {
    // Desfaz o usuário de auth pra não deixar uma conta órfã (sem linha em
    // customers, presa pra sempre já que o e-mail fica marcado como usado).
    await admin.auth.admin.deleteUser(data.user.id);

    const mensagem =
      customerError.code === "23505"
        ? "Esse nome de usuário já existe"
        : customerError.message;
    redirect(`/signup?erro=${encodeURIComponent(mensagem)}`);
  }

  if (data.session) {
    redirect("/cliente");
  }
  redirect("/signup/confirme");
}
