import { Link, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Handshake,
  Wallet,
  Truck,
  BarChart3,
  UserCog,
  Settings,
} from "lucide-react";
import logoCalifornia from "@/assets/logo-california.png";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/consignacao", label: "Condicional", icon: Handshake },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/funcionarios", label: "Funcionários", icon: UserCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

type SidebarCtx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const Ctx = createContext<SidebarCtx>({ open: true, setOpen: () => {}, toggle: () => {} });
export const useSidebarMobile = () => useContext(Ctx);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const sync = () => setOpen(window.innerWidth >= 1024);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  return <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen(!open) }}>{children}</Ctx.Provider>;
}

export function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open, setOpen } = useSidebarMobile();
  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-20"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={
          "w-60 shrink-0 border-r bg-sidebar h-screen flex flex-col z-30 " +
          "lg:sticky lg:top-0 lg:translate-x-0 " +
          "fixed top-0 left-0 transition-transform " +
          (open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
      <div className="h-16 px-5 flex items-center gap-2 border-b">
        <img
          src={logoCalifornia}
          alt="California Store"
          className="h-10 w-10 rounded-lg object-cover"
        />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">California</p>
          <p className="text-xs text-muted-foreground">Store</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((it) => {
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => { if (window.innerWidth < 1024) setOpen(false); }}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-blue-100 text-blue-900 font-medium"
                  : "text-foreground/70 hover:bg-accent/60 hover:text-foreground")
              }
            >
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      </aside>
    </>
  );
}

export const navTitles: Record<string, string> = Object.fromEntries(
  items.map((i) => [i.to, i.label])
);