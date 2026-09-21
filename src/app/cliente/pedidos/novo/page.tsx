import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { criarPedido } from "./actions";

type Merchant = { id: string; nome: string };
type CatalogItem = { id: string; nome: string; preco_reais: number };

export default async function NovoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; erro?: string }>;
}) {
  const { merchant, erro } = await searchParams;
  const actor = await requireRole("customer");
  const supabase = await createClient();

  if (!merchant) {
    const { data: merchants } = await supabase
      .from("merchants")
      .select("id, nome")
      .order("nome")
      .returns<Merchant[]>();

    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-semibold text-black dark:text-zinc-50">
          Escolha o estabelecimento
        </h1>
        {erro && (
          <p className="max-w-sm rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {erro}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {merchants?.map((m) => (
            <Link
              key={m.id}
              href={`/cliente/pedidos/novo?merchant=${m.id}`}
              className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-4 hover:bg-black/5 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
            >
              {m.nome}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [{ data: catalogo }, { data: customer }] = await Promise.all([
    supabase
      .from("order_items_catalog")
      .select("id, nome, preco_reais")
      .eq("merchant_id", merchant)
      .order("nome")
      .returns<CatalogItem[]>(),
    supabase
      .from("customers")
      .select("cpf_cnpj")
      .eq("id", actor.customerId)
      .single<{ cpf_cnpj: string | null }>(),
  ]);

  return (
    <form
      action={criarPedido}
      className="flex max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
    >
      <input type="hidden" name="merchant_id" value={merchant} />

      <h1 className="font-semibold text-black dark:text-zinc-50">
        Montar pedido
      </h1>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      {!catalogo || catalogo.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Esse estabelecimento ainda não tem itens no catálogo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {catalogo.map((item) => (
            <label
              key={item.id}
              className="flex items-center justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <span>
                {item.nome} — R$ {Number(item.preco_reais).toFixed(2)}
              </span>
              <input
                type="number"
                name={`qty_${item.id}`}
                min="0"
                defaultValue={0}
                className="w-16 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
              />
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        CPF/CNPJ (necessário pra gerar a cobrança Pix)
        <input
          type="text"
          name="cpf_cnpj"
          required
          defaultValue={customer?.cpf_cnpj ?? ""}
          placeholder="Só números"
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
      </label>

      <button
        type="submit"
        className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Fazer pedido e pagar
      </button>
    </form>
  );
}
