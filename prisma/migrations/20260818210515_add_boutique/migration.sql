-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROPRIETAIRE', 'EMPLOYE');

-- CreateTable
CREATE TABLE "Boutique" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "codeInvitation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seedUserId" INTEGER,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Boutique_codeInvitation_key" ON "Boutique"("codeInvitation");

-- AlterTable: add nullable columns first
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'PROPRIETAIRE';
ALTER TABLE "User" ADD COLUMN "boutiqueId" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "boutiqueId" INTEGER;
ALTER TABLE "Goal" ADD COLUMN "boutiqueId" INTEGER;
ALTER TABLE "Category" ADD COLUMN "boutiqueId" INTEGER;

-- Backfill: one Boutique per existing user, then link everything that user owns
INSERT INTO "Boutique" ("nom", "codeInvitation", "seedUserId")
SELECT 'Boutique de ' || u."nom",
       upper(substr(md5(random()::text || u."id"::text || clock_timestamp()::text), 1, 8)),
       u."id"
FROM "User" u;

UPDATE "User" u SET "boutiqueId" = b."id"
FROM "Boutique" b
WHERE b."seedUserId" = u."id";

UPDATE "Transaction" t SET "boutiqueId" = b."id"
FROM "Boutique" b
WHERE b."seedUserId" = t."userId";

UPDATE "Goal" g SET "boutiqueId" = b."id"
FROM "Boutique" b
WHERE b."seedUserId" = g."userId";

UPDATE "Category" c SET "boutiqueId" = b."id"
FROM "Boutique" b
WHERE b."seedUserId" = c."userId";

ALTER TABLE "Boutique" DROP COLUMN "seedUserId";

-- Finalize: make boutiqueId required and add foreign keys
ALTER TABLE "User" ALTER COLUMN "boutiqueId" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "boutiqueId" SET NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "boutiqueId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "boutiqueId" SET NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Transaction_boutiqueId_date_idx" ON "Transaction"("boutiqueId", "date");
CREATE INDEX "Transaction_boutiqueId_type_idx" ON "Transaction"("boutiqueId", "type");

-- Category becomes boutique-scoped instead of user-scoped
DROP INDEX "Category_userId_nom_key";
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";
ALTER TABLE "Category" DROP COLUMN "userId";
CREATE UNIQUE INDEX "Category_boutiqueId_nom_key" ON "Category"("boutiqueId", "nom");

-- Superseded by the boutiqueId indexes above
DROP INDEX "Transaction_userId_date_idx";
DROP INDEX "Transaction_userId_type_idx";
