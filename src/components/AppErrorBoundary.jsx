import { Component } from "react";
import { CircleAlert, House, RefreshCw } from "lucide-react";
import { registrarErrorCliente } from "../utils/errorMonitoring";

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    registrarErrorCliente(error, "react", {
      componentStack: info.componentStack?.slice(0, 1500) || null,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="fatal-error-page">
        <section>
          <CircleAlert size={34} />
          <p className="brand">PREDIGOL</p>
          <h1>Algo no salio como esperabamos</h1>
          <p>
            El error fue registrado de forma segura. Puedes recargar o volver al inicio.
          </p>
          <div>
            <button type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={18} />
              Recargar
            </button>
            <button type="button" onClick={() => window.location.assign("/inicio")}>
              <House size={18} />
              Volver al inicio
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;
