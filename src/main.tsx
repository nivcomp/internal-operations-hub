import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Application root is missing.");

const root = ReactDOM.createRoot(rootElement);
const joinRole = window.location.pathname === "/join/client"
  ? "client" as const
  : window.location.pathname === "/join/supplier"
    ? "supplier" as const
    : null;
const isAmirCashFlowRoute = window.location.pathname.replace(/\/+$/, "") === "/amir-cashflow";

async function mount() {
  const screen = isAmirCashFlowRoute
    ? React.createElement((await import("./pages/AmirCashFlowPage")).AmirCashFlowPage)
    : joinRole
      ? React.createElement((await import("./pages/JoinPage")).JoinPage, { role: joinRole })
      : React.createElement((await import("./App")).default);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>{screen}</ErrorBoundary>
    </React.StrictMode>,
  );
}

void mount();
