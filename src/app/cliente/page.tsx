import { getActor } from "@/lib/auth/get-actor";
import { createClient } from "@/lib/supabase/server";
import { gerarCodigoDebito } from "./actions";

type WalletRow = {
  id: string;
  saldo: number;
  merchants: { nome: string } | null;
};

type CodeRow = {
  wallet_id: string;
  code: string;
  expires_at: string;
};

export default async function ClienteHomePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const actor = await getActor();
  if (actor.type !== "customer") return null; // layout já redireciona antes disso

  const supabase = await createClient();

  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, saldo, merchants(nome)")
    .eq("customer_id", actor.customerId)
    .returns<WalletRow[]>();

  const { data: codigosAtivos } = await supabase
    .from("wallet_debit_codes")
    .select("wallet_id, code, expires_at")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .returns<CodeRow[]>();

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p className="max-w-sm rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erro}
        </p>
      )}

      {!wallets || wallets.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Você ainda não tem fichas em nenhum estabelecimento. Peça pro staff
          creditar seu saldo no balcão.
        </p>
      ) : (
        wallets.map((wallet) => {
          const codigo = codigosAtivos?.find((c) => c.wallet_id === wallet.id);
          return (
            <div
              key={wallet.id}
              className="flex max-w-sm flex-col gap-3 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-black dark:text-zinc-50">
                  {wallet.merchants?.nome ?? "Estabelecimento"}
                </span>
                <span className="text-lg font-semibold text-black dark:text-zinc-50">
                  R$ {Number(wallet.saldo).toFixed(2)}
                </span>
              </div>

              {codigo ? (
                <div className="rounded border border-dashed border-black/20 p-3 text-center dark:border-white/20">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Mostre esse código pro staff
                  </p>
                  <p className="font-mono text-3xl tracking-widest text-black dark:text-zinc-50">
                    {codigo.code}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    válido até{" "}
                    {new Date(codigo.expires_at).toLocaleTimeString("pt-BR")}
                  </p>
                </div>
              ) : (
                <form action={gerarCodigoDebito}>
                  <input type="hidden" name="wallet_id" value={wallet.id} />
                  <button
                    type="submit"
                    className="w-full rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    Gerar código de débito
                  </button>
                </form>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
