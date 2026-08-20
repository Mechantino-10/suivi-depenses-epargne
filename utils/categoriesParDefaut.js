const CATEGORIES_PAR_DEFAUT = [
  "Marchandise / Stock",
  "Transport",
  "Loyer",
  "Électricité / Eau",
  "Salaires",
  "Ventes",
  "Épargne",
  "Autre",
];

async function semerCategoriesParDefaut(prisma, boutiqueId) {
  await prisma.category.createMany({
    data: CATEGORIES_PAR_DEFAUT.map((nom) => ({ nom, boutiqueId })),
    skipDuplicates: true,
  });
}

module.exports = { CATEGORIES_PAR_DEFAUT, semerCategoriesParDefaut };
