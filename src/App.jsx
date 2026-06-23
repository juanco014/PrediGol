import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import RankingPage from "./pages/RankingPage";
import LigasPage from "./pages/LigasPage";
import ProfilePage from "./pages/ProfilePage";
import LigaDetailPage from "./pages/LigaDetailPage";
import "./App.css";

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
        path="/perfil"
        element={
          <ProtectedRoute session={session}>
            <ProfilePage session={session} />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={session ? "/inicio" : "/"} replace />}
      />
    </Routes>
  );
}

export default App;
