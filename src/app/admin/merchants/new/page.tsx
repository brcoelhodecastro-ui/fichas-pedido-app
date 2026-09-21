import { createMerchant } from "./actions";

export default async function NewMerchantPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <form
      action={createMerchant}
      className="flex max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
    >
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
        Novo merchant
      </h1>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Nome
        <input
          type="text"
          name="nome"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
      </label>

      <button
        type="submit"
        className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        Criar
      </button>
    </form>
  );
}
