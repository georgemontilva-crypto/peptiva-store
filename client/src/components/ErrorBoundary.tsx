import { Component, type ReactNode } from "react";

/** Evita la pantalla en blanco si una sección falla: muestra un aviso con opción de recargar. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ui] error de render", error);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-3xl font-bold">This page didn't load correctly</h1>
        <p className="mt-3 text-slate">Reload to try again. If it keeps happening, contact support@peptivasupplies.com.</p>
        <button type="button" className="btn btn-primary mt-8" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
