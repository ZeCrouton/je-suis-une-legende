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

// ---------------------------------------------------------------------------
// FICHES DE GENRE
// Chaque genre définit non seulement un ton, mais aussi sa propre mécanique :
// ce qui fait avancer l'histoire, le type de secret, de tournant, de climax et de fin,
// et le type de choix attendus. Sans cela, tous les genres glissent vers le même
// schéma « thriller à secret ».
// ---------------------------------------------------------------------------
const GENRES = {
  "Fantasy": {
    ton: "Merveilleux épique et sensoriel. Univers aux règles magiques cohérentes, où la magie a toujours un prix. Lieux, créatures, peuples et objets concrets, nommés et distincts. Pas de prophétie ni d'« élu » tout fait.",
    narration: "troisième personne, au passé (passé simple et imparfait)",
    moteur: "une quête ou une menace qui pèse sur le monde du héros",
    secret: "une vérité cachée sur l'origine de la magie, d'un artefact, d'un allié ou du héros lui-même",
    tournant: "la magie révèle son vrai coût, ou un allié se révèle lié au camp adverse",
    climax: "un sacrifice ou un usage risqué de la magie pour sauver ce qui compte le plus",
    fin: "le monde est durablement changé : victoire qui coûte, ou perte qui ouvre un espoir",
    choix: "affronter une créature, négocier avec un peuple, utiliser un pouvoir risqué, suivre une piste ancienne, s'allier à un rival, franchir une frontière interdite"
  },
  "Science-fiction": {
    ton: "Anticipation crédible : une technologie, une découverte ou une société dont les conséquences humaines sont logiques. Détails techniques plausibles et sobres, sans jargon. Le monde vit sans le héros. L'histoire interroge ce qui fait notre humanité.",
    narration: "troisième personne, au passé (passé simple et imparfait)",
    moteur: "une découverte, une anomalie ou un système qui déraille",
    secret: "la vraie nature d'une IA, d'une expérience, d'une colonie ou de la mission",
    tournant: "la technologie ou l'institution montre son vrai visage",
    climax: "un choix entre l'humain et le système, l'individu et le collectif",
    fin: "des conséquences vertigineuses mais logiques, qui donnent à réfléchir",
    choix: "pirater un système, désobéir à un protocole, contacter une entité, tester une technologie expérimentale, révéler des données, quitter la station ou le vaisseau"
  },
  "Thriller": {
    ton: "Suspense haletant et compte à rebours. Phrases courtes et nerveuses. Le héros est traqué ou piégé et l'étau se resserre à chaque page. Informations au compte-gouttes, personne n'est vraiment fiable.",
    narration: "troisième personne, au présent de narration, au plus près du héros",
    moteur: "un danger immédiat et une échéance",
    secret: "l'identité réelle de l'ennemi ou du commanditaire, ou une trahison très proche du héros",
    tournant: "le refuge ou l'allié devient le piège",
    climax: "la confrontation directe avec l'ennemi, alors que le temps presse",
    fin: "un dénouement sec et surprenant : la menace est neutralisée ou triomphe",
    choix: "rejoindre un lieu précis, piéger le poursuivant, contacter quelqu'un de dangereux, voler une preuve, se livrer pour gagner du temps, retourner l'arme de l'ennemi contre lui"
  },
  "Horreur": {
    ton: "Angoisse lente et atmosphère oppressante. La peur est suggérée : bruits, détails qui clochent, absences, silences. Le quotidien se fissure par étapes. Pas de gore gratuit ; l'horreur grandit et ne s'explique jamais complètement.",
    narration: "troisième personne, au passé (passé simple et imparfait), focalisée sur les perceptions du héros",
    moteur: "une présence ou un phénomène qui s'immisce dans un lieu ou dans une vie",
    secret: "ce qu'est vraiment la présence, et pourquoi elle a choisi le héros",
    tournant: "le héros comprend qu'il est lié à la menace, ou que la fuite est impossible",
    climax: "le face-à-face avec l'horreur",
    fin: "une fin marquante, qui peut rester inquiétante ou amère ; un dernier détail glaçant est permis",
    choix: "entrer dans le lieu interdit, détruire un objet, parler à la présence, fouiller le passé d'un mort, protéger quelqu'un, accomplir un rite"
  },
  "Romance": {
    ton: "Émotion, tension et attirance contrariée entre deux personnages au cœur du récit. Dialogues chargés de sous-texte, regards, gestes, non-dits. Obstacles crédibles : passé, loyauté, malentendu, différence de milieu. L'attachement se construit par des scènes partagées, pas par un coup de foudre gratuit. Pas de crime, de complot, de monstre ni d'enquête, sauf si l'idée de départ le demande.",
    narration: "troisième personne, au passé (passé simple et imparfait), centrée sur les émotions du personnage principal",
    moteur: "la rencontre de deux personnes que tout pousse l'une vers l'autre et que quelque chose sépare",
    secret: "un sentiment caché, une blessure passée ou un engagement qui complique tout",
    tournant: "un malentendu ou une révélation intime menace de tout briser",
    climax: "un aveu, un départ ou un choix entre l'amour et une autre chose essentielle",
    fin: "une résolution émotionnelle forte (union, séparation assumée ou promesse) qui semble méritée",
    choix: "avouer quelque chose, provoquer une rencontre, partir avec l'autre, défendre l'autre en public, rompre une promesse, accepter une invitation inattendue"
  },
  "Aventure": {
    ton: "Dépaysement, action et exploration. Lieux spectaculaires et concrets, obstacles physiques, compagnons aux personnalités marquées. Rythme soutenu : chaque page apporte un nouveau lieu ou un nouveau défi.",
    narration: "troisième personne, au passé (passé simple et imparfait)",
    moteur: "un voyage vers un but : trésor, personne à retrouver, lieu légendaire",
    secret: "ce que cache vraiment le but de l'expédition, ou les intentions réelles d'un compagnon",
    tournant: "la carte ment, un compagnon trahit, ou le but n'est pas ce qu'on croyait",
    climax: "une épreuve physique ultime au cœur du lieu final",
    fin: "un retour transformé : but atteint, ou abandonné pour quelque chose de plus précieux",
    choix: "traverser un obstacle naturel, prendre un raccourci dangereux, suivre un guide inconnu, plonger, escalader, échanger un objet précieux"
  },
  "Policier": {
    ton: "Enquête rigoureuse et réaliste. Un crime, des suspects aux mobiles crédibles, des indices concrets (objets, horaires, témoignages), des fausses pistes et des contradictions. Interrogatoires vifs et déductions logiques. Le lecteur doit pouvoir résoudre l'affaire avec les indices donnés.",
    narration: "troisième personne, au passé (passé simple et imparfait)",
    moteur: "un crime à élucider par un enquêteur (policier, détective ou amateur)",
    secret: "le vrai coupable, son mobile et sa méthode ; le coupable doit apparaître tôt dans le récit, sans être désigné",
    tournant: "un indice clé change de sens, ou le suspect principal est brutalement innocenté",
    climax: "la confrontation où l'enquêteur expose ou piège le coupable",
    fin: "la révélation claire du coupable, cohérente avec tous les indices semés",
    choix: "interroger un suspect précis, fouiller un lieu, vérifier un alibi, tendre un piège, confronter deux témoins, filer quelqu'un"
  },
  "Mystère": {
    ton: "Énigme envoûtante, entre rationnel et inexplicable. Un phénomène étrange, un lieu chargé d'histoire, des documents anciens, des légendes locales. Les questions s'accumulent et chaque révélation change le sens des précédentes. Atmosphère feutrée plutôt que violence.",
    narration: "troisième personne, au passé (passé simple et imparfait)",
    moteur: "un phénomène inexpliqué ou une disparition ancienne",
    secret: "l'explication de l'énigme, surprenante mais logique, qu'elle soit rationnelle ou surnaturelle",
    tournant: "un document ou un témoin réécrit l'histoire que tout le monde croyait connaître",
    climax: "le héros touche au cœur de l'énigme, au prix d'un risque",
    fin: "une révélation qui recompose tous les indices, avec une part de mystère poétique possible",
    choix: "déchiffrer un document, explorer une pièce condamnée, rencontrer un témoin du passé, reproduire un rituel, suivre une légende"
  },
  "Comédie": {
    ton: "Humour de situation, quiproquos et répliques qui font mouche. Personnages excentriques mais cohérents, catastrophes en cascade, ironie bienveillante. Le rire naît de l'escalade : chaque solution crée un problème plus gros. Rien de vraiment grave ni de sombre. Pas de blagues forcées.",
    narration: "troisième personne, au passé, ton léger et malicieux (le narrateur peut glisser des remarques ironiques)",
    moteur: "une situation ordinaire qui dérape à cause d'un mensonge, d'un malentendu ou d'un pari",
    secret: "le malentendu central, ou la vérité gênante que le héros cache à tout le monde",
    tournant: "tous les mensonges risquent d'être découverts en même temps",
    climax: "tout le monde se retrouve au même endroit et le quiproquo explose",
    fin: "un dénouement joyeux et inattendu, avec une dernière chute drôle",
    choix: "mentir encore plus gros, se déguiser, avouer au pire moment, improviser un plan absurde, demander de l'aide à la mauvaise personne"
  },
  "Conte pour enfant": {
    ton: "Merveilleux doux et chaleureux : animaux qui parlent, objets enchantés, forêts amicales. Rebondissements gentils et rassurants, entraide et courage. Une leçon implicite, jamais énoncée comme une morale. Aucune peur réelle, aucune violence.",
    narration: "troisième personne, au passé, ton de conteur",
    moteur: "un petit problème à résoudre ou un souhait à réaliser",
    secret: "une gentille surprise : un personnage qui n'est pas ce qu'il semble, un cadeau caché",
    tournant: "un obstacle inattendu, que l'amitié ou l'astuce permettra de surmonter",
    climax: "le héros doit faire preuve de courage, de générosité ou d'astuce",
    fin: "une fin heureuse et réconfortante",
    choix: "demander de l'aide à un animal, partager un objet, traverser un lieu enchanté, essayer une idée astucieuse, consoler quelqu'un"
  }
};

