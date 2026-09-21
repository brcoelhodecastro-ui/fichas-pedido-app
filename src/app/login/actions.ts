"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActor, homeForActor } from "@/lib/auth/get-actor";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  const actor = await getActor();
  redirect(homeForActor(actor));
}
