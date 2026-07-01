import { CheckCircle2, CircleAlert, X } from "lucide-react";

function StatusMessage({ message, onClose, variant = "info" }) {
  if (!message) {
    return null;
  }

  const Icono = variant === "success" ? CheckCircle2 : CircleAlert;

  return (
    <div
      className={`status-message status-message-${variant}`}
      role={variant === "success" ? "status" : "alert"}
    >
      <Icono size={18} />
      <span>{message}</span>
      {onClose && (
        <button type="button" aria-label="Cerrar mensaje" onClick={onClose}>
          <X size={17} />
        </button>
      )}
    </div>
  );
}

export default StatusMessage;
