# Suivi de dépenses et d'épargne

Application web de suivi de dépenses, revenus et épargne pour les petits commerçants de Bamako (boutiques, vendeurs de marché, artisans). Node.js, Express, PostgreSQL, Prisma, EJS.

**Application en ligne :** https://suivi-depenses-epargne.onrender.com

## Fonctionnalités

- Comptes utilisateurs : inscription par téléphone + mot de passe, ou connexion Google
- Transactions (dépense / revenu / épargne) : ajout, modification, suppression, recherche, filtres, pagination, export CSV et PDF
- Tableau de bord : totaux par période, répartition des dépenses par catégorie, évolution du solde sur 14 jours
- Objectifs d'épargne avec suivi de progression et historique
- Catégories personnalisables
- Multi-utilisateurs : plusieurs comptes peuvent partager une même boutique via un code d'invitation (rôles propriétaire / employé)
- Interface mobile-first, mode sombre, installable en PWA sur Android

## Stack technique

Node.js · Express 5 · PostgreSQL · Prisma ORM · EJS · bcrypt + express-session (sessions stockées en base via `connect-pg-simple`) · Passport (Google OAuth) · Helmet (CSP stricte) · pdfkit

## Installation en local

### Prérequis

- [Node.js](https://nodejs.org/) 20 ou plus récent
- [PostgreSQL](https://www.postgresql.org/) 14 ou plus récent (local ou distant)

### Étapes

```bash
git clone https://github.com/Mechantino-10/suivi-depenses-epargne.git
cd suivi-depenses-epargne
npm install
```

Créer un fichier `.env` à la racine (voir [Variables d'environnement](#variables-denvironnement) ci-dessous), puis :

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

L'application est accessible sur http://localhost:3000.

## Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL, ex : `postgresql://utilisateur:motdepasse@localhost:5432/nom_base?schema=public` |
| `SESSION_SECRET` | Chaîne aléatoire longue (générer avec `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `PORT` | Port d'écoute (optionnel, `3000` par défaut en local) |
| `NODE_ENV` | Mettre à `production` en production (active les cookies sécurisés et `trust proxy`) |
| `GOOGLE_CLIENT_ID` | Identifiant client OAuth Google (optionnel — la connexion Google est désactivée si absent) |
| `GOOGLE_CLIENT_SECRET` | Clé secrète du client OAuth Google |
| `GOOGLE_CALLBACK_URL` | URL de redirection OAuth, ex : `http://localhost:3000/auth/google/callback` |

Pour la connexion Google, créer un client OAuth 2.0 sur [Google Cloud Console](https://console.cloud.google.com/) (type "Application Web") et ajouter l'URL de callback correspondante (local et/ou production) dans les URI de redirection autorisés.

## Déploiement (Render)

L'application est déployée sur [Render](https://render.com), qui gère nativement Node.js (contrairement à un hébergement mutualisé classique de type cPanel).

1. **Base de données** : créer une instance PostgreSQL sur Render (New + → PostgreSQL, plan Free), puis récupérer l'**Internal Database URL**.
2. **Service web** : New + → Web Service, connecter le dépôt GitHub.
   - **Build Command** : `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command** : `node server.js`
   - **Instance Type** : Free
   - **Environment Variables** : voir le tableau ci-dessus (utiliser l'Internal Database URL de l'étape 1 pour `DATABASE_URL`, et `https://<nom-du-service>.onrender.com/auth/google/callback` pour `GOOGLE_CALLBACK_URL`)
3. Déployer. Render exécute automatiquement les migrations Prisma à chaque déploiement (incluses dans le Build Command).
4. Si la connexion Google est utilisée, ajouter l'URL de production dans les URI de redirection autorisés du client OAuth Google.

Ce même processus fonctionne sur Railway ou Fly.io, avec des interfaces de configuration équivalentes.

## Structure du projet

```
routes/       Logique métier par domaine (auth, transactions, objectifs, catégories, boutique, paramètres)
views/        Templates EJS
public/       CSS, icônes, scripts JS statiques (compatibles CSP stricte, sans inline)
prisma/       Schéma de base de données et migrations
middleware/   Middlewares Express (authentification)
utils/        Fonctions utilitaires partagées
config/       Configuration Passport (Google OAuth)
```

## Sécurité

- Mots de passe hachés avec bcrypt, jamais stockés en clair
- Isolation stricte des données par boutique, revérifiée à chaque écriture/suppression
- Sessions persistées en base de données (pas de perte de session au redémarrage du serveur)
- Politique de sécurité de contenu (CSP) stricte via Helmet : aucun script inline ou externe non autorisé
- Limitation du taux de requêtes sur les routes de connexion et de changement de mot de passe
- Protection contre l'injection de formule CSV à l'export
