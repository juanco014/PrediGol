import { useState } from "react";
import { getTeamLogo } from "../utils/teamLogos.js";

function obtenerIniciales(nombre) {
  const palabras = String(nombre || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (palabras.length === 0) {
    return "PG";
  }

  if (palabras.length === 1) {
    return palabras[0].slice(0, 3).toUpperCase();
  }

  return palabras
    .slice(0, 3)
    .map((palabra) => palabra.charAt(0))
    .join("")
    .toUpperCase();
}

function TeamLogo({ teamName, logoUrl, size = "medium", className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedLogoUrl = logoUrl || getTeamLogo(teamName);
  const canShowImage = Boolean(resolvedLogoUrl && !imageFailed);
  const classes = ["team-logo", `team-logo-${size}`, className]
    .filter(Boolean)
    .join(" ");
  const accessibleName = teamName || "Equipo";

  if (canShowImage) {
    return (
      <span className={classes}>
        <img
          src={resolvedLogoUrl}
          alt={`Escudo de ${accessibleName}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={`${classes} team-logo-fallback`} aria-label={accessibleName}>
      {obtenerIniciales(accessibleName)}
    </span>
  );
}

export default TeamLogo;
