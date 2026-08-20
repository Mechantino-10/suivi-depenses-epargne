function requireAuth(req, res, next) {
  if (!res.locals.currentUser) {
    return req.session.destroy(() => res.redirect("/connexion"));
  }
  next();
}

module.exports = { requireAuth };
