import { Medal, Trophy, UserRound, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

function BottomNavigation({ activePage }) {
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activePage === "partidos" ? "active" : ""}`}
        onClick={() => navigate("/inicio")}
      >
        <Trophy size={20} />
        <span>Partidos</span>
      </button>

      <button
        className={`nav-item ${activePage === "ranking" ? "active" : ""}`}
        onClick={() => navigate("/ranking")}
      >
        <Medal size={20} />
        <span>Ranking</span>
      </button>

      <button
        className={`nav-item ${activePage === "ligas" ? "active" : ""}`}
        onClick={() => navigate("/ligas")}
      >
        <Users size={20} />
        <span>Ligas</span>
      </button>

      <button
        className={`nav-item ${activePage === "perfil" ? "active" : ""}`}
        onClick={() => navigate("/perfil")}
      >
        <UserRound size={20} />
        <span>Perfil</span>
      </button>
    </nav>
  );
}

export default BottomNavigation;