import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("customer");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <span className="font-medium text-black dark:text-zinc-50">Área do cliente</span>
        <SignOutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
