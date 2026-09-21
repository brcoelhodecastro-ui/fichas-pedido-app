import { creditarSaldo, debitarComCodigo } from "./actions";

export default async function StaffHomePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const { erro, sucesso } = await searchParams;

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
        action={creditarSaldo}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <h2 className="font-semibold text-black dark:text-zinc-50">
          Creditar saldo
        </h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Login do cliente
          <input
            type="text"
            name="login"
            required
            className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Valor (R$)
          <input
            type="number"
            name="valor"
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
          Creditar
        </button>
      </form>

      <form
        action={debitarComCodigo}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <h2 className="font-semibold text-black dark:text-zinc-50">
          Debitar com código
        </h2>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Código (6 dígitos)
          <input
            type="text"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            className="rounded border border-black/10 bg-transparent px-3 py-2 font-mono tracking-widest dark:border-white/10"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Valor (R$)
          <input
            type="number"
            name="valor"
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
          Debitar
        </button>
      </form>
    </div>
  );
}
