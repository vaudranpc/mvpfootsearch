// Dossier où se trouve ce script : permet d'inclure header.html / responsive.css
// aussi depuis les pages placées dans un sous-dossier (ex. football-viral/).
const SITE_BASE = (document.currentScript && document.currentScript.src)
  ? document.currentScript.src.replace(/[^/]*$/, "")
  : "";

// Mobile : sans balise viewport, le téléphone affiche la page comme un écran de
// 980 px de large (tout petit). On l'ajoute si la page l'a oubliée.
if (!document.querySelector('meta[name="viewport"]')) {
  const vp = document.createElement("meta");
  vp.name = "viewport";
  vp.content = "width=device-width, initial-scale=1.0";
  document.head.appendChild(vp);
}

// Règles responsive communes à tout le site.
if (!document.querySelector('link[data-site-responsive]')) {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = SITE_BASE + "responsive.css";
  css.dataset.siteResponsive = "";
  document.head.appendChild(css);
}

/** Charge un fragment HTML dans un conteneur et exécute ses <script>.
 *  Si le fichier n'existe pas (404), on n'insère rien : sinon la page d'erreur
 *  du serveur (et ses styles) se retrouvait au milieu du site. */
function injectFragment(url, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  fetch(url)
    .then(res => (res.ok ? res.text() : Promise.reject(res.status)))
    .then(data => {
      container.innerHTML = data;
      // Important : exécuter les <script> du fragment après inclusion
      container.querySelectorAll("script").forEach(script => {
        const newScript = document.createElement("script");
        newScript.text = script.textContent;
        document.body.appendChild(newScript);
      });
      // Liens relatifs du menu : les rendre valables depuis un sous-dossier
      if (SITE_BASE) {
        container.querySelectorAll("a[href]").forEach(a => {
          const href = a.getAttribute("href");
          if (!/^([a-z]+:|\/|#)/i.test(href)) a.href = new URL(href, SITE_BASE).href;
        });
      }
    })
    .catch(() => {});
}

function injectHeaderAndFooter() {
  injectFragment(SITE_BASE + "header.html", "header-container");
  injectFragment(SITE_BASE + "news.html", "footer-container");
}

// Sur les pages dont le <head> est lourd (CDN externes, polices, etc.), le
// <body> peut ne pas encore être analysé quand ce script s'exécute : on
// attend que le DOM soit prêt pour être sûr que #header-container existe.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectHeaderAndFooter);
} else {
  injectHeaderAndFooter();
}
