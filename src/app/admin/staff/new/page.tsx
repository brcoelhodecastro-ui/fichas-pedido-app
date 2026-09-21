import { createClient } from "@/lib/supabase/server";
import { createStaff } from "./actions";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  const supabase = await createClient();
  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, nome")
    .order("nome");

  return (
    <form
      action={createStaff}
      className="flex max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
    >
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
        Novo staff
      </h1>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Merchant
        <select
          name="merchant_id"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        >
          {merchants?.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Nome de usuário (login)
        <input
          type="text"
          name="login"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        E-mail
        <input
          type="email"
          name="email"
          required
          className="rounded border border-black/10 bg-transparent px-3 py-2 dark:border-white/10"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Senha temporária
        <input
          type="password"
          name="password"
          required
          minLength={6}
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
