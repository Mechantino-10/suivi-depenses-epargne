const express = require("express");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");
const { genererCodeInvitationUnique } = require("../utils/codeInvitation");

const router = express.Router();

router.use(requireAuth);

router.get("/boutique", async (req, res) => {
  const currentUser = res.locals.currentUser;
  const membres = await prisma.user.findMany({
    where: { boutiqueId: currentUser.boutiqueId },
    select: { id: true, nom: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.render("boutique/afficher", { boutique: currentUser.boutique, membres, erreur: null });
});

router.post("/boutique", async (req, res) => {
  const currentUser = res.locals.currentUser;
  if (currentUser.role !== "PROPRIETAIRE") {
    req.session.flash = { type: "erreur", text: "Seul le propriétaire peut renommer la boutique." };
    return res.redirect("/boutique");
  }

  const nom = (req.body.nom || "").trim();
  if (!nom || nom.length > 100) {
    const membres = await prisma.user.findMany({
      where: { boutiqueId: currentUser.boutiqueId },
      select: { id: true, nom: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return res.status(400).render("boutique/afficher", {
      boutique: currentUser.boutique,
      membres,
      erreur: "Le nom de la boutique doit contenir entre 1 et 100 caractères.",
    });
  }

  await prisma.boutique.update({ where: { id: currentUser.boutiqueId }, data: { nom } });
  req.session.flash = { type: "succes", text: "Boutique renommée ✓" };
  res.redirect("/boutique");
});

router.post("/boutique/regenerer-code", async (req, res) => {
  const currentUser = res.locals.currentUser;
  if (currentUser.role !== "PROPRIETAIRE") {
    req.session.flash = { type: "erreur", text: "Seul le propriétaire peut régénérer le code." };
    return res.redirect("/boutique");
  }

  const codeInvitation = await genererCodeInvitationUnique(prisma);
  await prisma.boutique.update({ where: { id: currentUser.boutiqueId }, data: { codeInvitation } });
  req.session.flash = { type: "succes", text: "Nouveau code généré ✓" };
  res.redirect("/boutique");
});

module.exports = router;
