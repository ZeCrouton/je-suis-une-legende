const CATEGORIES = new Set([
  "Fantasy", "Science-fiction", "Thriller", "Horreur", "Romance",
  "Aventure", "Policier", "Mystère", "Conte pour enfant", "Comédie"
]);

const AGES = ["3–5 ans", "6–8 ans", "9–12 ans"];

// Longueur d'un récit complet, en nombre de pages.
const TOTAL_PAGES_ADULT = 10;
const TOTAL_PAGES_CHILD = 7;

// Modèles explicitement autorisés pour cette version.
// À vérifier régulièrement dans les pages tarifaires et de modèles officielles.
const GROQ_FREE_ALLOWLIST = new Set(["openai/gpt-oss-20b"]);
const GEMINI_FREE_ALLOWLIST = new Set(["gemini-2.5-flash"]);

const MAX_BODY_CHARS = 40000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function planPage(input) {
  const child = input.category === "Conte pour enfant";
  const total = child ? TOTAL_PAGES_CHILD : TOTAL_PAGES_ADULT;
  const requested = Number.parseInt(input.pageNumber, 10);
  const pageNumber = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), total) : 1;
  return { child, total, pageNumber, isEnd: pageNumber >= total };
}

// Chaque page a un rôle dans la structure dramatique. Le rôle est imposé par le code,
// pour que la fin arrive toujours et que la tension monte de façon régulière.
function phaseInstruction(pageNumber, total) {
  if (pageNumber === 1) {
    return "PHASE : OUVERTURE. Présente le protagoniste, son monde et une situation déclencheur forte. " +
      "Installe un enjeu clair, une question en suspens et un détail précis et apparemment anodin qui reviendra plus tard. " +
      "Ne révèle rien de la vérité cachée.";
  }
  if (pageNumber >= total) {
    return "PHASE : DÉNOUEMENT. Conclus l'histoire de façon satisfaisante et surprenante : la vérité cachée se révèle, " +
      "les fils ouverts se nouent, les conséquences des choix précédents apparaissent. " +
      "Ce passage est la fin : il n'y a aucun choix à proposer.";
  }
  if (pageNumber === total - 1) {
    return "PHASE : CLIMAX. Fais monter la tension au maximum, puis place le lecteur devant un dilemme final. " +
      "Les deux choix doivent mener à deux fins très différentes, chacune émotionnellement ou moralement lourde.";
  }
  if (pageNumber === total - 2) {
    return "PHASE : TOURNANT. Un retournement bouleverse la situation : un allié se révèle ambigu, un indice change le sens " +
      "de tout ce qui précède, ou la vérité cachée commence à affleurer. Les choix proposés doivent préparer le dilemme final.";
  }
  return "PHASE : DÉVELOPPEMENT. Montre les conséquences concrètes du dernier choix, ajoute une complication " +
    "ou une révélation partielle, et fais évoluer les relations. Chaque page doit changer la situation : évite de tourner en rond.";
}

