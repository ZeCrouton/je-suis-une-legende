#!/usr/bin/env node
// Vérifie la structure des histoires JSON de la bibliothèque.
// Usage : node outils/verifier-histoires.mjs [fichier.json | dossier] ...
// Sans argument : vérifie le dossier histoires/.
// Code de sortie 1 s'il y a au moins une erreur. Les avertissements ne bloquent pas.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

const GENRES = ["Fantasy", "Science-fiction", "Thriller", "Horreur", "Romance",
  "Aventure", "Policier", "Mystère", "Conte pour enfant", "Comédie"];
const PUBLICS = ["adultes", "3–5 ans", "6–8 ans", "9–12 ans"];
const MARQUEUR_AUTORISE = "{prenom}";

function collecterFichiers(cibles) {
  const fichiers = [];
  for (const cible of cibles) {
    if (statSync(cible).isDirectory()) {
      for (const nom of readdirSync(cible).sort()) {
        if (extname(nom) === ".json") fichiers.push(join(cible, nom));
      }
    } else {
      fichiers.push(cible);
    }
  }
  return fichiers;
}

function mots(texte) {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

// Longueur (en pages) du plus court et du plus long chemin depuis p1 jusqu'à chaque fin.
// Retourne null s'il existe un cycle.
function longueursDesChemins(pagesParId) {
  const enCours = new Set();
  const memo = new Map();
  let cycle = false;
  function visiter(id) {
    if (memo.has(id)) return memo.get(id);
    if (enCours.has(id)) { cycle = true; return { min: Infinity, max: -Infinity }; }
    enCours.add(id);
    const page = pagesParId.get(id);
    let resultat;
    if (page.fin === true) {
      resultat = { min: 1, max: 1 };
    } else {
      const sous = page.choix.map(c => pagesParId.has(c.va_vers) ? visiter(c.va_vers) : { min: Infinity, max: -Infinity });
      resultat = {
        min: 1 + Math.min(...sous.map(s => s.min)),
        max: 1 + Math.max(...sous.map(s => s.max))
      };
    }
    enCours.delete(id);
    memo.set(id, resultat);
    return resultat;
  }
  const racine = visiter("p1");
  return cycle ? null : { racine };
}

function accessibles(pagesParId) {
  const vus = new Set();
  const pile = ["p1"];
  while (pile.length) {
    const id = pile.pop();
    if (vus.has(id) || !pagesParId.has(id)) continue;
    vus.add(id);
    const page = pagesParId.get(id);
    if (page.choix) for (const c of page.choix) pile.push(c.va_vers);
  }
  return vus;
}

function verifier(chemin) {
  const erreurs = [];
  const avertissements = [];
  const fichier = basename(chemin);
  const err = m => erreurs.push(m);
  const avert = m => avertissements.push(m);

  let histoire;
  try {
    histoire = JSON.parse(readFileSync(chemin, "utf8"));
  } catch (e) {
    return { fichier, erreurs: [`JSON invalide : ${e.message}`], avertissements };
  }

  for (const champ of ["id", "genre", "public", "titre", "pages"]) {
    if (!(champ in histoire)) err(`champ manquant : ${champ}`);
  }
  if (erreurs.length) return { fichier, erreurs, avertissements };

  if (!GENRES.includes(histoire.genre)) err(`genre inconnu : ${histoire.genre}`);
  if (!PUBLICS.includes(histoire.public)) err(`public inconnu : ${histoire.public}`);
  const enfant = histoire.genre === "Conte pour enfant";
  if (enfant && histoire.public === "adultes") err("un conte pour enfant doit avoir un public d'enfants");
  if (!enfant && histoire.public !== "adultes") err("un public d'enfants n'est prévu que pour le genre « Conte pour enfant »");

  if (!Array.isArray(histoire.pages)) { err("« pages » doit être une liste"); return { fichier, erreurs, avertissements }; }

  const total = histoire.pages.length;
  if (total < 16 || total > 22) err(`nombre de pages : ${total} (attendu entre 16 et 22)`);

  // Identifiants uniques et présence de p1.
  const pagesParId = new Map();
  for (const page of histoire.pages) {
    if (!page.id) { err("page sans identifiant"); continue; }
    if (pagesParId.has(page.id)) err(`identifiant de page en double : ${page.id}`);
    pagesParId.set(page.id, page);
  }
  if (!pagesParId.has("p1")) err("la page de départ « p1 » est absente");

  const fins = [];
  const limitesMots = enfant
    ? (histoire.public === "3–5 ans" ? [80, 140] : histoire.public === "6–8 ans" ? [130, 200] : [180, 260])
    : [120, 220];

  for (const page of histoire.pages) {
    const ref = `page ${page.id}`;
    if (typeof page.texte !== "string" || !page.texte.trim()) { err(`${ref} : texte vide`); continue; }

    // Marqueurs : seul {prenom} est autorisé, et aucun crochet ou note.
    const marqueurs = page.texte.match(/\{[^}]*\}/g) || [];
    for (const m of marqueurs) if (m !== MARQUEUR_AUTORISE) err(`${ref} : marqueur interdit ${m}`);
    if (/\[|\]|```|^\s*[-*#]/m.test(page.texte)) err(`${ref} : mise en forme ou crochets interdits dans le texte`);

    const n = mots(page.texte);
    if (n < limitesMots[0] || n > limitesMots[1]) avert(`${ref} : ${n} mots (attendu entre ${limitesMots[0]} et ${limitesMots[1]})`);
    if (histoire.public === "3–5 ans") {
      for (const phrase of page.texte.split(/[.!?…]+/).map(s => s.trim()).filter(Boolean)) {
        if (mots(phrase) >= 12) { avert(`${ref} : phrase de ${mots(phrase)} mots pour 3–5 ans`); break; }
      }
    }

    if (page.fin === true) {
      fins.push(page.id);
      if ("choix" in page) err(`${ref} : une fin ne doit pas avoir de choix`);
      continue;
    }
    if (!Array.isArray(page.choix) || page.choix.length !== 2) {
      err(`${ref} : il faut exactement deux choix`);
      continue;
    }
    for (const c of page.choix) {
      if (!c.libelle || !c.libelle.trim()) err(`${ref} : choix sans libellé`);
      else {
        const nc = mots(c.libelle);
        if (nc < 4 || nc > 9) avert(`${ref} : choix de ${nc} mots (attendu entre 4 et 9) : « ${c.libelle} »`);
        if (/[.!?]$/.test(c.libelle.trim())) avert(`${ref} : choix avec point final : « ${c.libelle} »`);
      }
      if (!pagesParId.has(c.va_vers)) err(`${ref} : choix vers une page inexistante « ${c.va_vers} »`);
    }
  }

  // Le héros doit être désigné par {prenom} : une histoire sans ce marqueur porte un prénom figé.
  const avecPrenom = histoire.pages.some(p => typeof p.texte === "string" && p.texte.includes(MARQUEUR_AUTORISE));
  if (!avecPrenom) err(`aucun marqueur ${MARQUEUR_AUTORISE} : le héros ne peut pas être personnalisé (prénom figé dans le texte ?)`);

  if (fins.length < 2 || fins.length > 3) err(`nombre de fins : ${fins.length} (attendu 2 ou 3)`);

  // Pages inaccessibles depuis p1.
  if (pagesParId.has("p1")) {
    const vus = accessibles(pagesParId);
    for (const id of pagesParId.keys()) if (!vus.has(id)) avert(`page ${id} inaccessible depuis p1`);

    const chemins = longueursDesChemins(pagesParId);
    if (!chemins) err("le graphe contient un cycle : un chemin revient sur une page déjà lue");
    else {
      const [minAttendu, maxAttendu] = enfant ? [6, 7] : [8, 10];
      const racine = chemins.racine;
      if (racine.min < minAttendu) err(`le chemin le plus court fait ${racine.min} pages (minimum ${minAttendu})`);
      if (racine.max > maxAttendu) avert(`le chemin le plus long fait ${racine.max} pages (maximum conseillé ${maxAttendu})`);
    }
  }

  return { fichier, erreurs, avertissements, total, fins: fins.length };
}

const cibles = process.argv.length > 2 ? process.argv.slice(2) : ["histoires"];
let fichiers = [];
try {
  fichiers = collecterFichiers(cibles);
} catch (e) {
  console.error(`Impossible de lire : ${e.message}`);
  process.exit(1);
}
if (!fichiers.length) {
  console.log("Aucune histoire à vérifier.");
  process.exit(0);
}

let echecs = 0;
for (const f of fichiers) {
  const r = verifier(f);
  const statut = r.erreurs.length ? "ÉCHEC" : "OK";
  console.log(`${statut}  ${r.fichier}${r.total ? `  (${r.total} pages, ${r.fins} fins)` : ""}`);
  for (const e of r.erreurs) console.log(`   erreur : ${e}`);
  for (const a of r.avertissements) console.log(`   avertissement : ${a}`);
  if (r.erreurs.length) echecs++;
}
console.log(`\n${fichiers.length - echecs}/${fichiers.length} histoire(s) valide(s).`);
process.exit(echecs ? 1 : 0);
