"""Top 50 des artistes IVOIRIENS les plus écoutés en Côte d'Ivoire + leurs actus de moins de 3 jours.

1. Classements officiels Côte d'Ivoire : Apple Music (top 100 morceaux + top 100 albums)
   et Deezer (playlist « Top Ivory Coast »). Score d'un artiste = somme de (101 - position).
2. Nationalité : data/artistes.json (liste tenue à la main, "ivoirien": false pour exclure),
   sinon Wikidata (nationalité Côte d'Ivoire), mise en cache dans data/nationalites.json.
   Les artistes classés dont on ne connaît pas la nationalité vont dans « a_verifier ».
3. Top 50 = artistes ivoiriens classés ; s'il en manque, on complète avec les autres artistes
   ivoiriens de la liste, par nombre de fans Deezer.          -> data/top-artistes.json
4. Actus Google News de moins de 3 jours pour chacun du top 50. -> data/artistes-actus.json

Spotify ne publie pas de classement pour la Côte d'Ivoire : il n'est pas utilisé.
Lancé par .github/workflows/actus-artistes.yml, ou à la main : python3 scripts/actus_artistes.py
Uniquement la bibliothèque standard de Python : rien à installer.
"""
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FICHES = DATA / "artistes.json"
NATIONALITES = DATA / "nationalites.json"
TOP = DATA / "top-artistes.json"
ACTUS = DATA / "artistes-actus.json"

TAILLE_TOP = 50
FENETRE_HEURES = 72
MAX_PAR_ARTISTE = 15
RECHECK_JOURS = 7  # re-demander à Wikidata les nationalités inconnues après 7 jours
COTE_IVOIRE = "Q1008"

APPLE = "https://rss.marketingtools.apple.com/api/v2/ci/music/most-played/100/{type}.json"
DEEZER_TOP_CI = "https://api.deezer.com/playlist/1362497945/tracks?limit=100"  # « Top Ivory Coast » (Deezer Charts)
DEEZER_ARTISTE = "https://api.deezer.com/search/artist?q={q}&limit=1"
WIKIDATA_SEARCH = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search={q}&language=fr&type=item&limit=5&format=json"
WIKIDATA_ENTITY = "https://www.wikidata.org/wiki/Special:EntityData/{id}.json"
# L'édition « Côte d'Ivoire » de Google News redirige vers l'édition France.
GOOGLE_NEWS = "https://news.google.com/rss/search?q={q}&hl=fr&gl=FR&ceid=FR:fr"
UA = {"User-Agent": "mvpfootsearch-top-artistes/1.0 (https://github.com/vaudranpc/mvpfootsearch)"}
GENRES_IGNORES = {"musique", "music"}
# métiers Wikidata : chanteur, musicien, rappeur, compositeur, auteur-compositeur, DJ, groupe…
METIERS_MUSIQUE = {"Q177220", "Q639669", "Q2252262", "Q36834", "Q753110", "Q488205", "Q130857", "Q855091", "Q183945", "Q215380", "Q2088357"}


def simplifier(texte):
    """Minuscules, sans accents ni ponctuation : « TRK. » == « trk », « Ks Bloom » == « KS BLOOM »."""
    t = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9$]+", " ", t).split())


def telecharger(url, essais=3):
    for i in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except Exception:
            if i == essais - 1:
                raise
            time.sleep(3 * (i + 1))


def lire_json(chemin, defaut):
    return json.loads(chemin.read_text(encoding="utf-8")) if chemin.exists() else defaut


def separer_noms(artistes, titre=""):
    """« Himra & Gazo » -> [Himra, Gazo] ; « TITRE (feat. Himra) » ajoute Himra."""
    noms = re.split(r"\s*(?:&|,|\bfeat\.|\bft\.|\s[xX]\s)\s*", artistes)
    feat = re.search(r"\((?:feat\.|ft\.|avec)\s+([^)]*)\)", titre, re.I)
    if feat:
        noms += re.split(r"\s*(?:&|,)\s*", feat.group(1))
    return [n.strip() for n in noms if n.strip()]


