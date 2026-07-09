// Alias controlados: solo variantes suficientemente especificas y no ambiguas.
export const TEAM_ALIASES = {
  "atl nacional": "atletico nacional",
  "atletico nacional medellin": "atletico nacional",
  "a nacional": "atletico nacional",

  "america cali": "america de cali",
  "america de cali s a": "america de cali",

  "deportivo cali s a": "deportivo cali",
  "dep cali": "deportivo cali",

  "independiente medellin": "deportivo independiente medellin",
  "dep independiente medellin": "deportivo independiente medellin",
  "dim": "deportivo independiente medellin",

  "millonarios": "millonarios fc",
  "millonarios futbol club": "millonarios fc",

  "ind santa fe": "independiente santa fe",
  "santa fe bogota": "independiente santa fe",

  "junior": "junior fc",
  "atletico junior": "junior fc",
  "junior barranquilla": "junior fc",
};

export const AMBIGUOUS_TEAM_ALIASES = new Set([
  "nacional",
  "america",
  "medellin",
  "cali",
  "santa fe",
]);
