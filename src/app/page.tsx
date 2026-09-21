export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Fichas &amp; Pedidos
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Projeto em construção. Módulo de Fichas (saldo de balcão) e módulo de
        Pedidos (encomendas com pagamento antecipado) ainda serão implementados.
      </p>
    </div>
  );
}
