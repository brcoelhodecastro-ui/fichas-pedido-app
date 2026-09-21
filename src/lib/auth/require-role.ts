import "server-only";
import { redirect } from "next/navigation";
import { getActor, homeForActor, type Actor } from "@/lib/auth/get-actor";

export async function requireRole<T extends Actor["type"]>(
  role: T,
): Promise<Extract<Actor, { type: T }>> {
  const actor = await getActor();

  if (actor.type === "none") redirect("/login");
  if (actor.type !== role) redirect(homeForActor(actor));

  return actor as Extract<Actor, { type: T }>;
}
