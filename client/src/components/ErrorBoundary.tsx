import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Rendering failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <div className="brand-mark">TP</div>
          <h1>Trip Planner needs to reload</h1>
          <p>Your saved trip data is safe on the server.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