# ---------------------------------------------------------------- 1. classements
def classements():
    """Renvoie {cle: artiste} avec score, liens, genres et meilleurs titres, + dates des classements."""
    artistes, dates = {}, {}

    def ajouter(nom, pos, titre, source, principal, lien=None, genres=()):
        cle = simplifier(nom)
        a = artistes.setdefault(cle, {"nom": nom, "score": 0, "lien": None, "genres": Counter(), "titres": []})
        a["score"] += 101 - pos
        if principal and lien and not a["lien"]:
            a["lien"] = lien
        a["genres"].update(g for g in genres if g.lower() not in GENRES_IGNORES)
        if len(a["titres"]) < 3:
            a["titres"].append({"rang": pos, "titre": titre, "source": source})

    for type_, libelle in (("songs", "Apple Music"), ("albums", "Apple Music albums")):
        flux = json.loads(telecharger(APPLE.format(type=type_)))["feed"]
        dates[libelle] = flux.get("updated")
        for pos, e in enumerate(flux["results"], start=1):
            principal = simplifier(e["artistName"])
            for nom in separer_noms(e["artistName"], e.get("name", "")):
                ajouter(nom, pos, e["name"], libelle, simplifier(nom) == principal, e.get("artistUrl"),
                        [g["name"] for g in e.get("genres", [])])
        time.sleep(1)

    pistes = json.loads(telecharger(DEEZER_TOP_CI))["data"]
    dates["Deezer"] = datetime.now(timezone.utc).isoformat(timespec="minutes")
    for pos, t in enumerate(pistes, start=1):
        principal = simplifier(t["artist"]["name"])
        for nom in separer_noms(t["artist"]["name"], t.get("title", "")):
            ajouter(nom, pos, t["title"], "Deezer", simplifier(nom) == principal, t["artist"].get("link"))
    return artistes, dates


# ---------------------------------------------------------------- 2. nationalité
def nationalite_wikidata(nom):
    """Renvoie 'ivoirien', 'autre' ou None (inconnu) d'après Wikidata (musiciens uniquement)."""
    res = json.loads(telecharger(WIKIDATA_SEARCH.format(q=urllib.parse.quote(nom))))
    for item in res.get("search", []):
        if simplifier(item.get("label", "")) != simplifier(nom):
            continue
        time.sleep(1)
        ent = next(iter(json.loads(telecharger(WIKIDATA_ENTITY.format(id=item["id"])))["entities"].values()))
        claims = ent.get("claims", {})
        val = lambda p: {c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in claims.get(p, [])}
        if not (val("P106") & METIERS_MUSIQUE) and not val("P136"):  # pas un artiste musical
            continue
        pays = val("P27") | val("P495")  # nationalité (personne) ou pays d'origine (groupe)
        if pays:
            return "ivoirien" if COTE_IVOIRE in pays else "autre"
    return None


def nationalites(cles_noms, fiches_par_cle):
    cache = lire_json(NATIONALITES, {})
    maintenant = datetime.now(timezone.utc)
    for cle, nom in cles_noms:
        if cle in fiches_par_cle:
            continue
        deja = cache.get(cle)
        if deja and (deja["statut"] or maintenant - datetime.fromisoformat(deja["verifie"]) < timedelta(days=RECHECK_JOURS)):
            continue
        try:
            statut = nationalite_wikidata(nom)
        except Exception as e:
            print(f"  Wikidata indisponible pour {nom} : {e}")
            continue
        cache[cle] = {"nom": nom, "statut": statut, "verifie": maintenant.isoformat(timespec="minutes")}
        time.sleep(1)
    NATIONALITES.write_text(json.dumps(dict(sorted(cache.items())), ensure_ascii=False, indent=1), encoding="utf-8")
    return cache


def fans_deezer(nom):
    try:
        d = json.loads(telecharger(DEEZER_ARTISTE.format(q=urllib.parse.quote(nom))))["data"]
        if d and simplifier(d[0]["name"]) == simplifier(nom):
            return d[0]["nb_fan"], d[0]["link"]
    except Exception:
        pass
    return 0, None


# ---------------------------------------------------------------- 3. top 50
def calculer_top():
    fiches = lire_json(FICHES, [])
    fiches_par_cle = {simplifier(f["nom"]): f for f in fiches}
    artistes, dates = classements()
    par_score = sorted(artistes.items(), key=lambda kv: -kv[1]["score"])
    cache = nationalites([(c, a["nom"]) for c, a in par_score], fiches_par_cle)

    def est_ivoirien(cle):
        if cle in fiches_par_cle:
            return fiches_par_cle[cle].get("ivoirien", True)
        statut = (cache.get(cle) or {}).get("statut")
        return True if statut == "ivoirien" else False if statut == "autre" else None

    def fiche_vers_entree(f, base):
        return {**base, "nom": f.get("nom", base["nom"]),
                **({"info": f["info"]} if f.get("info") else {}), **({"source": f["source"]} if f.get("source") else {}),
                **({"recherche": f["recherche"]} if f.get("recherche") else {}),
                "genre": f.get("genre") or base.get("genre", "")}

    top, a_verifier = [], []
    for cle, a in par_score:
        statut = est_ivoirien(cle)
        base = {"nom": a["nom"], "score": a["score"], "classe": True, "titres": a["titres"],
                "genre": a["genres"].most_common(1)[0][0] if a["genres"] else "",
                "lien": a["lien"] or "https://music.apple.com/ci/search?term=" + urllib.parse.quote(a["nom"])}
        if statut and len(top) < TAILLE_TOP:
            top.append(fiche_vers_entree(fiches_par_cle.get(cle, {}), base))
        elif statut is None and len(a_verifier) < 30:
            a_verifier.append({"nom": a["nom"], "score": a["score"], "titre": a["titres"][0]})

    # compléter avec les artistes ivoiriens de la liste qui ne sont pas classés, par fans Deezer
    if len(top) < TAILLE_TOP:
        deja = {simplifier(t["nom"]) for t in top}
        restants = []
        for f in fiches:
            if f.get("ivoirien", True) and simplifier(f["nom"]) not in deja:
                fans, lien = fans_deezer(f["nom"])
                restants.append((fans, f, lien))
                time.sleep(0.2)
        for fans, f, lien in sorted(restants, key=lambda x: -x[0])[: TAILLE_TOP - len(top)]:
            top.append(fiche_vers_entree(f, {"nom": f["nom"], "score": 0, "classe": False, "fans_deezer": fans, "titres": [],
                                              "lien": lien or "https://www.deezer.com/search/" + urllib.parse.quote(f["nom"])}))
    for i, t in enumerate(top, start=1):
        t["rang"] = i
    return top, a_verifier, dates


