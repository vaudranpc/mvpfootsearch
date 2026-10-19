"""Cherche les actualités de moins de 3 jours sur chaque artiste de data/artistes.json
(flux RSS Google News) et les écrit dans data/artistes-actus.json.

Lancé automatiquement par .github/workflows/actus-artistes.yml, ou à la main :
    python3 scripts/actus_artistes.py

Uniquement la bibliothèque standard de Python : rien à installer.
"""
import json
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTISTES = ROOT / "data" / "artistes.json"
SORTIE = ROOT / "data" / "artistes-actus.json"
FENETRE_HEURES = 72
MAX_PAR_ARTISTE = 15
# L'édition « Côte d'Ivoire » de Google News redirige vers l'édition France.
RSS = "https://news.google.com/rss/search?q={q}&hl=fr&gl=FR&ceid=FR:fr"


def simplifier(texte):
    """Minuscules sans accents, pour comparer « Debordo » et « DEBORDO »."""
    t = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode()
    return " ".join(t.lower().split())


def lire_flux(requete):
    url = RSS.format(q=urllib.parse.quote(requete))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (mvpfootsearch actus)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return ET.fromstring(r.read())


def actus_de(artiste, limite):
    nom = artiste["nom"]
    # « recherche » (optionnel dans artistes.json) permet d'affiner un nom ambigu
    requete = artiste.get("recherche") or f'"{nom}"'
    racine = lire_flux(f"{requete} when:3d")
    cle = simplifier(nom)
    actus = []
    for item in racine.iter("item"):
        titre = (item.findtext("title") or "").strip()
        source = (item.findtext("source") or "").strip()
        if source and titre.endswith(" - " + source):
            titre = titre[: -len(" - " + source)]
        try:
            date = parsedate_to_datetime(item.findtext("pubDate"))
        except (TypeError, ValueError):
            continue
        # garder seulement les articles récents dont le titre cite vraiment l'artiste
        if date < limite or cle not in simplifier(titre):
            continue
        actus.append({
            "titre": titre,
            "lien": (item.findtext("link") or "").strip(),
            "source": source,
            "date": date.astimezone(timezone.utc).isoformat(timespec="minutes"),
        })
    vus, uniques = set(), []
    for a in sorted(actus, key=lambda a: a["date"], reverse=True):
        if a["lien"] in vus or simplifier(a["titre"]) in vus:
            continue
        vus.update({a["lien"], simplifier(a["titre"])})
        uniques.append(a)
    return uniques[:MAX_PAR_ARTISTE]


def main():
    artistes = json.loads(ARTISTES.read_text(encoding="utf-8"))
    maintenant = datetime.now(timezone.utc)
    limite = maintenant - timedelta(hours=FENETRE_HEURES)
    resultats, erreurs = {}, []
    for a in artistes:
        try:
            resultats[a["nom"]] = actus_de(a, limite)
        except Exception as e:  # un artiste en erreur ne bloque pas les autres
            erreurs.append(f'{a["nom"]}: {e}')
            resultats[a["nom"]] = []
        print(f'{a["nom"]:<20} {len(resultats[a["nom"]])} actu(s)')
        time.sleep(1)  # rester poli avec Google News

    if erreurs and len(erreurs) == len(artistes):
        raise SystemExit("Toutes les recherches ont échoué :\n" + "\n".join(erreurs))

    # Ne réécrire le fichier que si les actus ont changé (évite un commit toutes les 3 h pour rien)
    ancien = json.loads(SORTIE.read_text(encoding="utf-8")) if SORTIE.exists() else {}
    if ancien.get("artistes") == resultats:
        print("Aucune nouvelle actu : fichier inchangé.")
        return
    SORTIE.write_text(json.dumps({
        "genere": maintenant.isoformat(timespec="minutes"),
        "fenetre_heures": FENETRE_HEURES,
        "erreurs": erreurs,
        "artistes": resultats,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{sum(map(len, resultats.values()))} actus écrites dans {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
