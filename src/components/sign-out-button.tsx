export function SignOutButton() {
  return (
    <form action="/logout" method="post">
      <button
        type="submit"
        className="rounded border border-black/10 px-3 py-1.5 text-sm text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
      >
        Sair
      </button>
    </form>
  );
}
