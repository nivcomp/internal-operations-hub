import { createContext, useContext } from "react";
import type { ViewKey } from "../views";

export type RecentItem = {
  id: string;
  kind: "project" | "client" | "supplier";
  label: string;
  sublabel?: string;
};

export type NavApi = {
  activeView: ViewKey;
  allowedViews: ViewKey[];
  navigate: (view: ViewKey) => void;
  goBack: () => void;
  canGoBack: boolean;
  openProject: (projectId: string) => void;
  openClient: (clientId: string) => void;
  openSupplier: (supplierId: string) => void;
  openClientPortal: (clientId: string) => void;
  openSupplierPortal: (supplierId: string) => void;
  recents: RecentItem[];
  selectedProjectId?: string;
  selectedClientId?: string;
  selectedSupplierId?: string;
};

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const context = useContext(NavContext);
  if (!context) throw new Error("useNav must be used inside the app shell");
  return context;
}