const express = require("express");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function validerObjectif({ montantCible, dateLimite }) {
  const erreurs = [];
  const montantNombre = Number(montantCible);
  if (!montantCible || Number.isNaN(montantNombre) || montantNombre <= 0 || montantNombre > 999999999) {
    erreurs.push("Le montant cible doit être un nombre supérieur à 0.");
  }
  if (!dateLimite || Number.isNaN(Date.parse(dateLimite))) {
    erreurs.push("La date limite est invalide.");
  } else if (dateLimite < new Date().toISOString().slice(0, 10)) {
    // Comparaison de chaînes AAAA-MM-JJ : évite tout décalage de fuseau horaire
    // entre l'analyse de la date saisie et celle du jour courant.
    erreurs.push("La date limite doit être dans le futur.");
  }
  return erreurs;
}

async function chargerObjectifCourant(boutiqueId) {
  const objectif = await prisma.goal.findFirst({
    where: { boutiqueId },
    orderBy: { createdAt: "desc" },
  });
  if (!objectif) return null;

  const debutJourCreation = new Date(objectif.createdAt);
  debutJourCreation.setHours(0, 0, 0, 0);

  const { _sum } = await prisma.transaction.aggregate({
    where: { boutiqueId, type: "EPARGNE", date: { gte: debutJourCreation } },
    _sum: { montant: true },
  });

  const epargneAccumulee = Number(_sum.montant || 0);
  const montantCible = Number(objectif.montantCible);
  const pourcentage = montantCible > 0 ? Math.min(100, Math.round((epargneAccumulee / montantCible) * 100)) : 0;
  const joursRestants = Math.ceil((objectif.dateLimite - new Date()) / (1000 * 60 * 60 * 24));

  return { ...objectif, montantCible, epargneAccumulee, pourcentage, joursRestants };
}

router.use(requireAuth);

router.get("/objectifs", async (req, res) => {
  const boutiqueId = res.locals.currentUser.boutiqueId;
  const objectif = await chargerObjectifCourant(boutiqueId);
  const historique = await prisma.goal.findMany({
    where: { boutiqueId, ...(objectif ? { id: { not: objectif.id } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.render("goals/afficher", {
    objectif,
    historique: historique.map((h) => ({
      ...h,
      montantCible: Number(h.montantCible),
    })),
  });
});

router.get("/objectifs/nouveau", (req, res) => {
  res.render("goals/formulaire", { erreurs: [], objectif: { montantCible: "", dateLimite: "" } });
});

router.post("/objectifs", async (req, res) => {
  const { montantCible, dateLimite } = req.body;
  const erreurs = validerObjectif({ montantCible, dateLimite });

  if (erreurs.length > 0) {
    return res.status(400).render("goals/formulaire", { erreurs, objectif: { montantCible, dateLimite } });
  }

  await prisma.goal.create({
    data: {
      montantCible: Number(montantCible),
      dateLimite: new Date(dateLimite),
      userId: req.session.userId,
      boutiqueId: res.locals.currentUser.boutiqueId,
    },
  });

  req.session.flash = { type: "succes", text: "Objectif défini ✓" };
  res.redirect("/objectifs");
});

router.get("/objectifs/modifier", async (req, res) => {
  const objectif = await prisma.goal.findFirst({
    where: { boutiqueId: res.locals.currentUser.boutiqueId },
    orderBy: { createdAt: "desc" },
  });
  if (!objectif) return res.redirect("/objectifs");

  res.render("goals/formulaire", {
    erreurs: [],
    objectif: {
      montantCible: objectif.montantCible.toString(),
      dateLimite: objectif.dateLimite.toISOString().slice(0, 10),
    },
    modeEdition: true,
  });
});

router.post("/objectifs/modifier", async (req, res) => {
  const objectif = await prisma.goal.findFirst({
    where: { boutiqueId: res.locals.currentUser.boutiqueId },
    orderBy: { createdAt: "desc" },
  });
  if (!objectif) return res.redirect("/objectifs");

  const { montantCible, dateLimite } = req.body;
  const erreurs = validerObjectif({ montantCible, dateLimite });

  if (erreurs.length > 0) {
    return res.status(400).render("goals/formulaire", {
      erreurs,
      objectif: { montantCible, dateLimite },
      modeEdition: true,
    });
  }

  await prisma.goal.update({
    where: { id: objectif.id },
    data: { montantCible: Number(montantCible), dateLimite: new Date(dateLimite) },
  });

  req.session.flash = { type: "succes", text: "Objectif mis à jour ✓" };
  res.redirect("/objectifs");
});

router.post("/objectifs/supprimer", async (req, res) => {
  const objectif = await prisma.goal.findFirst({
    where: { boutiqueId: res.locals.currentUser.boutiqueId },
    orderBy: { createdAt: "desc" },
  });
  if (objectif) {
    await prisma.goal.delete({ where: { id: objectif.id } });
  }
  req.session.flash = { type: "succes", text: "Objectif supprimé ✓" };
  res.redirect("/objectifs");
});

module.exports = router;
