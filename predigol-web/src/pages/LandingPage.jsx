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
          <span>Pronosticos deportivos con datos</span>
        </div>

        <h1>Pronosticos de futbol claros para decidir mejor tu jugada.</h1>

        <p className="subtitle">
          Consulta probabilidades 1X2, marcador probable y confianza del modelo principal de PrediGol. Empieza gratis y deja preparada tu experiencia premium para mas ligas y mas detalle.
        </p>

        <div className="landing-actions">
          <button className="start-button" onClick={() => navigate("/auth")}>Ver pronosticos gratis</button>
          <button className="secondary-start-button" onClick={() => navigate("/auth")}>Iniciar sesion</button>
        </div>

        <div className="hero-highlights" aria-label="Beneficios de PrediGol">
          <span>
            <strong>Gratis</strong>
            Pronosticos basicos
          </span>
          <span>
            <strong>1X2</strong>
            Local, empate, visita
          </span>
          <span>
            <strong>Premium</strong>
            Mas detalle pronto
          </span>
        </div>
      </section>

      <section className="landing-section-grid" aria-label="Como funciona PrediGol">
        <article>
          <span>1</span>
          <h2>Datos reales</h2>
          <p>Importamos partidos y resultados desde fuentes deportivas para alimentar el modelo.</p>
        </article>
        <article>
          <span>2</span>
          <h2>Modelo principal V1</h2>
          <p>Generamos probabilidades y marcador probable con el modelo estable de produccion.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Pronosticos claros</h2>
          <p>Mostramos la prediccion principal, confianza y contexto sin prometer resultados.</p>
        </article>
      </section>

      <section className="landing-plan-grid" aria-label="Planes PrediGol">
        <article>
          <p className="section-label">GRATIS</p>
          <h2>Para empezar hoy</h2>
          <ul>
            <li>Pronosticos destacados</li>
            <li>Probabilidades 1X2 basicas</li>
            <li>Marcador probable cuando exista</li>
            <li>Ranking y favoritos basicos</li>
          </ul>
        </article>
        <article>
          <p className="section-label">PREMIUM PRONTO</p>
          <h2>Mas ligas y analisis</h2>
          <ul>
            <li>Mas partidos y competiciones</li>
            <li>Historico y tendencias ampliadas</li>
            <li>Alertas y favoritos avanzados</li>
            <li>Estadisticas premium protegidas desde servidor</li>
          </ul>
        </article>
      </section>

      <section className="responsible-note landing-responsible-note">
        Los pronosticos de PrediGol son estimaciones estadisticas con fines informativos y no garantizan resultados deportivos.
      </section>
    </main>
  );
}

export default LandingPage;
