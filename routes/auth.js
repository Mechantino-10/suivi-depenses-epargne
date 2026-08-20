const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const passport = require("../config/passport");
const prisma = require("../prisma/client");
const { semerCategoriesParDefaut } = require("../utils/categoriesParDefaut");
const { genererCodeInvitationUnique } = require("../utils/codeInvitation");

const router = express.Router();

const limiteurAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Trop de tentatives. Réessaie dans quelques minutes.",
});

function validerInscription({ nom, telephone, motDePasse }) {
  const erreurs = [];
  if (!nom || nom.trim().length < 2 || nom.trim().length > 100) {
    erreurs.push("Le nom doit contenir entre 2 et 100 caractères.");
  }
  if (!telephone || !/^\+?[0-9]{8,15}$/.test(telephone.trim())) {
    erreurs.push("Le numéro de téléphone n'est pas valide (8 à 15 chiffres).");
  }
  if (!motDePasse || motDePasse.length < 6 || motDePasse.length > 72) {
    erreurs.push("Le mot de passe doit contenir entre 6 et 72 caractères.");
  }
  return erreurs;
}

router.get("/inscription", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("auth/inscription", { erreurs: [], nom: "", telephone: "", codeBoutique: "" });
});

router.post("/inscription", limiteurAuth, async (req, res) => {
  const { nom, telephone, motDePasse, codeBoutique } = req.body;
  const erreurs = validerInscription({ nom, telephone, motDePasse });
  const codeSaisi = (codeBoutique || "").trim().toUpperCase();

  let boutiqueRejointe = null;
  if (codeSaisi) {
    boutiqueRejointe = await prisma.boutique.findUnique({ where: { codeInvitation: codeSaisi } });
    if (!boutiqueRejointe) erreurs.push("Ce code boutique est invalide.");
  }

  if (erreurs.length === 0) {
    const existant = await prisma.user.findUnique({ where: { telephone: telephone.trim() } });
    if (existant) erreurs.push("Ce numéro de téléphone est déjà utilisé.");
  }

  if (erreurs.length > 0) {
    return res.status(400).render("auth/inscription", { erreurs, nom, telephone, codeBoutique: codeSaisi });
  }

  const motDePasseHash = await bcrypt.hash(motDePasse, 10);

  let boutiqueId;
  let role;
  if (boutiqueRejointe) {
    boutiqueId = boutiqueRejointe.id;
    role = "EMPLOYE";
  } else {
    const boutique = await prisma.boutique.create({
      data: {
        nom: `Boutique de ${nom.trim()}`,
        codeInvitation: await genererCodeInvitationUnique(prisma),
      },
    });
    boutiqueId = boutique.id;
    role = "PROPRIETAIRE";
    await semerCategoriesParDefaut(prisma, boutiqueId);
  }

  const user = await prisma.user.create({
    data: { nom: nom.trim(), telephone: telephone.trim(), motDePasse: motDePasseHash, boutiqueId, role },
  });

  req.session.userId = user.id;
  res.redirect("/");
});

router.get("/connexion", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("auth/connexion", { erreur: null, telephone: "" });
});

router.post("/connexion", limiteurAuth, async (req, res) => {
  const { telephone, motDePasse } = req.body;
  const motDePasseSaisi = typeof motDePasse === "string" ? motDePasse.slice(0, 72) : "";
  const user = telephone
    ? await prisma.user.findUnique({ where: { telephone: telephone.trim() } })
    : null;

  const motDePasseValide =
    user && user.motDePasse ? await bcrypt.compare(motDePasseSaisi, user.motDePasse) : false;

  if (!user || !motDePasseValide) {
    return res
      .status(400)
      .render("auth/connexion", { erreur: "Téléphone ou mot de passe incorrect.", telephone });
  }

  req.session.userId = user.id;
  res.redirect("/");
});

router.post("/deconnexion", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/connexion");
  });
});

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/connexion", session: false }),
  (req, res) => {
    req.session.userId = req.user.id;
    res.redirect("/");
  }
);

module.exports = router;
