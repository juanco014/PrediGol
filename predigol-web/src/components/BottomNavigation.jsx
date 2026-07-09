import { Medal, Search, Target, Trophy, UserRound, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

function BottomNavigation({ activePage }) {
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <div className="nav-brand" aria-hidden="true">
        PG
      </div>
      <button
        type="button"
        title="Partidos"
        className={`nav-item ${activePage === "partidos" ? "active" : ""}`}
        aria-current={activePage === "partidos" ? "page" : undefined}
        onClick={() => navigate("/inicio")}
      >
        <Trophy size={20} />
        <span>Partidos</span>
      </button>

      <button
        type="button"
        title="Explorar fútbol"
        className={`nav-item ${activePage === "explorar" ? "active" : ""}`}
        aria-current={activePage === "explorar" ? "page" : undefined}
        onClick={() => navigate("/explorar")}
      >
        <Search size={20} />
        <span>Explorar</span>
      </button>

      <button
        type="button"
        title="Mis pronósticos"
        className={`nav-item ${activePage === "pronosticos" ? "active" : ""}`}
        aria-current={activePage === "pronosticos" ? "page" : undefined}
        onClick={() => navigate("/pronosticos")}
      >
        <Target size={20} />
        <span>Pronósticos</span>
      </button>

      <button
        type="button"
        title="Ranking global"
        className={`nav-item ${activePage === "ranking" ? "active" : ""}`}
        aria-current={activePage === "ranking" ? "page" : undefined}
        onClick={() => navigate("/ranking")}
      >
        <Medal size={20} />
        <span>Ranking</span>
      </button>

      <button
        type="button"
        title="Ligas privadas"
        className={`nav-item ${activePage === "ligas" ? "active" : ""}`}
        aria-current={activePage === "ligas" ? "page" : undefined}
        onClick={() => navigate("/ligas")}
      >
        <Users size={20} />
        <span>Ligas</span>
      </button>

      <button
        type="button"
        title="Mi perfil"
        className={`nav-item ${activePage === "perfil" ? "active" : ""}`}
        aria-current={activePage === "perfil" ? "page" : undefined}
        onClick={() => navigate("/perfil")}
      >
        <UserRound size={20} />
        <span>Perfil</span>
      </button>
    </nav>
  );
}

export default BottomNavigation;
