import Link from "next/link";
import type { ReactNode } from "react";

export function MobileShell({
  brand,
  title,
  userLabel,
  active,
  children,
  overlay,
}: {
  brand?: string;
  title?: string;
  userLabel?: string;
  active: "home" | "clients" | "workorders" | "stats" | "admin";
  children: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <div className="text-base font-semibold tracking-tight">
              {brand ?? "friopro"}
            </div>
            {title ? <div className="text-xs text-zinc-500">{title}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {userLabel ? (
              <div className="hidden text-xs text-zinc-600 sm:block">{userLabel}</div>
            ) : null}
            <div className="h-9 w-9 rounded-full border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-200" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</main>

      {overlay}

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2 text-xs">
          <NavItem href="/" label="Inicio" active={active === "home"} />
          <NavItem href="/clients" label="Clientes" active={active === "clients"} />
          <NavItem
            href="/workorders"
            label="Órdenes"
            active={active === "workorders"}
          />
          <NavItem href="/stats" label="Stats" active={active === "stats"} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-colors " +
        (active
          ? "bg-emerald-50 text-emerald-800"
          : "text-zinc-600 hover:bg-zinc-50")
      }
    >
      <div
        className={
          "h-5 w-5 rounded-md " +
          (active ? "bg-emerald-600" : "bg-zinc-300")
        }
      />
      <div className="font-medium">{label}</div>
    </Link>
  );
}
