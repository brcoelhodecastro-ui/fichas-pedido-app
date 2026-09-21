import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/pedidos/status-label";

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  total_reais: number;
  created_at: string;
  merchants: { nome: string } | null;
};

export default async function MeusPedidosPage() {
  const actor = await requireRole("customer");
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, status, payment_status, total_reais, created_at, merchants(nome)")
    .eq("customer_id", actor.customerId)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-black dark:text-zinc-50">
          Meus pedidos
        </h1>
        <Link
          href="/cliente/pedidos/novo"
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Novo pedido
        </Link>
      </div>

      {!pedidos || pedidos.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Você ainda não fez nenhum pedido.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <Link
              key={pedido.id}
              href={`/cliente/pedidos/${pedido.id}`}
              className="flex max-w-sm items-center justify-between rounded-lg border border-black/10 bg-white p-4 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
            >
              <div className="flex flex-col text-sm">
                <span className="font-medium text-black dark:text-zinc-50">
                  {pedido.merchants?.nome ?? "Estabelecimento"}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {statusLabel(pedido.status)}
                </span>
              </div>
              <span className="font-medium text-black dark:text-zinc-50">
                R$ {Number(pedido.total_reais).toFixed(2)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
