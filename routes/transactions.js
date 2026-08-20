const express = require("express");
const PDFDocument = require("pdfkit");
const prisma = require("../prisma/client");
const { requireAuth } = require("../middleware/auth");
const { debutPeriode } = require("../utils/periode");

const router = express.Router();

const TYPES_VALIDES = ["DEPENSE", "REVENU", "EPARGNE"];
const PAR_PAGE = 20;

async function chargerCategories(boutiqueId) {
  const categories = await prisma.category.findMany({
    where: { boutiqueId },
    orderBy: { nom: "asc" },
  });
  return categories.map((c) => c.nom);
}

function validerTransaction({ type, categorie, montant, date, description }) {
  const erreurs = [];
  if (!TYPES_VALIDES.includes(type)) {
    erreurs.push("Le type de transaction est invalide.");
  }
  if (!categorie || categorie.trim().length === 0 || categorie.trim().length > 50) {
    erreurs.push("La catégorie est obligatoire (50 caractères maximum).");
  }
  const montantNombre = Number(montant);
  if (!montant || Number.isNaN(montantNombre) || montantNombre <= 0 || montantNombre > 999999999) {
    erreurs.push("Le montant doit être un nombre supérieur à 0.");
  }
  if (!date || Number.isNaN(Date.parse(date))) {
    erreurs.push("La date est invalide.");
  }
  if (description && description.length > 200) {
    erreurs.push("La description est limitée à 200 caractères.");
  }
  return erreurs;
}

function construireFiltre(boutiqueId, query) {
  const { type, categorie, periode, recherche } = query;
  const where = { boutiqueId };
  if (type && TYPES_VALIDES.includes(type)) where.type = type;
  if (categorie) where.categorie = categorie;
  if (periode && ["jour", "semaine", "mois"].includes(periode)) {
    where.date = { gte: debutPeriode(periode) };
  }
  if (recherche && recherche.trim()) {
    const terme = recherche.trim().slice(0, 100);
    where.OR = [
      { categorie: { contains: terme, mode: "insensitive" } },
      { description: { contains: terme, mode: "insensitive" } },
    ];
  }
  return where;
}

function echapperCsv(valeur) {
  let texte = String(valeur ?? "");
  // Empêche l'injection de formule (Excel/LibreOffice) si le champ commence par =, +, -, @, tabulation ou retour chariot
  if (/^[=+\-@\t\r]/.test(texte)) {
    texte = "'" + texte;
  }
  if (/[",\n]/.test(texte)) {
    texte = `"${texte.replace(/"/g, '""')}"`;
  }
  return texte;
}

router.use(requireAuth);

router.get("/transactions", async (req, res) => {
  const { type, categorie, periode, recherche } = req.query;
  const boutiqueId = res.locals.currentUser.boutiqueId;
  const where = construireFiltre(boutiqueId, req.query);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [transactions, total, categoriesExistantes] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAR_PAGE,
      take: PAR_PAGE,
      include: { user: { select: { nom: true } } },
    }),
    prisma.transaction.count({ where }),
    chargerCategories(boutiqueId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  res.render("transactions/liste", {
    transactions,
    categoriesExistantes,
    filtres: { type: type || "", categorie: categorie || "", periode: periode || "", recherche: recherche || "" },
    pagination: { page: Math.min(page, totalPages), totalPages, total },
  });
});

router.get("/transactions/export.csv", async (req, res) => {
  const where = construireFiltre(res.locals.currentUser.boutiqueId, req.query);
  const transactions = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });

  const lignes = ["Date,Type,Catégorie,Montant,Description"];
  transactions.forEach((t) => {
    lignes.push(
      [
        t.date.toISOString().slice(0, 10),
        t.type,
        echapperCsv(t.categorie),
        Number(t.montant).toFixed(2),
        echapperCsv(t.description || ""),
      ].join(",")
    );
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + lignes.join("\n"));
});