const CHILD_AGE_GUIDES = {
  "3–5 ans": { words: "80 à 140", style: "Phrases très courtes (moins de 12 mots), mots du quotidien, répétitions et onomatopées bienvenues, un seul fil d'action, 2 ou 3 personnages au maximum. Choix de 8 mots au maximum." },
  "6–8 ans": { words: "130 à 200", style: "Phrases simples, vocabulaire courant avec parfois un mot nouveau compréhensible grâce au contexte, dialogues vivants, humour." },
  "9–12 ans": { words: "180 à 260", style: "Récit plus riche : suspense doux, personnages nuancés, vocabulaire varié, aventure et mystère, toujours sans violence ni scène effrayante." }
};

// Chaque page a un rôle dans la structure dramatique, adapté au genre.
// Le rôle est imposé par le code, pour que la fin arrive toujours et que la tension monte.
function phaseInstruction(pageNumber, total, g) {
  if (pageNumber === 1) {
    return `OUVERTURE. Lance l'histoire avec ${g.moteur}. Présente le protagoniste (nom, désir, faiblesse) directement en situation, ` +
      `sème un détail anodin qui comptera plus tard, et termine la page sur un moment de décision.`;
  }
  if (pageNumber >= total) {
    return `DÉNOUEMENT. ${capitalize(g.fin)}. Le secret se révèle, les fils ouverts se nouent, les choix précédents pèsent sur l'issue. ` +
      `C'est la fin : aucun choix à proposer.`;
  }
  if (pageNumber === total - 1) {
    return `CLIMAX. ${capitalize(g.climax)}. Fais monter la tension au maximum, puis place le lecteur devant un dilemme final : ` +
      `les deux choix mènent à deux fins très différentes.`;
  }
  if (pageNumber === total - 2) {
    return `TOURNANT. ${capitalize(g.tournant)}. Le secret commence à affleurer. Les choix proposés préparent le dilemme final.`;
  }
  return `DÉVELOPPEMENT. Réalise ce que le choix déclenche, puis ajoute une complication nouvelle ou une révélation partielle. ` +
    `L'intrigue progresse d'une étape réelle vers le dénouement.`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------------------
// PROMPT
// - Message système : les règles fixes de l'histoire (genre, voix, écriture, choix, format).
// - Message utilisateur : l'état du récit, le texte déjà lu, le choix et sa conséquence prévue,
//   puis, tout à la fin, les dernières lignes lues : c'est ce que le modèle voit en dernier
//   avant d'écrire, ce qui l'aide à enchaîner au lieu de recommencer un nouveau chapitre.
// ---------------------------------------------------------------------------
function buildSystemPrompt(input, plan) {
  const { child, isEnd } = plan;
  const g = GENRES[input.category];
  const age = child ? (AGES.includes(input.age) ? input.age : "6–8 ans") : null;
  const ageGuide = child ? CHILD_AGE_GUIDES[age] : null;
  const words = child ? ageGuide.words : "250 à 380";

  const publicLine = child
    ? `PUBLIC : enfants de ${age}. ${ageGuide.style} Aucune scène effrayante ni violence. Les surprises sont douces : une découverte, un personnage inattendu, un renversement amusant.`
    : `PUBLIC : adolescents et adultes. Style immersif, précis et sensoriel, dialogues naturels. Évite les clichés du genre : détails concrets et inattendus, personnages aux motivations complexes.`;

  const choiceRules = isEnd
    ? `Cette page est la dernière : "choix" est une liste vide et "fin" vaut true.`
    : `Propose exactement deux choix. Chacun contient :
- "texte" : ce que le lecteur voit. Une action concrète en une phrase courte (14 mots maximum) qui commence par un verbe à l'infinitif et vise une cible précise (qui, quoi, où). Ne révèle pas l'issue.
- "suite" : invisible pour le lecteur. En une ou deux phrases, l'événement concret que ce choix déclenchera au début de la page suivante, et en quoi il fait avancer l'intrigue.
Règles impératives :
- LES DEUX CHOIX FONT AVANCER L'HISTOIRE. Il n'y a pas de « bon » choix et de choix « prudent » : ce sont deux stratégies actives et différentes, qui mènent chacune à une situation NOUVELLE (lieu, personnage, révélation, danger, objet gagné ou perdu, alliance ou rupture).
- Interdit pour les deux choix : attendre, réfléchir, observer encore, se cacher, faire demi-tour, rentrer, se reposer, demander une explication de plus, ou toute action qui ramène à une situation déjà vécue (voir « déjà vécu » dans la mémoire).
- Les deux suites doivent être nettement différentes l'une de l'autre et rapprocher toutes deux l'histoire de son dénouement.
- Choix typiques de ce genre : ${g.choix}.`;

  return `Tu es un romancier français de grand talent qui écrit, page après page, UN SEUL roman interactif continu. ` +
`Le lecteur vit l'histoire de l'intérieur : ses choix comptent vraiment et l'histoire avance à chaque page.

GENRE : ${input.category}
TON ET STYLE DU GENRE : ${g.ton}
NARRATION IMPOSÉE POUR TOUTE L'HISTOIRE : ${g.narration}. Ne change jamais de personne ni de temps d'une page à l'autre.
${publicLine}

CONTINUITÉ (règle la plus importante)
Chaque page est la suite immédiate de la précédente, comme la page suivante d'un même livre ouvert : même scène, même instant, même tension.
- La première phrase reprend exactement là où la dernière ligne lue s'arrête et montre déjà l'effet du choix du lecteur. Elle ne doit avoir de sens que pour quelqu'un qui vient de lire la page précédente.
- Interdit au début d'une page (sauf la page 1) : titre, numéro, « Chapitre », description du temps qu'il fait ou du lever du jour, présentation du décor ou du héros, formules d'ouverture (« Il était une fois », « Ce jour-là », « Le lendemain », « Dans la ville de… »), résumé ou rappel de ce qui précède, reformulation du choix (« Elle décida de… »).
- Ne saute ni de lieu ni de temps sans raison. Si c'est nécessaire, fais-le après avoir montré l'effet du choix, en une courte phrase de transition.

ÉCRITURE
- Longueur : ${words} mots, en paragraphes courts.
- Faits cohérents : noms, lieux, objets, relations et conséquences des choix passés restent les mêmes.
- Ne répète jamais une formule, une description ou une situation déjà écrite.
- Montre, n'explique pas ce que le lecteur doit ressentir.
- Les surprises doivent sembler logiques après coup. Tant que le secret n'est pas révélé, n'y fais que des allusions ambiguës.
- Termine la page sur une tension ou une question qui appelle la décision.

CHOIX
${choiceRules}

MÉMOIRE (champ "memoire", 1000 caractères maximum, réécrite entièrement à chaque page)
Lignes courtes, dans cet ordre :
OBJECTIF : ce que veut le héros et ce qui l'en empêche
PERSONNAGES : nom, trait, relation
LIEUX ET OBJETS importants
DÉJÀ VÉCU : une ligne très brève par page écrite, pour ne jamais revenir en arrière
FILS OUVERTS
SECRET : ${g.secret} (décidé dès la page 1, jamais modifié, révélé seulement au dénouement)

TITRE
Champ "titre" obligatoire : 2 à 6 mots, évocateur, sans guillemets, cohérent avec l'histoire (il peut évoluer ; à la dernière page, il reflète la conclusion).

FORMAT DE RÉPONSE
Réponds uniquement avec un objet JSON valide, sans texte autour. Le texte de la page est découpé en paragraphes dans une liste : n'écris jamais « \\n » ni « /n » dans les textes.
{"paragraphes":["premier paragraphe","deuxième paragraphe"],"choix":[{"texte":"…","suite":"…"},{"texte":"…","suite":"…"}],"memoire":"…","titre":"…","fin":${isEnd}}`;
}

function buildUserPrompt(input, plan) {
  const { total, pageNumber, isEnd } = plan;
  const g = GENRES[input.category];
  const memo = String(input.memo || "").slice(0, 1600);
  const seed = String(input.seed || "").slice(0, 500);
  const selectedChoice = input.selectedChoice ? String(input.selectedChoice).slice(0, 300) : "";
  const selectedDirection = input.selectedDirection ? String(input.selectedDirection).slice(0, 500) : "";

  const history = Array.isArray(input.history) ? input.history.slice(-4) : [];
  const pages = history.map(p => cleanStoryText(String(p.page || "")).slice(0, 3500));

  const state = `PAGE À ÉCRIRE : ${pageNumber} sur ${total}${isEnd ? " (dernière page)" : ""}.\nRÔLE DE CETTE PAGE : ${phaseInstruction(pageNumber, total, g)}`;

  if (!pages.length) {
    return `${state}

IDÉE DE DÉPART DU LECTEUR : ${seed || "libre : invente un point de départ original et précis, propre au genre."}

Écris maintenant la page 1.`;
  }

  // Le texte déjà écrit est présenté comme UN SEUL récit continu, chaque choix
  // étant inscrit juste après le passage qu'il suit.
  const storySoFar = pages.map((page, i) => {
    const chosen = i + 1 < history.length ? history[i + 1].choice : "";
    const decision = chosen && chosen !== "Début" ? `\n[Le lecteur a choisi : ${String(chosen).slice(0, 300)}]` : "";
    return page + decision;
  }).join("\n\n");

  const lastPage = pages[pages.length - 1];
  const lastLines = lastPage.split(/\n+/).filter(Boolean).slice(-2).join("\n").slice(-600);
  const skipped = pageNumber - 1 - pages.length;

  return `${state}

MÉMOIRE DU RÉCIT :
${memo || "(vide)"}

TEXTE DÉJÀ LU PAR LE LECTEUR${skipped > 0 ? ` (les ${skipped} premières pages sont résumées dans la mémoire)` : ""} :
${storySoFar}

CHOIX DU LECTEUR À LA FIN DE CETTE PAGE : « ${selectedChoice || "continuer"} »
${selectedDirection ? `CE QUE CE CHOIX DÉCLENCHE (prévu à la page précédente) : ${selectedDirection}\nRéalise-le dès le premier paragraphe, puis va plus loin.\n` : ""}
DERNIÈRES LIGNES LUES (ta page commence juste après, sans coupure) :
« ${lastLines} »

Écris maintenant la page ${pageNumber}, suite directe et immédiate de ces lignes.`;
}

// ---------------------------------------------------------------------------
// NETTOYAGE ET LECTURE DE LA RÉPONSE
// ---------------------------------------------------------------------------

// Le modèle écrit parfois un saut de ligne sous forme de texte (\n, \\n, /n) : on le remplace par un vrai saut.
function cleanStoryText(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\\+r\\+n|\\+n|\\+r/g, "\n")
    .replace(/\\+t/g, " ")
    .replace(/(?:\/n)+(?=[\s"«A-ZÀ-ÖØ-Þa-zà-öø-ÿ0-9—–\-.,!?…]|$)/g, "\n")
    .replace(/\*\*|__/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Retire un éventuel en-tête (« Page 3 », « Chapitre 2 », titre) placé au début de la page.
function stripHeading(paragraphs, title) {
  const list = [...paragraphs];
  const t = String(title || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  while (list.length > 1) {
    const first = list[0].trim();
    const norm = first.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const isHeading = /^(#+\s*)?(page|chapitre|partie|épisode)\s*[\divxlc]+\b/i.test(first) && first.length < 80;
    const isTitle = t && norm === t;
    if (isHeading || isTitle) list.shift(); else break;
  }
  return list;
}

function toParagraphs(value) {
  const raw = Array.isArray(value.paragraphes) ? value.paragraphes.join("\n\n")
    : typeof value.page === "string" ? value.page
    : Array.isArray(value.page) ? value.page.join("\n\n")
    : "";
  return cleanStoryText(raw).split(/\n+/).map(p => p.trim()).filter(Boolean);
}

function parseChoices(value) {
  const list = Array.isArray(value.choix) ? value.choix : Array.isArray(value.choices) ? value.choices : [];
  return list.map(c => {
    if (c && typeof c === "object") {
      return { texte: String(c.texte || c.text || c.choix || ""), suite: String(c.suite || c.consequence || "") };
    }
    return { texte: String(c || ""), suite: "" };
  }).map(c => ({
    texte: cleanStoryText(c.texte).replace(/\s*\n+\s*/g, " ").replace(/^\s*(\d+[.)]|[-•])\s*/, "").trim(),
    suite: cleanStoryText(c.suite).replace(/\s*\n+\s*/g, " ").trim()
  })).filter(c => c.texte).slice(0, 2);
}

function parseOutput(raw, isEnd) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse du modèle non structurée.");
    value = JSON.parse(match[0]);
  }
  const titre = typeof value.titre === "string"
    ? cleanStoryText(value.titre).replace(/\n+/g, " ").replace(/["«»*#]/g, "").trim().slice(0, 80)
    : "";
  const paragraphs = stripHeading(toParagraphs(value), titre);
  const page = paragraphs.join("\n\n");
  const choices = parseChoices(value);
  const memoire = typeof value.memoire === "string" ? cleanStoryText(value.memoire).slice(0, 1400) : "";
  if (!page) throw new Error("La page générée est vide.");
  if (!isEnd && choices.length !== 2) throw new Error("La réponse ne contient pas exactement deux choix.");
  return {
    page,
    choices: isEnd ? [] : choices.map(c => c.texte),
    directions: isEnd ? [] : choices.map(c => c.suite),
    memoire,
    titre
  };
}

// ---------------------------------------------------------------------------
// FOURNISSEURS
// ---------------------------------------------------------------------------
async function callGroq(env, prompts, isEnd) {
  const model = env.GROQ_MODEL || "openai/gpt-oss-20b";
  if (!GROQ_FREE_ALLOWLIST.has(model)) throw new Error("Modèle Groq non autorisé par la liste gratuite.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      temperature: 0.8,
      // Les modèles de raisonnement consomment ces tokens : la marge évite une réponse tronquée.
      max_tokens: 3000,
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

async function callGemini(env, prompts, isEnd) {
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
      system_instruction: { parts: [{ text: prompts.system }] },
      contents: [{ role: "user", parts: [{ text: prompts.user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 3000 }
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

// Secours : si le modèle n'a pas fourni de titre, on en demande un à part, à partir du passage.
async function requestTitle(env, category, page, memo) {
  const model = env.GROQ_MODEL || "openai/gpt-oss-20b";
  if (!env.GROQ_API_KEY || !GROQ_FREE_ALLOWLIST.has(model)) return "";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Tu réponds uniquement par le titre demandé, sans guillemets, sans ponctuation finale et sans commentaire." },
        { role: "user", content:
          `Propose un titre court (2 à 6 mots), évocateur et cohérent avec ce passage d'une histoire interactive (genre : ${category}).\n\n` +
          `MÉMOIRE DU RÉCIT :\n${String(memo || "").slice(0, 800)}\n\nPASSAGE :\n${String(page).slice(0, 2000)}` }
      ],
      temperature: 0.7,
      max_tokens: 300,
      reasoning_effort: "low"
    })
  });
  if (!response.ok) return "";
  const data = await response.json();
  const raw = String(data.choices?.[0]?.message?.content || "").trim().split("\n")[0];
  return raw.replace(/["«»*#]/g, "").replace(/[.!?:]+$/, "").trim().slice(0, 80);
}

async function withTitle(env, input, result, meta, provider) {
  let titre = result.titre;
  if (!titre) {
    titre = await requestTitle(env, input.category, result.page, result.memoire).catch(() => "");
  }
  return json({ ...result, titre, ...meta, provider });
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
    const prompts = { system: buildSystemPrompt(input, plan), user: buildUserPrompt(input, plan) };
    const meta = { fin: plan.isEnd, pageNumber: plan.pageNumber, totalPages: plan.total };
    const errors = [];

    if (env.GROQ_API_KEY) {
      try {
        const result = await callGroq(env, prompts, plan.isEnd);
        return withTitle(env, input, result, meta, "Groq");
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
        const result = await callGemini(env, prompts, plan.isEnd);
        return withTitle(env, input, result, meta, "Gemini");
      } catch (e) {
        errors.push(`Gemini: ${e.message}`);
      }
    }
    return json({ error: "Les moteurs gratuits sont temporairement indisponibles. Aucune génération payante n'a été tentée.", details: errors }, 503);
  }
};
