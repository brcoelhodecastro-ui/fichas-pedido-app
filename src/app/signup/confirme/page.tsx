export default function ConfirmeEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Confirme seu e-mail
      </h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Enviamos um link de confirmação para o e-mail informado. Depois de
        confirmar, você já pode entrar normalmente.
      </p>
    </div>
  );
}