function buildPrompt(input, plan) {
  const { child, total, pageNumber, isEnd } = plan;
  const age = child ? (AGES.includes(input.age) ? input.age : "6–8 ans") : null;
  const memo = String(input.memo || "").slice(0, 1500);
  const seed = String(input.seed || "").slice(0, 500);
  const selectedChoice = input.selectedChoice ? String(input.selectedChoice).slice(0, 500) : "";

  const history = Array.isArray(input.history) ? input.history.slice(-4) : [];
  // Le choix associé à une page est celui qui a été fait APRÈS elle : c'est le choix
  // stocké sur la page suivante, ou le choix en cours pour la dernière page.
  const historyText = history.map((p, i) => {
    const chosen = i + 1 < history.length ? history[i + 1].choice : selectedChoice;
    const number = pageNumber - history.length + i;
    return `Page ${number} :\n${String(p.page || "").slice(0, 3500)}\n` +
      `Choix du lecteur après cette page : ${String(chosen || "aucun").slice(0, 300)}`;
  }).join("\n\n");

  const choiceRules = isEnd
    ? `Cette page est la DERNIÈRE. Retourne "choices":[] et "fin":true.`
    : `Termine par exactement deux choix. Ils doivent être de nature opposée (par exemple : prudence contre audace, ` +
      `parler contre se taire, fuir contre affronter, faire confiance contre douter) et provoquer des conséquences très différentes. ` +
      `Chacun doit être concret, lié à ce qui vient de se passer, court (une phrase), et ne jamais révéler son issue. ` +
      `Ne numérote pas les choix.`;

  return `Tu es un auteur de romans interactifs de haut niveau, écrivant en français. ` +
`Ton but : une histoire originale, cohérente et vivante, qui donne au lecteur le sentiment que ses choix comptent vraiment.

GENRE : ${input.category}
${child
  ? `PUBLIC : enfants de ${age}. Phrases simples, vocabulaire adapté, humour et émerveillement, aucune scène effrayante ni violence. ` +
    `La surprise doit être douce : une découverte, un personnage inattendu, un renversement amusant.`
  : `PUBLIC : adolescents et adultes. Style immersif, précis et sensoriel, dialogues naturels. ` +
    `Évite les clichés du genre : préfère les détails concrets et inattendus, et des personnages aux motivations complexes.`}

ÉTAT DU RÉCIT
Page à écrire : ${pageNumber} sur ${total}.
${phaseInstruction(pageNumber, total)}

MÉMOIRE DU RÉCIT (faits établis, personnages, objets, fils ouverts, SECRET)
${memo || "(vide : c'est le début de l'histoire)"}

${historyText
  ? `PAGES PRÉCÉDENTES (les plus récentes) :\n${historyText}`
  : `POINT DE DÉPART DU LECTEUR :\n${seed || "Libre : invente un point de départ original et précis."}`}
${selectedChoice ? `CHOIX DU LECTEUR À SUIVRE MAINTENANT :\n${selectedChoice}` : ""}

RÈGLES D'ÉCRITURE
- Longueur de la page : ${child ? "120 à 220" : "250 à 380"} mots. Paragraphes courts et aérés.
- Continuité stricte : noms, lieux, objets, relations et conséquences des choix déjà faits doivent rester cohérents. ` +
`Chaque choix passé doit avoir une conséquence visible dans cette page.
- Ne répète jamais une formule, une description ou une situation déjà utilisée. Varie rythme et points de vue.
- Ne recommence pas l'histoire et n'explique pas ce que le lecteur doit ressentir.
- Surprise : un détail anodin peut devenir important plus tard. Évite le retournement gratuit : la surprise doit sembler logique après coup.
- Si le secret n'est pas encore révélé, ne le dévoile pas et ne fais que des allusions ambiguës.

CHOIX
${choiceRules}

MÉMOIRE (champ "memoire", 800 caractères maximum, mise à jour à chaque page)
Liste en quelques lignes : personnages (nom, trait, relation), lieux, objets importants, faits établis, fils ouverts, et SECRET : ...
${pageNumber === 1
  ? `Sur cette page, décide de la vérité cachée (SECRET) : une cause réelle, une identité ou un enjeu caché qui donnera un sens nouveau à l'histoire quand il sera révélé. Note-la dans "memoire" sans la révéler dans "page".`
  : ""}

TITRE
- Propose un titre de l'histoire dans le champ "titre" : court (2 à 6 mots), évocateur, sans guillemets.
- Il doit être cohérent avec l'histoire écrite jusqu'ici (personnages, lieu, enjeu, ton du genre).
- Il peut évoluer d'une page à l'autre ; sur la dernière page, il doit refléter la conclusion.

