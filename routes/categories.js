const express = require("express");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/categories", async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { boutiqueId: res.locals.currentUser.boutiqueId },
    orderBy: { nom: "asc" },
  });
  res.render("categories/liste", { categories, erreur: null });
});

router.post("/categories", async (req, res) => {
  const nom = (req.body.nom || "").trim();
  const boutiqueId = res.locals.currentUser.boutiqueId;

  if (!nom || nom.length > 50) {
    const categories = await prisma.category.findMany({
      where: { boutiqueId },
      orderBy: { nom: "asc" },
    });
    return res.status(400).render("categories/liste", {
      categories,
      erreur: "Le nom de la catégorie doit contenir entre 1 et 50 caractères.",
    });
  }

  await prisma.category.upsert({
    where: { boutiqueId_nom: { boutiqueId, nom } },
    update: {},
    create: { nom, boutiqueId },
  });

  res.redirect("/categories");
});

router.post("/categories/:id/supprimer", async (req, res) => {
  await prisma.category.deleteMany({
    where: { id: Number(req.params.id), boutiqueId: res.locals.currentUser.boutiqueId },
  });
  res.redirect("/categories");
});

module.exports = router;
