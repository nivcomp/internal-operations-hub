import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import "./client-facing.css";

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Application root is missing.");

const root = ReactDOM.createRoot(rootElement);
const joinRole = window.location.pathname === "/join/client"
  ? "client" as const
  : window.location.pathname === "/join/supplier"
    ? "supplier" as const
    : null;

async function mount() {
  const screen = joinRole
    ? React.createElement((await import("./pages/JoinPage")).JoinPage, { role: joinRole })
    : React.createElement((await import("./App")).default);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>{screen}</ErrorBoundary>
    </React.StrictMode>,
  );
}

void mount();
