document.addEventListener("click", function (e) {
  var bouton = e.target.closest(".btn-oeil");
  if (!bouton) return;

  var input = document.getElementById(bouton.getAttribute("data-cible"));
  if (!input) return;

  var visible = input.type === "text";
  input.type = visible ? "password" : "text";
  bouton.classList.toggle("actif", !visible);
  bouton.setAttribute("aria-label", visible ? "Afficher le mot de passe" : "Masquer le mot de passe");
});
