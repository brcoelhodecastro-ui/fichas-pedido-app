import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getPixQrCode } from "@/lib/asaas/client";
import { statusLabel } from "@/lib/pedidos/status-label";

type OrderDetail = {
  id: string;
  status: string;
  payment_status: string;
  total_reais: number;
  pickup_code: string | null;
  asaas_payment_id: string | null;
  merchants: { nome: string } | null;
};

type OrderLine = {
  quantidade: number;
  preco_unitario: number;
  order_items_catalog: { nome: string } | null;
};

export default async function PedidoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const actor = await requireRole("customer");
  const { id } = await params;
  const { erro } = await searchParams;

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, payment_status, total_reais, pickup_code, asaas_payment_id, merchants(nome)",
    )
    .eq("id", id)
    .eq("customer_id", actor.customerId)
    .maybeSingle<OrderDetail>();

  if (!order) notFound();

  const { data: linhas } = await supabase
    .from("order_lines")
    .select("quantidade, preco_unitario, order_items_catalog(nome)")
    .eq("order_id", id)
    .returns<OrderLine[]>();

  let qrCode: { encodedImage: string; payload: string } | null = null;
  let erroQrCode: string | null = null;
  if (order.payment_status === "pendente" && order.asaas_payment_id) {
    try {
      qrCode = await getPixQrCode(order.asaas_payment_id);
    } catch (e) {
      erroQrCode = (e as Error).message;
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <div className="rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
        <h1 className="font-semibold text-black dark:text-zinc-50">
          {order.merchants?.nome ?? "Pedido"}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {statusLabel(order.status)}
        </p>

        <ul className="mt-3 flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          {linhas?.map((linha, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {linha.quantidade}x {linha.order_items_catalog?.nome ?? "Item"}
              </span>
              <span>R$ {(linha.quantidade * Number(linha.preco_unitario)).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-right font-semibold text-black dark:text-zinc-50">
          Total: R$ {Number(order.total_reais).toFixed(2)}
        </p>
      </div>

      {order.payment_status === "pendente" && (
        <div className="rounded-lg border border-black/10 bg-white p-5 text-center dark:border-white/10 dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Pague com Pix pra confirmar
          </h2>
          {qrCode ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${qrCode.encodedImage}`}
                alt="QR code Pix"
                className="mx-auto mt-3 h-48 w-48"
              />
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                Ou copie o código:
              </p>
              <textarea
                readOnly
                value={qrCode.payload}
                className="mt-1 h-20 w-full resize-none rounded border border-black/10 bg-transparent p-2 text-xs dark:border-white/10"
              />
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {erroQrCode
                ? `Não foi possível carregar o QR code agora: ${erroQrCode}`
                : "Gerando cobrança..."}
            </p>
          )}
        </div>
      )}

      {order.payment_status === "pago" && order.pickup_code && (
        <div className="rounded border border-dashed border-black/20 p-4 text-center dark:border-white/20">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Pago! Mostre esse código pro staff na retirada
          </p>
          <p className="font-mono text-3xl tracking-widest text-black dark:text-zinc-50">
            {order.pickup_code}
          </p>
        </div>
      )}
    </div>
  );
}
