import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { adicionarItemCatalogo } from "./actions";

type ItemRow = { id: string; nome: string; preco_reais: number };

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;
  const actor = await requireRole("staff");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("order_items_catalog")
    .select("id, nome, preco_reais")
    .eq("merchant_id", actor.merchantId)
    .order("nome")
    .returns<ItemRow[]>();

  return (
    <div className="flex flex-wrap gap-6">
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
        action={adicionarItemCatalogo}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <h2 className="font-semibold text-black dark:text-zinc-50">
          Novo item
        </h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nome
          <input
            type="text"
            name="nome"
            required
            placeholder="Picanha 1kg"
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Preço (R$)
          <input
            type="number"
            name="preco_reais"
            step="0.01"
            min="0.01"
            required
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Adicionar
        </button>
      </form>

      <div className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
        <h2 className="mb-3 font-semibold text-black dark:text-zinc-50">
          Itens cadastrados
        </h2>
        {!itens || itens.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nenhum item ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-300"
              >
                <span>{item.nome}</span>
                <span className="font-medium">
                  R$ {Number(item.preco_reais).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
