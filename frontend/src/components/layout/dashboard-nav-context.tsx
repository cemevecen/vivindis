"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DashboardNavContextValue = {
  openMenu: () => void;
  closeMenu: () => void;
  menuOpen: boolean;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

export function DashboardNavProvider({
  value,
  children,
}: {
  value: DashboardNavContextValue;
  children: ReactNode;
}) {
  return <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>;
}

export function useDashboardNav(): DashboardNavContextValue | null {
  return useContext(DashboardNavContext);
}
