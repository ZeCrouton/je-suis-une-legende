#!/usr/bin/env node
// Génère un lot d'histoires avec un modèle local (Ollama), puis vérifie chacune.
// Usage : node outils/generer-lot.mjs outils/lot.json [--force]
// Variables : OLLAMA_URL (défaut http://localhost:11434), OLLAMA_MODEL (obligatoire).
// Les histoires déjà présentes dans histoires/ sont ignorées, sauf avec --force.

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossierHistoires = join(racine, "histoires");
const modele = process.env.OLLAMA_MODEL;
const urlOllama = process.env.OLLAMA_URL || "http://localhost:11434";
const TENTATIVES = 3;

const NARRATION = {
  "Fantasy": "troisième personne, au passé (passé simple et imparfait)",
  "Science-fiction": "troisième personne, au passé (passé simple et imparfait)",
  "Thriller": "troisième personne, au présent de narration, au plus près du héros",
  "Horreur": "troisième personne, au passé, focalisée sur les perceptions du héros",
  "Romance": "troisième personne, au passé, centrée sur les émotions du personnage principal",
  "Aventure": "troisième personne, au passé (passé simple et imparfait)",
  "Policier": "troisième personne, au passé (passé simple et imparfait)",
  "Mystère": "troisième personne, au passé (passé simple et imparfait)",
  "Conte pour enfant": "troisième personne, au passé, ton de conteur",
  "Comédie": "troisième personne, au passé, ton léger et malicieux"
};

function remplir(modeleTexte, params) {
  return modeleTexte
    .replaceAll("{{ID}}", params.id)
    .replaceAll("{{GENRE}}", params.genre)
    .replaceAll("{{PUBLIC}}", params.public)
    .replaceAll("{{IDEE}}", params.idee || "aucune, invente librement")
    .replaceAll("{{NARRATION}}", NARRATION[params.genre] || NARRATION["Fantasy"]);
}

// Extrait l'objet JSON même si le modèle a ajouté du texte ou un bloc de code.
function extraireJson(brut) {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new Error("aucun objet JSON trouvé");
  return JSON.parse(brut.slice(debut, fin + 1));
}

async function appelerOllama(prompt) {
  const reponse = await fetch(`${urlOllama}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modele,
      stream: false,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0.8 }
    })
  });
  if (!reponse.ok) throw new Error(`Ollama HTTP ${reponse.status}`);
  return (await reponse.json()).message.content;
}

function verifier(cheminFichier) {
  const r = spawnSync(process.execPath, [join(racine, "outils", "verifier-histoires.mjs"), cheminFichier], { encoding: "utf8" });
  return { ok: r.status === 0, sortie: (r.stdout || "") + (r.stderr || "") };
}

async function main() {
  const [, , fichierLot, ...options] = process.argv;
  const force = options.includes("--force");
  if (!modele) { console.error("Définissez OLLAMA_MODEL (ex. OLLAMA_MODEL=qwen3:14b)."); process.exit(1); }
  if (!fichierLot) { console.error("Usage : node outils/generer-lot.mjs outils/lot.json [--force]"); process.exit(1); }

  const lot = JSON.parse(readFileSync(fichierLot, "utf8"));
  const gabarit = readFileSync(join(racine, "outils", "prompt-histoire.md"), "utf8");
  mkdirSync(dossierHistoires, { recursive: true });

  let reussies = 0, echecs = 0;
  for (const params of lot) {
    const cible = join(dossierHistoires, `${params.id}.json`);
    if (existsSync(cible) && !force) { console.log(`IGNORÉE  ${params.id} (existe déjà)`); continue; }

    const prompt = remplir(gabarit, params);
    let valide = false;
    for (let t = 1; t <= TENTATIVES && !valide; t++) {
      try {
        const brut = await appelerOllama(prompt);
        const histoire = extraireJson(brut);
        writeFileSync(cible, JSON.stringify(histoire, null, 2), "utf8");
        const v = verifier(cible);
        if (v.ok) { valide = true; console.log(`OK       ${params.id} (tentative ${t})`); }
        else console.log(`REJETÉE  ${params.id} (tentative ${t})\n${v.sortie.trim()}`);
      } catch (e) {
        console.log(`ERREUR   ${params.id} (tentative ${t}) : ${e.message}`);
      }
      // Un fichier non valide ne doit pas rester : il serait ignoré aux lancements suivants.
      if (!valide && existsSync(cible)) unlinkSync(cible);
    }
    if (valide) reussies++;
    else {
      echecs++;
      console.log(`ABANDON  ${params.id} après ${TENTATIVES} tentatives`);
    }
  }
  console.log(`\n${reussies} histoire(s) générée(s) et valide(s), ${echecs} échec(s).`);
  process.exit(echecs ? 1 : 0);
}

main();