router.get("/transactions/export.pdf", async (req, res) => {
  const where = construireFiltre(res.locals.currentUser.boutiqueId, req.query);
  const transactions = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.pdf"`
  );

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(16).text("Relevé de transactions", { align: "center" });
  doc
    .fontSize(9)
    .fillColor("#666666")
    .text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, { align: "center" });
  doc.moveDown(1.5);

  const colonnes = { date: 40, type: 110, categorie: 190, montant: 340, description: 420 };

  doc.fontSize(9).fillColor("#000000");
  doc.text("Date", colonnes.date, doc.y, { continued: false });
  doc.text("Type", colonnes.type, doc.y - doc.currentLineHeight());
  doc.text("Catégorie", colonnes.categorie, doc.y - doc.currentLineHeight());
  doc.text("Montant", colonnes.montant, doc.y - doc.currentLineHeight());
  doc.text("Description", colonnes.description, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);
  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .strokeColor("#cccccc")
    .stroke();
  doc.moveDown(0.3);

  let totalRevenu = 0;
  let totalDepense = 0;
  let totalEpargne = 0;

  transactions.forEach((t) => {
    const montant = Number(t.montant);
    if (t.type === "REVENU") totalRevenu += montant;
    if (t.type === "DEPENSE") totalDepense += montant;
    if (t.type === "EPARGNE") totalEpargne += montant;

    if (doc.y > 780) doc.addPage();

    const y = doc.y;
    const signe = t.type === "DEPENSE" ? "-" : "+";
    doc.fontSize(9).fillColor("#000000");
    doc.text(t.date.toISOString().slice(0, 10), colonnes.date, y, { width: 65 });
    doc.text(t.type, colonnes.type, y, { width: 75 });
    doc.text(t.categorie, colonnes.categorie, y, { width: 145 });
    doc.text(`${signe}${montant.toLocaleString("fr-FR")} FCFA`, colonnes.montant, y, { width: 75 });
    doc.text(t.description || "", colonnes.description, y, { width: 115 });
    doc.moveDown(0.6);
  });

  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#000000");
  doc.text(`Total revenus : +${totalRevenu.toLocaleString("fr-FR")} FCFA`);
  doc.text(`Total dépenses : -${totalDepense.toLocaleString("fr-FR")} FCFA`);
  doc.text(`Total épargne : ${totalEpargne.toLocaleString("fr-FR")} FCFA`);
  doc
    .font("Helvetica-Bold")
    .text(`Solde : ${(totalRevenu - totalDepense - totalEpargne).toLocaleString("fr-FR")} FCFA`);

  doc.end();
});

router.get("/transactions/nouvelle", async (req, res) => {
  res.render("transactions/formulaire", {
    erreurs: [],
    transaction: { type: "DEPENSE", categorie: "", montant: "", date: new Date().toISOString().slice(0, 10), description: "" },
    categoriesSuggestions: await chargerCategories(res.locals.currentUser.boutiqueId),
    modeEdition: false,
  });
});

router.post("/transactions", async (req, res) => {
  const { type, categorie, montant, date, description } = req.body;
  const erreurs = validerTransaction({ type, categorie, montant, date, description });

  if (erreurs.length > 0) {
    return res.status(400).render("transactions/formulaire", {
      erreurs,
      transaction: { type, categorie, montant, date, description },
      categoriesSuggestions: await chargerCategories(res.locals.currentUser.boutiqueId),
      modeEdition: false,
    });
  }

  await prisma.transaction.create({
    data: {
      type,
      categorie: categorie.trim(),
      montant: Number(montant),
      date: new Date(date),
      description: description && description.trim() ? description.trim() : null,
      userId: req.session.userId,
      boutiqueId: res.locals.currentUser.boutiqueId,
    },
  });

  req.session.flash = { type: "succes", text: "Transaction ajoutée ✓" };
  res.redirect("/transactions");
});

router.get("/transactions/:id/modifier", async (req, res) => {
  const transaction = await prisma.transaction.findFirst({
    where: { id: Number(req.params.id), boutiqueId: res.locals.currentUser.boutiqueId },
  });
  if (!transaction) return res.redirect("/transactions");

  res.render("transactions/formulaire", {
    erreurs: [],
    transaction: {
      ...transaction,
      montant: transaction.montant.toString(),
      date: transaction.date.toISOString().slice(0, 10),
      description: transaction.description || "",
    },
    categoriesSuggestions: await chargerCategories(res.locals.currentUser.boutiqueId),
    modeEdition: true,
    id: transaction.id,
  });
});

router.post("/transactions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existant = await prisma.transaction.findFirst({
    where: { id, boutiqueId: res.locals.currentUser.boutiqueId },
  });
  if (!existant) return res.redirect("/transactions");

  const { type, categorie, montant, date, description } = req.body;
  const erreurs = validerTransaction({ type, categorie, montant, date, description });

  if (erreurs.length > 0) {
    return res.status(400).render("transactions/formulaire", {
      erreurs,
      transaction: { type, categorie, montant, date, description },
      categoriesSuggestions: await chargerCategories(res.locals.currentUser.boutiqueId),
      modeEdition: true,
      id,
    });
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type,
      categorie: categorie.trim(),
      montant: Number(montant),
      date: new Date(date),
      description: description && description.trim() ? description.trim() : null,
    },
  });

  req.session.flash = { type: "succes", text: "Transaction mise à jour ✓" };
  res.redirect("/transactions");
});

router.post("/transactions/:id/supprimer", async (req, res) => {
  await prisma.transaction.deleteMany({
    where: { id: Number(req.params.id), boutiqueId: res.locals.currentUser.boutiqueId },
  });
  req.session.flash = { type: "succes", text: "Transaction supprimée ✓" };
  res.redirect("/transactions");
});

module.exports = router;
