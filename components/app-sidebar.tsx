// components/app-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Crown, Shield, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HiKontaIcon } from "@/components/shared/hikonta-icon";
import { HiKontaTitle } from "@/components/shared/hikonta-title";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Mismo patrón visual que components/app-sidebar.tsx en yelifin-sistema —
// misma librería de componentes (components/ui/sidebar.tsx, portado
// verbatim), pero con variant="sidebar" (pegada, sin el padding/gap de
// variant="floating" que usa el producto principal) y sin submenús, ya que
// acá no hacen falta.
const NAV = [
  { title: "Resumen",         url: "/dashboard", icon: Home },
  { title: "Usuarios",        url: "/users",      icon: Users },
  { title: "Planes",          url: "/plans",      icon: Crown },
  { title: "Administradores", url: "/admins",     icon: Shield },
];

type NavItem = (typeof NAV)[number];

const navIconCls = "flex items-center justify-center size-7 rounded-full group-hover/navbtn:bg-sidebar-accent-foreground/10 group-data-[active=true]/navbtn:bg-sidebar-accent-foreground/10 transition-colors shrink-0";

function CollapsedItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild isActive={active} className="justify-center">
            <Link href={item.url} onClick={onClick}>
              <Icon className="size-4" />
            </Link>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-foreground text-background">
          <span className="text-sm font-medium text-background">{item.title}</span>
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

function ExpandedItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className="group/navbtn h-11 hover:rounded-xl data-[active=true]:rounded-xl"
      >
        <Link href={item.url} onClick={onClick}>
          <span className={navIconCls}>
            <Icon className="size-4 shrink-0" />
          </span>
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, state, setOpenMobile, toggleSidebar } = useSidebar();

  const isCollapsed = !isMobile && state === "collapsed";
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };
  const isActive = (url: string) => (url === "/dashboard" ? pathname === url : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="sticky top-0 h-svh">
      {/* ── Header ── */}
      <SidebarHeader className="px-4 py-3">
        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "justify-between gap-2")}>
          <Link href="/dashboard" onClick={closeOnMobile} className="flex items-center gap-2">
            <HiKontaIcon className="size-8" />
            {!isCollapsed && <HiKontaTitle className="h-5" />}
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex"
          >
            {isCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </SidebarHeader>

      {/* ── Content ── */}
      <SidebarContent>
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) =>
                isCollapsed
                  ? <CollapsedItem key={item.url} item={item} active={isActive(item.url)} onClick={closeOnMobile} />
                  : <ExpandedItem  key={item.url} item={item} active={isActive(item.url)} onClick={closeOnMobile} />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
