"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const login = String(formData.get("login") ?? "");

  const supabase = await createClient();
  // O login vai em options.data (user_metadata) e é lido pelo trigger
  // on_auth_user_created, que cria a linha em customers na MESMA
  // transação do INSERT em auth.users — elimina a corrida entre o
  // serviço de auth e uma chamada separada, e torna a criação atômica:
  // se o login já existir, o trigger falha e o auth.users inteiro é
  // revertido (nunca sobra usuário órfão).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { login: login || null } },
  });

  if (error) {
    redirect(`/signup?erro=${encodeURIComponent(error.message)}`);
  }
  if (!data.user) {
    redirect("/signup?erro=Não foi possível criar a conta");
  }

  if (data.session) {
    redirect("/cliente");
  }
  redirect("/signup/confirme");
}
