import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="app">
      <div className="landing-orb landing-orb-primary" aria-hidden="true" />
      <div className="landing-orb landing-orb-secondary" aria-hidden="true" />

      <section className="hero">
        <div className="hero-kicker">
          <p className="brand">PREDIGOL</p>
          <span>Futbol, datos y competencia</span>
        </div>

        <h1>Demuestra que sabes de fútbol.</h1>

        <p className="subtitle">
          Predice los resultados, suma puntos y compite con tus amigos.
        </p>

        <button
          className="start-button"
          onClick={() => navigate("/auth")}
        >
          Comenzar a pronosticar
        </button>

        <div className="hero-highlights" aria-label="Beneficios de PrediGol">
          <span>
            <strong>+3 pts</strong>
            Marcador exacto
          </span>
          <span>
            <strong>En vivo</strong>
            Partidos actualizados
          </span>
          <span>
            <strong>Ligas</strong>
            Retos con amigos
          </span>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
