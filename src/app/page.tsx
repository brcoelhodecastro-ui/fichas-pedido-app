import Link from "next/link";
import { getActor, homeForActor } from "@/lib/auth/get-actor";

export default async function Home() {
  const actor = await getActor();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Fichas &amp; Pedidos
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Módulo de Fichas (saldo de balcão) e módulo de Pedidos (encomendas
        com pagamento antecipado) ainda serão implementados.
      </p>
      <Link
        href={homeForActor(actor)}
        className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {actor.type === "none" ? "Entrar" : "Ir para o painel"}
      </Link>
    </div>
  );
}
