const crypto = require("crypto");

const CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter la confusion

function genererCodeInvitation() {
  let code = "";
  for (let i = 0; i < 8; i++) {
    // crypto.randomInt (et non Math.random) : ce code donne accès complet aux données de la boutique,
    // il doit être imprévisible.
    code += CARACTERES[crypto.randomInt(CARACTERES.length)];
  }
  return code;
}

async function genererCodeInvitationUnique(prisma) {
  for (let tentative = 0; tentative < 10; tentative++) {
    const code = genererCodeInvitation();
    const existant = await prisma.boutique.findUnique({ where: { codeInvitation: code } });
    if (!existant) return code;
  }
  throw new Error("Impossible de générer un code d'invitation unique.");
}

module.exports = { genererCodeInvitationUnique };
