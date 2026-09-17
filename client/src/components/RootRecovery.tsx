import { Component, type ReactNode } from "react";

/**
 * Última red de seguridad para toda la app (menú, footer, carrito incluidos).
 * Si algo falla fuera de las páginas, vuelve a montar la app una vez en lugar de dejarla en blanco.
 * Si falla de nuevo enseguida, muestra el aviso con el detalle del error.
 */
export default class RootRecovery extends Component<{ children: ReactNode }, { error: Error | null; attempt: number }> {
  state = { error: null as Error | null, attempt: 0 };
  private lastRecovery = 0;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const now = Date.now();
    if (now - this.lastRecovery > 5000) {
      this.lastRecovery = now;
      console.warn("[ui] recuperando la app tras un error", error);
      this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 620, margin: "80px auto", padding: "0 20px" }}>
          <h1 style={{ color: "#15426e", fontSize: 26 }}>The page didn't load</h1>
          <p>Please reload. If this keeps happening, send this information to support@peptivasupplies.com.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ background: "#15426e", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600 }}>
            Reload page
          </button>
          <pre style={{ marginTop: 24, whiteSpace: "pre-wrap", background: "#f2f5f9", padding: 14, borderRadius: 12, fontSize: 12 }}>
            {`${this.state.error.name}: ${this.state.error.message}\n\nURL: ${window.location.href}\n${navigator.userAgent}`}
          </pre>
        </div>
      );
    }
    return <div key={this.state.attempt} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
