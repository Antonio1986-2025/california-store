import { Link, useRouterState } from "@tanstack/react-router";
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
  Shirt,
} from "lucide-react";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pdv", label: "PDV", icon: ShoppingCart },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/consignacao", label: "Consignação", icon: Handshake },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/funcionarios", label: "Funcionários", icon: UserCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-60 shrink-0 border-r bg-sidebar h-screen sticky top-0 flex flex-col">
      <div className="h-16 px-5 flex items-center gap-2 border-b">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <Shirt className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">California</p>
          <p className="text-xs text-muted-foreground">Stores</p>
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
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-accent text-accent-foreground font-medium"
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
  );
}

export const navTitles: Record<string, string> = Object.fromEntries(
  items.map((i) => [i.to, i.label])
);