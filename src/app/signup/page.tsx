import Link from "next/link";
import { signUp } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        action={signUp}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Criar conta
        </h1>

        {erro && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {erro}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Nome de usuário
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
          Senha
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
          className="mt-2 rounded bg-black px-4 py-2 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Criar conta
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
