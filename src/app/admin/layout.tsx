import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth-helpers";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold">
              FríoPro
            </Link>
            <span className="text-sm text-zinc-500">/ Admin</span>
          </div>
          <div className="text-xs text-zinc-600">{user.email}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <nav className="flex flex-col gap-1 text-sm">
            <Link
              href="/admin"
              className="rounded-xl px-3 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="rounded-xl px-3 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Usuarios
            </Link>
            <Link
              href="/admin/plans"
              className="rounded-xl px-3 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Planes
            </Link>
            <Link
              href="/admin/licenses"
              className="rounded-xl px-3 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Licencias
            </Link>
            <Link
              href="/admin/usage"
              className="rounded-xl px-3 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Uso
            </Link>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
