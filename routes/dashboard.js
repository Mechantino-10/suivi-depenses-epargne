const express = require("express");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");
const { debutPeriode, LIBELLES_PERIODE } = require("../utils/periode");

const router = express.Router();

const JOURS_EVOLUTION = 14;

async function chargerEvolutionSolde(boutiqueId) {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (JOURS_EVOLUTION - 1));

  const transactions = await prisma.transaction.findMany({
    where: { boutiqueId, date: { gte: debut } },
    select: { date: true, montant: true, type: true },
  });

  const netParJour = new Map();
  transactions.forEach((t) => {
    const cle = t.date.toISOString().slice(0, 10);
    const signe = t.type === "DEPENSE" || t.type === "EPARGNE" ? -1 : 1;
    netParJour.set(cle, (netParJour.get(cle) || 0) + signe * Number(t.montant));
  });

  const jours = [];
  for (let i = 0; i < JOURS_EVOLUTION; i++) {
    const d = new Date(debut);
    d.setDate(d.getDate() + i);
    const cle = d.toISOString().slice(0, 10);
    jours.push({ date: d, net: netParJour.get(cle) || 0 });
  }

  const maxAbs = Math.max(1, ...jours.map((j) => Math.abs(j.net)));
  return jours.map((j) => ({
    ...j,
    hauteur: Math.round((Math.abs(j.net) / maxAbs) * 40),
    positif: j.net >= 0,
  }));
}

router.get("/", requireAuth, async (req, res) => {
  const periode = ["jour", "semaine", "mois"].includes(req.query.periode) ? req.query.periode : "mois";
  const boutiqueId = res.locals.currentUser.boutiqueId;
  const where = { boutiqueId, date: { gte: debutPeriode(periode) } };

  const [totauxParType, repartitionCategories, evolution] = await Promise.all([
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { montant: true } }),
    prisma.transaction.groupBy({
      by: ["categorie"],
      where: { ...where, type: "DEPENSE" },
      _sum: { montant: true },
      orderBy: { _sum: { montant: "desc" } },
    }),
    chargerEvolutionSolde(boutiqueId),
  ]);

  const totaux = { DEPENSE: 0, REVENU: 0, EPARGNE: 0 };
  totauxParType.forEach((t) => {
    totaux[t.type] = Number(t._sum.montant || 0);
  });
  const solde = totaux.REVENU - totaux.DEPENSE - totaux.EPARGNE;

  const totalDepenses = totaux.DEPENSE;
  const categories = repartitionCategories.map((c) => {
    const montant = Number(c._sum.montant || 0);
    return {
      categorie: c.categorie,
      montant,
      pourcentage: totalDepenses > 0 ? Math.round((montant / totalDepenses) * 100) : 0,
    };
  });

  res.render("dashboard", {
    periode,
    libellesPeriode: LIBELLES_PERIODE,
    totaux,
    solde,
    categories,
    evolution,
  });
});

module.exports = router;
