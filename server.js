require("dotenv/config");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const prisma = require("./prisma/client");
const passport = require("./config/passport");
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const dashboardRoutes = require("./routes/dashboard");
const goalRoutes = require("./routes/goals");
const categoryRoutes = require("./routes/categories");
const boutiqueRoutes = require("./routes/boutique");
const parametresRoutes = require("./routes/parametres");

const app = express();

const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // aucun script externe ni inline : tout est servi depuis /public
        styleSrc: ["'self'", "'unsafe-inline'"], // les barres de progression utilisent des largeurs calculées en style inline
        imgSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"], // anti-clickjacking
      },
    },
  })
);
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const enProduction = process.env.NODE_ENV === "production";
if (enProduction) app.set("trust proxy", 1);

app.use(
  session({
    store: new pgSession({ pool: sessionPool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
      httpOnly: true,
      secure: enProduction,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());

app.use(async (req, res, next) => {
  if (req.session.userId) {
    res.locals.currentUser = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { boutique: true },
    });
  } else {
    res.locals.currentUser = null;
  }
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  next();
});

app.use("/", authRoutes);
app.use("/", transactionRoutes);
app.use("/", dashboardRoutes);
app.use("/", goalRoutes);
app.use("/", categoryRoutes);
app.use("/", boutiqueRoutes);
app.use("/", parametresRoutes);

app.use((req, res) => {
  res.status(404).render("erreur", { code: 404, message: "Page introuvable." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("erreur", { code: 500, message: "Une erreur est survenue. Réessaie dans un instant." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
