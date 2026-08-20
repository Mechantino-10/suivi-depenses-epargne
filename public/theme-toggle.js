document.getElementById("theme-toggle").addEventListener("click", function () {
  var root = document.documentElement;
  var current = root.getAttribute("data-theme");
  var isDark = current === "dark" || (!current && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var next = isDark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});
