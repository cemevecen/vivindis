"use client";

import { Menu } from "lucide-react";

import { useDashboardNav } from "@/components/layout/dashboard-nav-context";
import { Button } from "@/components/ui/button";

export function MobileNavButton() {
  const nav = useDashboardNav();

  if (!nav) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="md:hidden"
      aria-expanded={nav.menuOpen}
      aria-controls="dashboard-sidebar"
      aria-label="Open navigation menu"
      onClick={nav.openMenu}
    >
      <Menu className="size-5" aria-hidden />
    </Button>
  );
}
