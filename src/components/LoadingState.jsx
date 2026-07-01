function LoadingState({ cards = 3, label = "Cargando contenido" }) {
  return (
    <section
      className="loading-state"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: cards }, (_, indice) => (
        <article className="loading-card" key={indice} aria-hidden="true">
          <div className="loading-line loading-line-short" />
          <div className="loading-teams">
            <div className="loading-circle" />
            <div className="loading-line" />
            <div className="loading-circle" />
          </div>
          <div className="loading-line loading-line-action" />
        </article>
      ))}
    </section>
  );
}

export default LoadingState;
