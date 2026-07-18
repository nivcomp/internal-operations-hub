import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: "2rem", fontFamily: "Inter, system-ui, sans-serif", maxWidth: 640, margin: "4rem auto" }}>
        <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
        <p style={{ color: "#475569" }}>
          The app hit an unexpected error while rendering. Reloading usually fixes it.
        </p>
        <pre style={{ background: "#f1f5f9", padding: "0.75rem 1rem", borderRadius: 8, overflow: "auto", fontSize: 12 }}>
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "white", cursor: "pointer" }}
        >
          Reload
        </button>
      </div>
    );
  }
}