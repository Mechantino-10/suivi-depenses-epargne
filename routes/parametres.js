const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const limiteurMotDePasse = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Trop de tentatives. Réessaie dans quelques minutes.",
});

router.use(requireAuth);

router.get("/parametres", (req, res) => {
  res.render("parametres", { erreurs: [], erreursMotDePasse: [] });
});

router.post("/parametres", async (req, res) => {
  const nom = (req.body.nom || "").trim();

  if (!nom || nom.length < 2 || nom.length > 100) {
    return res.status(400).render("parametres", {
      erreurs: ["Le nom doit contenir entre 2 et 100 caractères."],
      erreursMotDePasse: [],
    });
  }

  await prisma.user.update({ where: { id: req.session.userId }, data: { nom } });
  req.session.flash = { type: "succes", text: "Nom mis à jour ✓" };
  res.redirect("/parametres");
});

router.post("/parametres/mot-de-passe", limiteurMotDePasse, async (req, res) => {
  const currentUser = res.locals.currentUser;
  const { motDePasseActuel, nouveauMotDePasse, confirmationMotDePasse } = req.body;
  const erreursMotDePasse = [];

  if (!currentUser.motDePasse) {
    erreursMotDePasse.push("Ce compte n'a pas de mot de passe (connexion via Google).");
  } else {
    const actuelValide = await bcrypt.compare(
      typeof motDePasseActuel === "string" ? motDePasseActuel.slice(0, 72) : "",
      currentUser.motDePasse
    );
    if (!actuelValide) erreursMotDePasse.push("Mot de passe actuel incorrect.");
  }

  if (!nouveauMotDePasse || nouveauMotDePasse.length < 6 || nouveauMotDePasse.length > 72) {
    erreursMotDePasse.push("Le nouveau mot de passe doit contenir entre 6 et 72 caractères.");
  } else if (nouveauMotDePasse !== confirmationMotDePasse) {
    erreursMotDePasse.push("La confirmation ne correspond pas au nouveau mot de passe.");
  }

  if (erreursMotDePasse.length > 0) {
    return res.status(400).render("parametres", { erreurs: [], erreursMotDePasse });
  }

  const motDePasseHash = await bcrypt.hash(nouveauMotDePasse, 10);
  await prisma.user.update({ where: { id: req.session.userId }, data: { motDePasse: motDePasseHash } });

  req.session.flash = { type: "succes", text: "Mot de passe modifié ✓" };
  res.redirect("/parametres");
});

module.exports = router;
