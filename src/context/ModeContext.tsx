import { createContext, useContext } from "react";
import type { ViewKey } from "../views";

export type UiMode = "simple" | "advanced";
export type SimpleView = "home" | "crm" | "clients" | "projects" | "suppliers" | "tasks" | "finance";

export type AdvancedContext = {
  projectId?: string;
  clientId?: string;
  supplierId?: string;
  tab?: string;
};

export type ModeApi = {
  /** Simple Mode is the default surface for agency_admin; Advanced Mode is the full app. */
  mode: UiMode;
  setMode: (mode: UiMode) => void;
  simpleView: SimpleView;
  setSimpleView: (view: SimpleView) => void;
  /** Switch to the full system on an exact screen, preserving the current record. */
  openAdvanced: (view: ViewKey, context?: AdvancedContext) => void;
  backToSimple: (view?: SimpleView) => void;
  /** True when the user reached Advanced Mode from Simple Mode. */
  cameFromSimple: boolean;
};

export const ModeContext = createContext<ModeApi | null>(null);

export function useMode(): ModeApi {
  const context = useContext(ModeContext);
  if (!context) throw new Error("useMode must be used inside the app shell");
  return context;
}

export const MODE_STORAGE_KEY = "cts.ui-mode";

/** Deep-link targets the copilot and the simple cards can open in the full system. */
export const advancedTargets = {
  projectPricing: "project-detail",
  pricingMargin: "pricing-margin",
  supplierDetail: "supplier-detail",
  clientDetail: "client-detail",
  accessManagement: "access-management",
  aiUsage: "ai-usage",
  aiWorkbench: "ai-workbench",
  dashboard: "dashboard",
  actionQueue: "action-queue",
} satisfies Record<string, ViewKey>;