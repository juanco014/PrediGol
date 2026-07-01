import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import "./App.css";

const HomePage = lazy(() => import("./pages/HomePage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const PronosticosPage = lazy(() => import("./pages/PronosticosPage"));
const LigasPage = lazy(() => import("./pages/LigasPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LigaDetailPage = lazy(() => import("./pages/LigaDetailPage"));
const AdminPartidosPage = lazy(() => import("./pages/AdminPartidosPage"));
const PartidoDetailPage = lazy(() => import("./pages/PartidoDetailPage"));
const NotificacionesPage = lazy(() => import("./pages/NotificacionesPage"));

function RouteLoading() {
  return (
    <main className="app-loading" aria-live="polite" aria-busy="true">
      <p>PREDIGOL</p>
      <span>Abriendo pantalla...</span>
      <div className="route-loading-bar" aria-hidden="true" />
    </main>
  );
}

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    let componenteActivo = true;

    const cargarSesion = async () => {
      const {
        data: { session: sesionActual },
      } = await supabase.auth.getSession();

      if (componenteActivo) {
        setSession(sesionActual);
        setCargandoSesion(false);
      }
    };

    cargarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, sesionActual) => {
      setSession(sesionActual);
      setCargandoSesion(false);
    });

    return () => {
      componenteActivo = false;
      subscription.unsubscribe();
    };
  }, []);

  if (cargandoSesion) {
    return (
      <main className="app-loading">
        <p>PREDIGOL</p>
        <span>Cargando tu cancha...</span>
      </main>
    );
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route
        path="/"
        element={
          session ? <Navigate to="/inicio" replace /> : <LandingPage />
        }
      />

      <Route
        path="/auth"
        element={
          session ? <Navigate to="/inicio" replace /> : <AuthPage />
        }
      />

      <Route
        path="/inicio"
        element={
          <ProtectedRoute session={session}>
            <HomePage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ranking"
        element={
          <ProtectedRoute session={session}>
            <RankingPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pronosticos"
        element={
          <ProtectedRoute session={session}>
            <PronosticosPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ligas"
        element={
          <ProtectedRoute session={session}>
            <LigasPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ligas/:ligaId"
        element={
          <ProtectedRoute session={session}>
            <LigaDetailPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/partidos/:partidoId"
        element={
          <ProtectedRoute session={session}>
            <PartidoDetailPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notificaciones"
        element={
          <ProtectedRoute session={session}>
            <NotificacionesPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/perfil"
        element={
          <ProtectedRoute session={session}>
            <ProfilePage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/partidos"
        element={
          <ProtectedRoute session={session}>
            <AdminPartidosPage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={session ? "/inicio" : "/"} replace />}
      />
      </Routes>
    </Suspense>
  );
}

export default App;
