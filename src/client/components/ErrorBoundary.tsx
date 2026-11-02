import { Component, type ReactNode } from "react";
import { clearData } from "../lib/storage";

interface State {
  error: Error | null;
}

/** Last-resort recovery so a bad hash or corrupt stored data never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="screen" id="main">
        <h2>Something went wrong</h2>
        <p className="hint">The app hit an error it couldn't recover from. Reloading usually fixes it; your saved data is kept.</p>
        <div className="actions">
          <button
            className="primary"
            type="button"
            onClick={() => {
              window.location.hash = "#/today";
              window.location.reload();
            }}
          >
            Reload
          </button>
          <button
            className="link danger"
            type="button"
            onClick={() => {
              if (window.confirm("Clear all saved data in this browser and start fresh? This can't be undone.")) {
                clearData();
                window.location.hash = "#/today";
                window.location.reload();
              }
            }}
          >
            Clear saved data and start fresh
          </button>
        </div>
      </main>
    );
  }
}