# ---------------------------------------------------------------- 4. actus
def actus_de(artiste, limite):
    nom = artiste["nom"]
    cle = simplifier(nom)
    requete = artiste.get("recherche") or f'"{nom}"'
    if not artiste.get("recherche") and len(cle.replace(" ", "")) <= 4:
        # nom court (« THB », « M24 »…) : contexte musical pour éviter les homonymes
        requete += " (musique OR rap OR album OR clip OR concert OR chanteur OR chanteuse OR son)"
    racine = ET.fromstring(telecharger(GOOGLE_NEWS.format(q=urllib.parse.quote(requete + " when:3d"))))
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
        # seulement les articles récents dont le titre cite vraiment l'artiste (mot entier)
        if date < limite or f" {cle} " not in f" {simplifier(titre)} ":
            continue
        actus.append({"titre": titre, "lien": (item.findtext("link") or "").strip(), "source": source,
                      "date": date.astimezone(timezone.utc).isoformat(timespec="minutes")})
    vus, uniques = set(), []
    for a in sorted(actus, key=lambda a: a["date"], reverse=True):
        if a["lien"] in vus or simplifier(a["titre"]) in vus:
            continue
        vus.update({a["lien"], simplifier(a["titre"])})
        uniques.append(a)
    return uniques[:MAX_PAR_ARTISTE]


def ecrire_si_change(chemin, contenu, cles):
    """Ne réécrit le fichier que si ces parties ont changé (évite un commit toutes les 3 h pour rien)."""
    ancien = lire_json(chemin, {})
    if all(ancien.get(c) == contenu[c] for c in cles):
        print(f"{chemin.name} : inchangé.")
        return
    chemin.write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{chemin.name} : mis à jour.")


def main():
    maintenant = datetime.now(timezone.utc)
    top, a_verifier, dates = calculer_top()
    print(f"Top {len(top)} ivoiriens ({sum(t['classe'] for t in top)} classés) : " + ", ".join(t["nom"] for t in top[:12]) + "…")
    print(f"À vérifier : " + ", ".join(a["nom"] for a in a_verifier))
    ecrire_si_change(TOP, {
        "genere": maintenant.isoformat(timespec="minutes"),
        "classements": dates,
        "source": "Apple Music (top morceaux + top albums) et Deezer (Top Ivory Coast), Côte d'Ivoire",
        "artistes": top,
        "a_verifier": a_verifier,
    }, ["artistes", "a_verifier"])

    limite = maintenant - timedelta(hours=FENETRE_HEURES)
    resultats, erreurs = {}, []
    for a in top:
        try:
            resultats[a["nom"]] = actus_de(a, limite)
        except Exception as e:  # un artiste en erreur ne bloque pas les autres
            erreurs.append(f'{a["nom"]}: {e}')
            resultats[a["nom"]] = []
        time.sleep(1)  # rester poli avec Google News
    print(f"Actus : {sum(map(len, resultats.values()))} articles, {len(erreurs)} erreur(s)")
    if erreurs and len(erreurs) == len(top):
        raise SystemExit("Toutes les recherches d'actus ont échoué :\n" + "\n".join(erreurs))
    ecrire_si_change(ACTUS, {
        "genere": maintenant.isoformat(timespec="minutes"),
        "fenetre_heures": FENETRE_HEURES,
        "erreurs": erreurs,
        "artistes": resultats,
    }, ["artistes"])


if __name__ == "__main__":
    main()
