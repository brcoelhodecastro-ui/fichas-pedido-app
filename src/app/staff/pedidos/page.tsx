import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/pedidos/status-label";
import { avancarStatus, confirmarRetirada } from "./actions";

type OrderRow = {
  id: string;
  status: string;
  payment_status: string;
  total_reais: number;
  pickup_code: string | null;
  created_at: string;
};

const PROXIMO_STATUS: Record<string, { valor: string; rotulo: string }[]> = {
  recebido: [
    { valor: "preparando", rotulo: "Iniciar preparo" },
    { valor: "cancelado", rotulo: "Cancelar" },
  ],
  preparando: [
    { valor: "pronto", rotulo: "Marcar como pronto" },
    { valor: "cancelado", rotulo: "Cancelar" },
  ],
};

export default async function PedidosStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;
  const actor = await requireRole("staff");

  const supabase = await createClient();
  const { data: pedidos } = await supabase
    .from("orders")
    .select("id, status, payment_status, total_reais, pickup_code, created_at")
    .eq("merchant_id", actor.merchantId)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p className="w-full max-w-sm rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="w-full max-w-sm rounded bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {sucesso}
        </p>
      )}

      <form
        action={confirmarRetirada}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <h2 className="font-semibold text-black dark:text-zinc-50">
          Confirmar retirada
        </h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Código de retirada
          <input
            type="text"
            name="pickup_code"
            required
            className="rounded border border-black/10 bg-transparent px-3 py-2 font-mono tracking-widest uppercase dark:border-white/10"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Confirmar
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-black dark:text-zinc-50">Pedidos</h2>
        {!pedidos || pedidos.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nenhum pedido ainda.
          </p>
        ) : (
          pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex flex-col text-sm">
                <span className="font-medium text-black dark:text-zinc-50">
                  R$ {Number(pedido.total_reais).toFixed(2)} —{" "}
                  {statusLabel(pedido.status)}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  Pagamento: {pedido.payment_status}
                  {pedido.pickup_code ? ` · código: ${pedido.pickup_code}` : ""}
                </span>
              </div>

              {PROXIMO_STATUS[pedido.status] && (
                <form action={avancarStatus} className="flex gap-2">
                  <input type="hidden" name="order_id" value={pedido.id} />
                  {PROXIMO_STATUS[pedido.status].map((opcao) => (
                    <button
                      key={opcao.valor}
                      type="submit"
                      name="novo_status"
                      value={opcao.valor}
                      className="rounded border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      {opcao.rotulo}
                    </button>
                  ))}
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
