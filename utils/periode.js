const LIBELLES_PERIODE = {
  jour: "Aujourd'hui",
  semaine: "Cette semaine",
  mois: "Ce mois",
};

function debutPeriode(periode) {
  const maintenant = new Date();
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);

  if (periode === "semaine") {
    const jour = debut.getDay() === 0 ? 7 : debut.getDay(); // lundi = 1 ... dimanche = 7
    debut.setDate(debut.getDate() - (jour - 1));
  } else if (periode === "mois") {
    debut.setDate(1);
  }
  return debut;
}

module.exports = { debutPeriode, LIBELLES_PERIODE };
