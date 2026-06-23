import { useNavigate } from "react-router-dom";

function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="app">
      <section className="hero">
        <p className="brand">PREDIGOL</p>

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
      </section>
    </main>
  );
}

export default LandingPage;