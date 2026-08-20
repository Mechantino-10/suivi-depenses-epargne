const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("../prisma/client");
const { semerCategoriesParDefaut } = require("../utils/categoriesParDefaut");
const { genererCodeInvitationUnique } = require("../utils/codeInvitation");

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const emailVerifie = profile.emails && profile.emails[0] && profile.emails[0].verified !== false;
          const email = emailVerifie && profile.emails[0] ? profile.emails[0].value : null;

          let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

          if (!user && email) {
            // Ne relie un compte Google à un compte existant que si l'email est vérifié par Google,
            // pour éviter qu'un compte avec un email non confirmé usurpe un compte existant.
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id },
              });
            }
          }

          if (!user) {
            const nom = profile.displayName || "Utilisateur Google";
            const boutique = await prisma.boutique.create({
              data: {
                nom: `Boutique de ${nom}`,
                codeInvitation: await genererCodeInvitationUnique(prisma),
              },
            });
            await semerCategoriesParDefaut(prisma, boutique.id);

            user = await prisma.user.create({
              data: {
                nom,
                googleId: profile.id,
                email,
                boutiqueId: boutique.id,
                role: "PROPRIETAIRE",
              },
            });
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn(
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET absents du .env : la connexion Google est désactivée."
  );
}

module.exports = passport;
