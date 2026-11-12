const CATEGORIES = new Set([
  "Fantasy", "Science-fiction", "Thriller", "Horreur", "Romance",
  "Aventure", "Policier", "Mystère", "Conte pour enfant", "Comédie"
]);

// Modèles explicitement autorisés pour cette version.
// À vérifier régulièrement dans les pages tarifaires et de modèles officielles.
const GROQ_FREE_ALLOWLIST = new Set(["openai/gpt-oss-20b"]);
const GEMINI_FREE_ALLOWLIST = new Set(["gemini-2.5-flash"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function buildPrompt(input) {
  const child = input.category === "Conte pour enfant";
  const age = child ? (["3–5 ans", "6–8 ans", "9–12 ans"].includes(input.age) ? input.age : "6–8 ans") : null;
  const history = Array.isArray(input.history) ? input.history.slice(-6) : [];
  const historyText = history.map((p, i) =>
    `Page ${i + 1}:\n${String(p.page || "").slice(0, 3500)}\nChoix retenu ensuite: ${String(p.choice || "Début").slice(0, 300)}`
  ).join("\n\n");

  return `Tu es le moteur narratif de l'application Je suis une légende. Tu écris en français.
Genre: ${input.category}.
${child ? `Public: enfants de ${age}. Vocabulaire et phrases adaptés, histoire bienveillante et rassurante, sans scènes effrayantes ni violence.` : "Public: adolescents et adultes. Style immersif, naturel, vivant et fluide."}
Objectif: produire UNE page de roman interactif, assez courte pour être lue confortablement.
Règles impératives:
- Environ 250 à 350 mots maximum (conte enfant: 120 à 220 mots).
- Paragraphes courts et aérés.
- Maintiens strictement la continuité des personnages, noms, lieux, événements et objets déjà établis.
- Évite les répétitions et varie descriptions, actions et dialogues.
- Ne recommence jamais l'histoire.
- Termine par exactement deux choix distincts, concrets et cohérents avec la page.
- Les choix doivent être formulés pour le lecteur et ne doivent pas être numérotés dans le champ JSON.
- Retourne uniquement un objet JSON valide de la forme {"page":"texte de la page","choices":["premier choix","deuxième choix"]}.
${historyText ? `CONTEXTE DES PAGES PRÉCÉDENTES:\n${historyText}` : `POINT DE DÉPART:\n${String(input.seed || "Un personnage découvre un événement inattendu.").slice(0, 500)}`}
${input.selectedChoice ? `CHOIX DU LECTEUR À SUIVRE:\n${String(input.selectedChoice).slice(0, 500)}` : ""}
`;
}

function parseOutput(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse du modèle non structurée.");
    value = JSON.parse(match[0]);
  }
  const page = typeof value.page === "string" ? value.page.trim() : "";
  const choices = Array.isArray(value.choices) ? value.choices.map(x => String(x).trim()).filter(Boolean).slice(0, 2) : [];
  if (!page || choices.length !== 2) throw new Error("La réponse ne contient pas exactement deux choix.");
  return { page, choices };
}

async function callGroq(env, prompt) {
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
      temperature: 0.85,
      max_tokens: 900,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const error = new Error(`Groq HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return parseOutput(data.choices?.[0]?.message?.content || "");
}

async function callGemini(env, prompt) {
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
      generationConfig: { responseMimeType: "application/json", temperature: 0.85, maxOutputTokens: 900 }
    })
  });
  if (!response.ok) {
    const error = new Error(`Gemini HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return parseOutput(data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "");
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
    if (JSON.stringify(input).length > 24000) return json({ error: "Contexte trop volumineux." }, 413);

    const prompt = buildPrompt(input);
    const errors = [];

    if (env.GROQ_API_KEY) {
      try {
        const result = await callGroq(env, prompt);
        return json({ ...result, provider: "Groq" });
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
        const result = await callGemini(env, prompt);
        return json({ ...result, provider: "Gemini" });
      } catch (e) {
        errors.push(`Gemini: ${e.message}`);
      }
    }
    return json({ error: "Les moteurs gratuits sont temporairement indisponibles. Aucune génération payante n'a été tentée.", details: errors }, 503);
  }
};
