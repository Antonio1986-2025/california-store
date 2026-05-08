import { LogOut, Menu } from "lucide-react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { navTitles, useSidebarMobile } from "./sidebar-nav";

function initialsFromEmail(email?: string | null) {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Topbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toggle } = useSidebarMobile();

  const matched = Object.keys(navTitles)
    .sort((a, b) => b.length - a.length)
    .find((p) => pathname === p || pathname.startsWith(p + "/"));
  const title = matched ? navTitles[matched] : "California Stores";

  return (
    <header className="h-14 sm:h-16 bg-background border-b px-2 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={toggle} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium leading-tight">{user?.email ?? "Usuário"}</p>
          <p className="text-xs text-muted-foreground leading-tight">Operador</p>
        </div>
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initialsFromEmail(user?.email)}
          </AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}