const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

export function obtenerCuentaRegresiva(fecha, ahora = new Date()) {
  if (!fecha) {
    return null;
  }

  const objetivo = new Date(fecha).getTime();
  const momento = ahora instanceof Date ? ahora.getTime() : new Date(ahora).getTime();

  if (!Number.isFinite(objetivo) || !Number.isFinite(momento)) {
    return null;
  }

  const restante = objetivo - momento;

  if (restante <= 0) {
    return null;
  }

  const dias = Math.floor(restante / DIA_MS);
  const horas = Math.floor((restante % DIA_MS) / HORA_MS);
  const minutos = Math.floor((restante % HORA_MS) / MINUTO_MS);

  let texto;

  if (dias > 0) {
    texto = `Faltan ${dias} d ${horas} h`;
  } else if (horas > 0) {
    texto = `Faltan ${horas} h ${minutos} min`;
  } else if (minutos > 0) {
    texto = `Faltan ${minutos} min`;
  } else {
    texto = "Falta menos de 1 min";
  }

  return {
    texto,
    restante,
    urgente: restante <= 3 * HORA_MS,
    dentroDe72Horas: restante <= 72 * HORA_MS,
  };
}
