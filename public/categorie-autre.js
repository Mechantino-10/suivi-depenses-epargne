document.addEventListener("change", function (e) {
  if (e.target.id !== "categorie") return;

  var wrapper = document.getElementById("categorie-autre-wrapper");
  var texte = document.getElementById("categorieAutreTexte");
  if (!wrapper || !texte) return;

  if (e.target.value === "__autre__") {
    wrapper.style.display = "block";
    texte.focus();
  } else {
    wrapper.style.display = "none";
    var dynOption = e.target.querySelector('option[data-dynamique="1"]');
    if (dynOption) dynOption.remove();
  }
});

document.addEventListener("input", function (e) {
  if (e.target.id !== "categorieAutreTexte") return;

  var select = document.getElementById("categorie");
  if (!select) return;

  var valeur = e.target.value.trim();
  var option = select.querySelector('option[data-dynamique="1"]');
  if (!option) {
    option = document.createElement("option");
    option.setAttribute("data-dynamique", "1");
    var optionAutre = select.querySelector('option[value="__autre__"]');
    select.insertBefore(option, optionAutre);
  }
  option.value = valeur;
  option.textContent = valeur;
  option.selected = true;
});
