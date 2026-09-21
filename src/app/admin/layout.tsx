import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <nav className="flex items-center gap-4">
          <span className="font-medium text-black dark:text-zinc-50">Admin</span>
          <Link href="/admin" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Início
          </Link>
          <Link href="/admin/merchants/new" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Novo merchant
          </Link>
          <Link href="/admin/staff/new" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            Novo staff
          </Link>
        </nav>
        <SignOutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