FORMAT DE RÉPONSE
Retourne uniquement un objet JSON valide, sans texte autour :
{"page":"texte de la page","choices":["premier choix","deuxième choix"],"memoire":"mise à jour de la mémoire","titre":"titre de l'histoire","fin":false}`;
}

function parseOutput(raw, isEnd) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse du modèle non structurée.");
    value = JSON.parse(match[0]);
  }
  const page = typeof value.page === "string" ? value.page.trim() : "";
  const choices = Array.isArray(value.choices)
    ? value.choices.map(x => String(x).trim()).filter(Boolean).slice(0, 2)
    : [];
  const memoire = typeof value.memoire === "string" ? value.memoire.trim().slice(0, 1200) : "";
  const titre = typeof value.titre === "string" ? value.titre.replace(/["«»]/g, "").trim().slice(0, 80) : "";
  if (!page) throw new Error("La page générée est vide.");
  if (!isEnd && choices.length !== 2) throw new Error("La réponse ne contient pas exactement deux choix.");
  return { page, choices: isEnd ? [] : choices, memoire, titre };
}

async function callGroq(env, prompt, isEnd) {
  const model = env.GROQ_MODEL || "openai/gpt-oss-20b";
  if (!GROQ_FREE_ALLOWLIST.has(model)) throw new Error("Modèle Groq non autorisé par la liste gratuite.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Tu réponds uniquement avec un JSON valide. N'ajoute aucun texte avant ou après." },
        { role: "user", content: prompt }
      ],
      temperature: 0.9,
      // Les modèles de raisonnement consomment ces tokens : la marge évite une réponse tronquée.
      max_tokens: 2500,
      reasoning_effort: "low",
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const error = new Error(`Groq HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return parseOutput(data.choices?.[0]?.message?.content || "", isEnd);
}

async function callGemini(env, prompt, isEnd) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!GEMINI_FREE_ALLOWLIST.has(model)) throw new Error("Modèle Gemini non autorisé par la liste gratuite.");
  if (env.GEMINI_FREE_CONFIRMED !== "YES_I_CONFIRMED_NO_BILLING") {
    throw new Error("Gemini désactivé : confirme d'abord que le projet n'a aucune facturation active.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: "Réponds uniquement avec un JSON valide, sans texte autour." }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 2500 }
    })
  });
  if (!response.ok) {
    const error = new Error(`Gemini HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return parseOutput(data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "", isEnd);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, freeOnly: env.FREE_ONLY === "true" });
    if (url.pathname !== "/api/story" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (env.FREE_ONLY !== "true") return json({ error: "Génération bloquée : le mode gratuit strict n'est pas activé." }, 503);
    if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return json({ error: "Aucun fournisseur IA n'est configuré." }, 503);

    let input;
    try { input = await request.json(); } catch { return json({ error: "Requête JSON invalide." }, 400); }
    if (!CATEGORIES.has(input.category)) return json({ error: "Catégorie inconnue." }, 400);
    if (JSON.stringify(input).length > MAX_BODY_CHARS) return json({ error: "Contexte trop volumineux." }, 413);

    const plan = planPage(input);
    const prompt = buildPrompt(input, plan);
    const meta = { fin: plan.isEnd, pageNumber: plan.pageNumber, totalPages: plan.total };
    const errors = [];

    if (env.GROQ_API_KEY) {
      try {
        const result = await callGroq(env, prompt, plan.isEnd);
        return json({ ...result, ...meta, provider: "Groq" });
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
        // Bascule uniquement en cas de quota, indisponibilité temporaire ou réponse mal formée.
        if (![429, 500, 502, 503, 504, undefined].includes(e.status)) {
          return json({ error: "Le fournisseur principal a refusé la requête. Aucun autre fournisseur n'a été appelé.", details: errors }, 503);
        }
      }
    }

    if (env.GEMINI_API_KEY && env.GEMINI_FREE_CONFIRMED === "YES_I_CONFIRMED_NO_BILLING") {
      try {
        const result = await callGemini(env, prompt, plan.isEnd);
        return json({ ...result, ...meta, provider: "Gemini" });
      } catch (e) {
        errors.push(`Gemini: ${e.message}`);
      }
    }
    return json({ error: "Les moteurs gratuits sont temporairement indisponibles. Aucune génération payante n'a été tentée.", details: errors }, 503);
  }
};
