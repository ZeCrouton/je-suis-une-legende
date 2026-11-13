const CATEGORIES = new Set([
  "Fantasy", "Science-fiction", "Thriller", "Horreur", "Romance",
  "Aventure", "Policier", "Mystère", "Conte pour enfant", "Comédie"
]);

const AGES = ["3–5 ans", "6–8 ans", "9–12 ans"];

// Longueur d'un récit complet, en nombre de pages.
const TOTAL_PAGES_ADULT = 10;
const TOTAL_PAGES_CHILD = 7;


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

// Prénom du lecteur-héros : lettres, espaces, tirets et apostrophes uniquement (4 mots maximum).
// Tout le reste est ignoré : ce texte est inséré dans la consigne donnée à l'IA.
function cleanHero(value) {
  const name = String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 30);
  if (!/^\p{L}[\p{L}\p{M}'’ -]*$/u.test(name)) return "";
  if (name.split(" ").length > 4) return "";
  return name.replace(/(^|[\s'’-])(\p{L})/gu, (m, sep, letter) => sep + letter.toUpperCase());
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
    ton: "Suspense haletant, une échéance qui approche. Phrases courtes et nerveuses. Le héros est traqué ou piégé et l'étau se resserre à chaque page. Informations au compte-gouttes, personne n'est vraiment fiable.",
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
    return `OUVERTURE. Écris d'abord la bible, puis la page 1 : lance l'histoire avec ${g.moteur}. Présente le héros en situation, avec un geste ou un objet qui intrigue sans rien expliquer, ` +
      `sème un détail anodin qui comptera plus tard, et termine sur un moment de décision.`;
  }
  if (pageNumber >= total) {
    return `DÉNOUEMENT. Dans les premiers paragraphes, montre comment le choix final règle la confrontation, par les actes du héros et grâce aux détails semés plus tôt (aucun hasard, aucun sauveur tombé du ciel). ` +
      `${capitalize(g.fin)}. Puis prends le temps de l'après : ce que deviennent les personnages principaux, la blessure du héros apaisée ou assumée, un dernier échange avec un personnage cher, une dernière image qui fait écho au début. ` +
      `Le secret est révélé s'il ne l'est pas encore. Pas de nouvelle action. Aucun choix à proposer.`;
  }
  if (pageNumber === total - 1) {
    return `CLIMAX. ${capitalize(g.climax)}. Tout ce qui a été semé converge ici. Termine sur le dilemme final : les deux choix mènent à deux fins très différentes, et l'un touche directement à la blessure du héros.`;
  }
  if (pageNumber === total - 2) {
    return `TOURNANT. ${capitalize(g.tournant)}. Le secret affleure. Les choix préparent le dilemme final.`;
  }
  return `DÉVELOPPEMENT. Réalise l'effet du choix, puis atteins l'étape prévue par la trame pour cette page : l'intrigue progresse d'une étape réelle.`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------------------
// RECETTE DE PAGE
// Les modèles ne varient pas d'eux-mêmes : à chaque page, ils retombent sur le même schéma
// (« un secret, un twist fort, deux options d'un même geste »). C'est donc le CODE qui tire,
// de façon déterministe à partir de l'identifiant de l'histoire, une recette par page :
// intensité du rebondissement, source du dilemme, et deux familles d'action différentes.
// Le rythme est mélangé selon des contraintes (pages calmes, un seul gros tournant, etc.).
// ---------------------------------------------------------------------------
function seededRandom(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TWIST_LEVELS = {
  0: "PAGE CALME : aucun rebondissement. Approfondis un personnage, une relation, une atmosphère, un lieu ; laisse respirer. La tension reste sourde. Le dilemme de fin de page naît d'une situation humaine, pas d'un choc.",
  1: "PETIT IMPRÉVU : un détail qui cloche, une phrase qui sonne faux, un objet mal placé, un visiteur ou une rencontre inattendue. Rien de spectaculaire, mais le lecteur sent que quelque chose bouge.",
  2: "RETOURNEMENT MOYEN : une information, une alliance ou un plan bascule. Une certitude du héros se fissure, sans tout renverser.",
  3: "COUP DE THÉÂTRE : une révélation ou un événement qui change le sens de ce qui précède. Il doit être préparé par des détails déjà semés et logique après coup."
};

const DILEMMA_SOURCES = {
  conflit: "un conflit entre deux personnages (désaccord, jalousie, loyautés opposées) dans lequel le héros est pris",
  decor: "un carrefour dans le décor (deux voies, un passage, un obstacle naturel ou une configuration des lieux qui impose une direction)",
  valeur: "un conflit de valeurs (loyauté contre vérité, justice contre pitié, liberté contre sécurité)",
  desir: "la peur contre le désir : ce que le héros veut vraiment s'oppose à ce qu'il redoute",
  temps: "une échéance : ce qui doit être fait avant un moment précis, au détriment d'autre chose",
  objet: "un objet ou un avantage qu'il faudrait sacrifier, donner ou perdre pour obtenir autre chose",
  secret: "un secret que le héros détient ou découvre et qu'il peut taire ou utiliser",
  visiteur: "l'arrivée inattendue de quelqu'un ou de quelque chose qui oblige à réagir tout de suite",
  passe: "la conséquence d'un choix passé qui revient frapper le héros (précise lequel)",
  regle: "une contrainte qui impose un prix : loi, règlement, promesse faite, code d'honneur, interdit (règle magique seulement dans un genre surnaturel)"
};

const ACTION_FAMILIES = {
  agir: "agir de front : affronter, forcer, poursuivre, bloquer, saisir",
  parler: "parler : négocier, mentir, avouer, convaincre, menacer, appeler à l'aide",
  enquêter: "chercher et comprendre : fouiller, suivre, interroger, déchiffrer, comparer des indices",
  outil: "utiliser un objet, un savoir-faire, un pouvoir ou un lieu de façon ingénieuse",
  allié: "se tourner vers quelqu'un : demander de l'aide, protéger, confier, rompre ou nouer une alliance",
  risque: "tenter l'inconnu : s'aventurer, franchir, plonger, parier sur l'instinct",
  sacrifice: "renoncer ou payer : donner, perdre, laisser derrière soi, assumer un coût",
  piège: "ruser : détourner l'attention, tendre un piège, simuler, se faire passer pour un autre",
  révéler: "dévoiler ou rendre public : exposer un secret, confronter quelqu'un, dire la vérité à voix haute"
};

function pickDistinct(rand, list, count, avoid) {
  const pool = list.filter(x => !avoid.includes(x));
  const source = pool.length >= count ? pool : list;
  const out = [];
  while (out.length < count && source.length) {
    const candidate = source[Math.floor(rand() * source.length)];
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

// Intensités des rebondissements pour toute l'histoire (index 0 = page 1). -1 = pas de rebondissement (dénouement).
function twistRhythm(rand, total, child) {
  const last = total - 1;
  const fixed = [];
  fixed[0] = 1;
  fixed[last] = -1;
  fixed[last - 1] = 2;       // climax
  fixed[last - 2] = 3;       // tournant
  const middle = [];
  for (let i = 1; i <= last - 3; i++) middle.push(i);
  const maxStrong = child ? 1 : 2;
  const calmTarget = child ? 1 : (rand() < 0.5 ? 1 : 2);

  const valid = levels => {
    const mid = middle.map(i => levels[i]);
    const calm = mid.filter(v => v === 0).length;
    const strong = mid.filter(v => v === 3).length;
    if (calm < 1 || calm > calmTarget) return false;
    if (strong > maxStrong) return false;
    if (levels[last - 3] === 3 || levels[last - 3] === undefined) return false;
    for (let i = 1; i < levels.length; i++) if (levels[i] === 3 && levels[i - 1] === 3) return false;
    // Il faut une vraie variété : au moins trois intensités différentes dans l'histoire.
    return new Set(levels.filter(v => v >= 0)).size >= 3;
  };

  for (let attempt = 0; attempt < 300; attempt++) {
    const levels = [...fixed];
    for (const i of middle) {
      const r = rand();
      levels[i] = r < 0.25 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
    }
    if (valid(levels)) return levels;
  }
  // Solution de repli sûre.
  const levels = [...fixed];
  const pattern = [2, 0, 1, 3, 1, 2];
  middle.forEach((i, k) => { levels[i] = pattern[k % pattern.length]; });
  if (levels[last - 3] === 3) levels[last - 3] = 2;
  return levels;
}

// Recette complète de l'histoire : une entrée par page (dilemmes et actions absents au dénouement).
function storyRecipes(input, total, child) {
  const rand = seededRandom(`${input.storyId || input.seed || "histoire"}|${input.category}|${total}`);
  const levels = twistRhythm(rand, total, child);
  const sources = Object.keys(DILEMMA_SOURCES);
  const families = Object.keys(ACTION_FAMILIES);
  const recipes = [];
  let previousFamilies = [];
  for (let i = 0; i < total; i++) {
    const recipe = { twist: levels[i] };
    if (i < total - 1) {
      const used = recipes.map(r => r.source).filter(Boolean);
      const avoid = [...used.slice(-2)];
      if (i < 2) avoid.push("passe");
      if (i === 0) avoid.push("visiteur");
      recipe.source = pickDistinct(rand, sources, 1, avoid)[0];
      recipe.families = pickDistinct(rand, families, 2, previousFamilies);
      previousFamilies = recipe.families;
    }
    recipes.push(recipe);
  }
  return recipes;
}

// ---------------------------------------------------------------------------
// INSPIRATIONS D'AUTEURS
// Deux auteurs sont tirés par histoire (selon son identifiant) : une voix cohérente du début à la fin,
// différente d'une histoire à l'autre. L'IA s'inspire de la manière d'écrire, telle qu'on la lit en français.
// ---------------------------------------------------------------------------
const AUTHORS = {
  "Fantasy": [
    ["J.R.R. Tolkien", "souffle épique, lieux chargés d'histoire"],
    ["Ursula K. Le Guin", "sobriété, magie qui a un prix"],
    ["Robin Hobb", "personnages fragiles, lente montée de l'émotion"],
    ["Terry Pratchett", "ironie, observation humaine"],
    ["Joe Abercrombie", "réalisme brut, héros ambigus"]
  ],
  "Science-fiction": [
    ["Isaac Asimov", "idées claires, dialogues et raisonnement"],
    ["Philip K. Dick", "doute sur la réalité, paranoïa"],
    ["Ray Bradbury", "poésie, nostalgie, images fortes"],
    ["Frank Herbert", "politique, intrigues, vision à long terme"],
    ["Liu Cixin", "échelle cosmique, dilemmes froids"]
  ],
  "Thriller": [
    ["Harlan Coben", "rebondissements, secrets de famille"],
    ["Pierre Lemaitre", "cynisme, mécanique implacable"],
    ["Dan Brown", "chapitres courts, énigmes, rythme haletant"],
    ["Patricia Highsmith", "tension psychologique, amoralité tranquille"],
    ["Franck Thilliez", "indices, obsessions, ambiance sombre"]
  ],
  "Horreur": [
    ["Stephen King", "quotidien qui bascule, personnages vrais"],
    ["H.P. Lovecraft", "peur de l'inconnu, descriptions oppressantes"],
    ["Edgar Allan Poe", "narrateur fiévreux, culpabilité"],
    ["Shirley Jackson", "malaise diffus, maison hantée par les gens"],
    ["Guy de Maupassant", "peur suggérée, folie qui s'installe"]
  ],
  "Romance": [
    ["Jane Austen", "esprit, ironie sociale, dialogues fins"],
    ["Marc Levy", "sentiments simples, coups du sort, ton accessible"],
    ["Guillaume Musso", "romance et mystère, secrets du passé"],
    ["Nicholas Sparks", "émotion directe, grands sentiments"],
    ["Colleen Hoover", "intensité, blessures intimes, rythme rapide, sans scène explicite"]
  ],
  "Aventure": [
    ["Alexandre Dumas", "panache, rebondissements, amitiés"],
    ["Jules Verne", "voyage, émerveillement, précision des lieux"],
    ["Robert Louis Stevenson", "trésors, mer, pièges moraux"],
    ["Jack London", "nature hostile, survie, endurance"],
    ["Michael Crichton", "aventure et science, rythme efficace"]
  ],
  "Policier": [
    ["Georges Simenon", "sobriété, atmosphère, psychologie"],
    ["Agatha Christie", "énigme, suspects en cercle fermé, indices honnêtes"],
    ["Raymond Chandler", "détective désabusé, images, cynisme"],
    ["Fred Vargas", "enquêteurs excentriques, poésie, intuition"],
    ["Arthur Conan Doyle", "déduction, détails qui trahissent"]
  ],
  "Mystère": [
    ["Maurice Leblanc", "gentleman, ruses, inversions"],
    ["Gaston Leroux", "énigme de la chambre close, romanesque"],
    ["Daphné du Maurier", "demeure, secret, suspense feutré"],
    ["Umberto Eco", "savoir, symboles, enquête érudite"],
    ["Carlos Ruiz Zafón", "ville nocturne, livres, mystère romantique"]
  ],
  "Conte pour enfant": [
    ["Charles Perrault", "forme de conte, morale, rythme simple"],
    ["Hans Christian Andersen", "tendresse, mélancolie, objets qui vivent"],
    ["Antoine de Saint-Exupéry", "simplicité, poésie, regard d'enfant"],
    ["Roald Dahl", "humour, méchants truculents, malice"],
    ["Michael Ende", "imaginaire doux, amitié, courage"]
  ],
  "Comédie": [
    ["Molière", "quiproquos, travers humains, rythme du dialogue"],
    ["René Goscinny", "jeux de mots, personnages caricaturaux, gags"],
    ["Jerome K. Jerome", "humour anglais, digressions"],
    ["Douglas Adams", "absurde, logique folle"],
    ["Alexandre Jardin", "fantaisie, romanesque, exagération assumée"]
  ]
};
// Pour les 3–5 ans, seuls les conteurs les plus simples sont retenus.
const YOUNG_CHILD_AUTHORS = ["Charles Perrault", "Hans Christian Andersen", "Antoine de Saint-Exupéry"];

function pickAuthors(input) {
  let list = AUTHORS[input.category] || [];
  if (input.category === "Conte pour enfant" && input.age === "3–5 ans") {
    list = list.filter(([name]) => YOUNG_CHILD_AUTHORS.includes(name));
  }
  if (!list.length) return [];
  const rand = seededRandom(`auteurs|${input.storyId || input.seed || "histoire"}|${input.category}`);
  const pool = [...list];
  const out = [];
  while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

function authorsInstruction(input) {
  const picked = pickAuthors(input);
  if (!picked.length) return "";
  return `INSPIRATION LITTÉRAIRE
Écris dans l'esprit de ces auteurs, tels qu'on les lit en traduction française : ${picked.map(([name, traits]) => `${name} (${traits})`).join(" ; ")}.
Inspire-toi de leur manière (rythme des phrases, ton, regard sur les personnages), jamais de leurs phrases, de leurs intrigues ni de leurs personnages. Ne cite aucun nom d'auteur dans le texte. Le style reste du français naturel et fluide.

`;
}

function recipeFor(input, plan) {
  return storyRecipes(input, plan.total, plan.child)[plan.pageNumber - 1];
}

function recipeInstruction(recipe, plan) {
  if (!recipe) return "";
  const lines = [];
  if (recipe.twist >= 0 && !plan.isEnd) lines.push(`INTENSITÉ DU REBONDISSEMENT : ${TWIST_LEVELS[recipe.twist]}`);
  if (!plan.isEnd) {
    lines.push(`SOURCE DU DILEMME SUGGÉRÉE (si elle sert la trame et le genre ; sinon garde le dilemme naturel de la trame) : ${DILEMMA_SOURCES[recipe.source]}.`);
    lines.push(`TYPE D'ACTION DU CHOIX 1 : ${ACTION_FAMILIES[recipe.families[0]]}.`);
    lines.push(`TYPE D'ACTION DU CHOIX 2 : ${ACTION_FAMILIES[recipe.families[1]]}.`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// PROMPT
// - Message système : les règles fixes de l'histoire (genre, voix, écriture, choix, format).
// - Message utilisateur : l'état du récit, le texte déjà lu, le choix et sa conséquence prévue,
//   puis, tout à la fin, les dernières lignes lues : c'est ce que le modèle voit en dernier
//   avant d'écrire, ce qui l'aide à enchaîner au lieu de recommencer un nouveau chapitre.
// ---------------------------------------------------------------------------
// Genres réalistes : aucun surnaturel ni gadget impossible.
const REALISTIC_GENRES = ["Thriller", "Policier", "Romance", "Comédie"];

// Formules usées que les modèles répètent : interdites.
const BANNED_PHRASES = [
  "le cœur battant comme un marteau / son cœur bat la chamade", "le sang se glace", "un silence lourd / pesant / de plomb",
  "chaque seconde compte", "le temps presse", "la tension est à son comble", "un frisson le parcourt",
  "un sourire énigmatique", "le souffle coupé", "comme un château de cartes", "sceller son destin",
  "plus lourd que jamais", "ses yeux s'écarquillent"
];

function buildSystemPrompt(input, plan, streaming = false) {
  const { child, isEnd, pageNumber, total } = plan;
  const g = GENRES[input.category];
  const age = child ? (AGES.includes(input.age) ? input.age : "6–8 ans") : null;
  const ageGuide = child ? CHILD_AGE_GUIDES[age] : null;
  const words = child ? ageGuide.words : "230 à 320";
  const needBible = !String(input.bible || "").trim();

  const publicLine = child
    ? `PUBLIC : enfants de ${age}. ${ageGuide.style} Aucune scène effrayante ni violence. Les surprises sont douces : une découverte, un personnage inattendu, un renversement amusant.`
    : `PUBLIC : adolescents et adultes. Style immersif, précis et sensoriel, dialogues naturels.`;
  const realism = REALISTIC_GENRES.includes(input.category)
    ? `RÉALISME : genre réaliste. Aucun surnaturel, aucun gadget impossible (pas d'hologramme, de rituel magique, de technologie de science-fiction). Tout doit pouvoir arriver dans le monde réel.\n`
    : "";

  const hero = cleanHero(input.hero);
  const heroLine = hero
    ? `HÉROS : le lecteur est le héros et il s'appelle ${hero}. Nomme-le dès la première phrase de la page 1 et garde ce prénom jusqu'au bout ; les autres personnages portent d'autres prénoms. ` +
      `Si le genre de « ${hero} » n'est pas évident, évite les accords et pronoms genrés.\n`
    : "";

  const bibleRules = `BIBLE DE L'HISTOIRE (champ "bible")
${needBible ? `Tu dois l'écrire MAINTENANT, avant d'écrire la page. C'est le plan secret du roman entier ; elle ne sera plus jamais modifiée.` : `Elle t'est fournie : elle est fixée. Ne la réécris pas, laisse le champ "bible" vide, et suis-la.`}
Format (1400 caractères maximum, lignes courtes) :
PRÉMISSE : l'histoire en une phrase
HÉROS : nom ; ce qu'il veut ; sa blessure intime (un manque, une faute, un deuil, une peur) ; ce qu'il devra comprendre ou accepter à la fin
PERSONNAGES : 2 ou 3, une ligne chacun : « Nom — rôle unique dans l'histoire — trait / contradiction / veut / cache / façon de parler / passé en une phrase »
ANTAGONISTE : qui, et son mobile compréhensible (il croit avoir raison)
SECRET : ${g.secret}
TRAME : exactement ${total} lignes numérotées « 1. », « 2. »… : pour chaque page, le lieu et l'étape (événement ou révélation). Au moins ${child ? 3 : 5} lieux différents, avec des ellipses de temps ; la blessure du héros est touchée au moins à 3 reprises ; la page ${total} est le dénouement.
FIN PRÉVUE : comment l'intrigue se résout et ce que le héros a changé en lui
Les choix du lecteur changent le chemin, les rencontres et le prix payé, pas la direction générale : adapte chaque étape aux choix déjà faits.
Un nom = un personnage = un rôle, du début à la fin : ne fusionne jamais deux personnages, ne change jamais le rôle de quelqu'un sans que la trame l'ait prévu (trahison préparée).`;

  const choiceRules = isEnd
    ? `Cette page est la dernière : "choix" est une liste vide et "fin" vaut true.`
    : `Exactement deux choix. Chacun contient :
- "texte" : ce que le lecteur voit. Une action concrète en une phrase courte (14 mots maximum) qui commence par un verbe à l'infinitif et vise une cible précise. Ne révèle pas l'issue.
- "suite" : invisible pour le lecteur. En une ou deux phrases, ce que ce choix déclenchera au début de la page suivante, cohérent avec la trame.
Règles :
- Faisable à l'instant exact où la page s'arrête, avec uniquement les personnages, objets, lieux et informations déjà présents dans le texte. Les noms sont ceux du texte.
- Les deux choix s'excluent vraiment, sont deux gestes de nature différente (voir TYPES D'ACTION de la page) et ont chacun un avantage et un prix. Jamais deux variantes d'un même geste (deux portes, deux couloirs, deux objets).
- Interdit : attendre, réfléchir, observer encore, se cacher, faire demi-tour, se reposer, ou revenir à une situation déjà vécue.
- Ne formule JAMAIS les options dans le texte de la page (« X doit choisir », « soit… soit… », « ou bien… », « deux options ») : la page s'arrête sur la situation, les boutons portent les choix.
- Choix typiques du genre, à adapter : ${g.choix}.`;

  return `Tu es un romancier français de grand talent qui écrit, page après page, UN SEUL roman interactif de ${total} pages. ` +
`Le lecteur vit l'histoire de l'intérieur : ses choix comptent et l'histoire avance à chaque page.

GENRE : ${input.category}
TON ET STYLE : ${g.ton}
NARRATION IMPOSÉE : ${g.narration}. Ne change jamais de personne ni de temps.
${publicLine}
${realism}${heroLine}
${bibleRules}

CONTINUITÉ ET PROGRESSION
- Page 2 et suivantes : la première phrase reprend là où la dernière ligne lue s'arrête et réalise le choix du lecteur EXACTEMENT comme il est écrit (même geste, même cible ; « fuir » veut dire quitter les lieux). Pas de titre, pas de résumé, pas de formule d'ouverture.
- Après avoir montré l'effet du choix, fais avancer l'histoire vers l'étape prévue par la TRAME pour cette page. Une ellipse (« Une heure plus tard… », « Le soir même… ») ou un changement de lieu est alors permis et souvent souhaitable : jamais plus de deux pages de suite dans le même lieu.
- Continuité physique : un objet laissé quelque part y reste ; un personnage qui n'est pas dans la scène n'y apparaît pas sans arrivée racontée ; un personnage absent depuis longtemps revient ou son absence est expliquée. Le héros ne sait que ce qu'il a vu ou appris.
- Les révélations viennent de la TRAME et des détails semés plus tôt, jamais d'une invention de dernière minute.

ÉMOTION
- Chaque page contient au moins un moment intérieur ou relationnel : un regard, un échange vrai avec un autre personnage, un doute, un geste qui trahit quelque chose.
- La blessure du héros n'est JAMAIS nommée ni expliquée avant la page du tournant (pas de « souvenir de l'accident qui a emporté sa sœur ») : on la devine par des gestes, des silences, un objet, une phrase qui reste en travers. Le lecteur la comprend peu à peu.
- Relis chaque phrase : un objet, un personnage ou un détail ne peut pas être à deux endroits à la fois. Montre-le par des gestes et des paroles, pas par des étiquettes (« il était triste »).
- Les autres personnages ont leurs propres désirs : ils agissent, aident, mentent ou souffrent pour leurs raisons, pas seulement pour servir l'intrigue.

ÉCRITURE
- ${words} mots, en paragraphes courts.
- Détails concrets et inattendus plutôt qu'adjectifs : un objet, un geste, une odeur, une phrase de dialogue qui révèle un personnage.
- Interdit : ces formules usées (et leurs variantes) : ${BANNED_PHRASES.join(" ; ")}.
- Un motif (compte à rebours, néon, bruit, couleur…) ne revient pas plus d'une page sur trois. Ne répète jamais une phrase ou une description déjà écrite.
- Évite les prénoms trop fréquents dans les histoires générées (Elara, Lysandre, Kael, Mara, Elias, Aria, Luna, Léo, Aurelia, Eldoria, Thorn, Zephyr, Willow).

${authorsInstruction(input)}RYTHME
Chaque page reçoit une INTENSITÉ DU REBONDISSEMENT : respecte-la. Une page calme n'a aucun twist ; un petit imprévu reste discret. Le suspense vient aussi du non-dit et d'une menace sourde.

CHOIX
${choiceRules}

MÉMOIRE (champ "memoire", 800 caractères maximum, style télégraphique, réécrite à chaque page)
DÉJÀ VÉCU : 3 à 6 mots par page (lieu + fait)
OBJETS : qui possède quoi, où sont les objets importants
RELATIONS : comment chaque personnage principal voit le héros maintenant
FILS OUVERTS : quelques mots
ÉCARTÉ : choix non pris dont l'effet pèse encore (rien s'il n'en reste aucun)
(ne recopie ni la bible ni la ligne ÉTAT)

TITRE
Champ "titre" : 2 à 6 mots, évocateur, sans guillemets.

${streaming ? streamFormat(isEnd) : `FORMAT DE RÉPONSE
Réponds uniquement avec un objet JSON valide, sans texte autour. Le texte de la page est une liste de paragraphes : n'écris jamais « \\n » ni « /n » dans les textes.
"plan" : 15 mots maximum, invisible : comment cette page réalise son étape de la trame.
"etat" (après "paragraphes", avant "choix") : 35 mots maximum : où est le héros, qui est présent, où sont les autres personnages principaux, ce que le héros porte et ce qu'il sait à la fin de la page. Les choix découlent de cet état.
{${needBible ? `"bible":"…",` : `"bible":"",`}"plan":"…","paragraphes":["…","…"],"etat":"…","choix":[{"texte":"…","suite":"…"},{"texte":"…","suite":"…"}],"memoire":"…","titre":"…","fin":${isEnd}}`}`;
}

// Format pour l'écriture en direct : le texte de la page d'abord (il s'affiche pendant qu'il s'écrit),
// puis une ligne repère, puis le reste en JSON.
const STREAM_MARK = "===SUITE===";
function streamFormat(isEnd) {
  return `FORMAT DE RÉPONSE (impératif)
1. Écris d'abord directement le texte de la page : paragraphes séparés par une ligne vide, sans titre, sans guillemets autour, sans aucune balise ni commentaire avant.
2. Puis une ligne contenant uniquement : ${STREAM_MARK}
3. Puis un objet JSON valide, sans texte autour :
{"choix":[{"texte":"…","suite":"…"},{"texte":"…","suite":"…"}],"memoire":"…","titre":"…","fin":${isEnd}}`;
}

function buildUserPrompt(input, plan, maxPages = 2) {
  const { total, pageNumber, isEnd } = plan;
  const g = GENRES[input.category];
  const memo = String(input.memo || "").slice(0, 1200);
  const bible = String(input.bible || "").slice(0, 1600);
  const stepLine = (bible.match(new RegExp(`^\\s*${pageNumber}\\s*[.)\\-:]\\s*(.+)$`, "m")) || [])[1] || "";
  const bibleBlock = bible
    ? `BIBLE DE L'HISTOIRE (fixée, à suivre, ne pas réécrire) :\n${bible}\n\nÉTAPE PRÉVUE PAR LA TRAME POUR CETTE PAGE : ${stepLine || "voir la trame"}${pageNumber > 1 ? " (adapte-la à ce que le lecteur a choisi)" : ""}\n\n`
    : "";
  const seed = String(input.seed || "").slice(0, 500);
  const selectedChoice = input.selectedChoice ? String(input.selectedChoice).slice(0, 300) : "";
  const selectedDirection = input.selectedDirection ? String(input.selectedDirection).slice(0, 500) : "";
  const otherChoice = input.otherChoice ? String(input.otherChoice).slice(0, 300) : "";
  const otherDirection = input.otherDirection ? String(input.otherDirection).slice(0, 400) : "";

  const history = Array.isArray(input.history) ? input.history.slice(-maxPages) : [];
  const pages = history.map(p => cleanStoryText(String(p.page || "")).slice(0, 3500));

  const hero = cleanHero(input.hero);
  const recipe = recipeInstruction(recipeFor(input, plan), plan);
  const state = `PAGE À ÉCRIRE : ${pageNumber} sur ${total}${isEnd ? " (dernière page)" : ""}.\nRÔLE DE CETTE PAGE : ${phaseInstruction(pageNumber, total, g)}` +
    (recipe ? `\nRECETTE DE CETTE PAGE (imposée, ne la mentionne jamais dans le texte) :\n${recipe}` : "") +
    (hero ? `\nPRÉNOM DU HÉROS (le lecteur) : ${hero}` : "");

  if (!pages.length) {
    return `${state}

${bibleBlock}IDÉE DE DÉPART DU LECTEUR : ${seed || "libre : invente un point de départ original et précis, propre au genre."}

Écris maintenant la page 1.`;
  }

  // Le texte déjà écrit est présenté comme UN SEUL récit continu, chaque choix
  // étant inscrit juste après le passage qu'il suit.
  const storySoFar = pages.map((page, i) => {
    const chosen = i + 1 < history.length ? history[i + 1].choice : "";
    const decision = chosen && chosen !== "Début" ? `\n[Le lecteur a choisi : ${String(chosen).slice(0, 300)}]` : "";
    return page + decision;
  }).join("\n\n");

  const stateLine = (memo.match(/^ÉTAT\s*:\s*(.+)$/m) || [])[1] || "";
  const lastPage = pages[pages.length - 1];
  const lastLines = lastPage.split(/\n+/).filter(Boolean).slice(-2).join("\n").slice(-600);
  const skipped = pageNumber - 1 - pages.length;

  return `${state}

${bibleBlock}${bible ? "" : "ATTENTION : cette histoire n'a pas encore de bible. Écris-la dans le champ \"bible\" en partant de ce qui a déjà été lu, avec une trame pour toutes les pages, puis écris la page.\n\n"}MÉMOIRE DU RÉCIT :
${memo || "(vide)"}

TEXTE DÉJÀ LU PAR LE LECTEUR${skipped > 0 ? ` (les ${skipped} premières pages sont résumées dans la mémoire)` : ""} :
${storySoFar}

CHOIX DU LECTEUR À LA FIN DE CETTE PAGE : « ${selectedChoice || "continuer"} »
${selectedDirection ? `CE QUE CE CHOIX DÉCLENCHE (prévu à la page précédente) : ${selectedDirection}\nRéalise-le dès le premier paragraphe, puis va plus loin.\n` : ""}
${stateLine ? `ÉTAT EXACT À LA FIN DE LA PAGE PRÉCÉDENTE : ${stateLine}\nTa page commence dans cet état : même lieu, mêmes personnes présentes, mêmes objets, mêmes connaissances, sauf ce que le choix pris change.\n` : ""}${otherChoice && selectedChoice ? `CHOIX ÉCARTÉ (proposé en même temps, que le lecteur n'a PAS pris) : « ${otherChoice} »${otherDirection ? `\nCe qu'il aurait déclenché : ${otherDirection}` : ""}
Prends-le en compte SEULEMENT si ne pas l'avoir fait a une vraie incidence sur la situation créée par le choix pris (une occasion perdue, un danger qui grandit faute d'avoir agi, quelqu'un d'autre qui agit à la place du héros, un personnage déçu ou soulagé). Dans ce cas, une seule conséquence discrète, intégrée au récit, sans jamais parler de « choix » ni d'« option », et sans jouer la suite du choix écarté. Si cela n'a aucune incidence logique, ignore-le complètement.
` : ""}
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

// Contrôle de cohérence côté serveur : un choix ne doit citer aucun nom propre absent du récit.
function stripAccents(text) { return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function coherenceIssue(result, input) {
  if (!result.choices || result.choices.length !== 2) return "";
  const known = stripAccents([
    result.page, result.memoire, input.memo,
    ...(Array.isArray(input.history) ? input.history.map(h => h.page) : []),
    input.seed, input.hero
  ].join(" "));
  const missing = [];
  for (const choice of result.choices) {
    const words = String(choice).split(/\s+/).slice(1);
    for (const w of words) {
      const clean = w.replace(/^[«"'(]+|[»"')?!.,;:…]+$/g, "");
      if (clean.length >= 3 && /^\p{Lu}/u.test(clean) && !known.includes(stripAccents(clean))) missing.push(clean);
    }
  }
  if (missing.length) return `les choix citent « ${[...new Set(missing)].join(", ")} », absent du récit. Réécris les deux choix en n'utilisant que des personnages, objets et lieux présents dans ta page.`;
  if (stripAccents(result.choices[0]) === stripAccents(result.choices[1])) return "les deux choix sont identiques. Écris deux choix différents.";
  const tail = stripAccents(String(result.page).slice(-500));
  if (/doit (maintenant )?choisir|deux options|deux possibilites|soit .{3,80}, soit /.test(tail)) return "le texte de la page énonce les options (« doit choisir », « soit… soit… »). Réécris la fin de la page pour qu'elle s'arrête sur la situation, sans lister les options.";
  if (!String(input.bible || "").trim() && !result.bible) return "le champ \"bible\" est vide. Écris la bible complète (prémisse, héros, personnages, antagoniste, secret, trame numérotée, fin prévue).";
  return "";
}

// La bible peut arriver en texte ou en objet JSON : on la ramène à un texte en lignes.
function bibleText(value) {
  if (!value) return "";
  if (typeof value === "string") return cleanStoryText(value).trim().slice(0, 1600);
  if (typeof value !== "object") return "";
  const lines = [];
  for (const [key, val] of Object.entries(value)) {
    if (Array.isArray(val)) {
      lines.push(`${key.toUpperCase()} :`);
      val.forEach((item, i) => lines.push(typeof item === "object" ? `${i + 1}. ${Object.values(item).join(" — ")}` : (/^\s*\d+[.)]/.test(String(item)) ? String(item) : `${i + 1}. ${item}`)));
    } else if (val && typeof val === "object") {
      lines.push(`${key.toUpperCase()} : ${Object.entries(val).map(([k, v]) => `${k} : ${v}`).join(" ; ")}`);
    } else lines.push(`${key.toUpperCase()} : ${val}`);
  }
  return cleanStoryText(lines.join("\n")).slice(0, 1600);
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
  const etat = typeof value.etat === "string" ? cleanStoryText(value.etat).replace(/\s+/g, " ").trim().slice(0, 300) : "";
  // La ligne ÉTAT (où est le héros, qui est là, ce qu'il tient) est placée en tête de la mémoire, remplaçant la précédente.
  const body = (typeof value.memoire === "string" ? cleanStoryText(value.memoire) : "")
    .split("\n").filter(l => !/^\s*ÉTAT\s*:/i.test(l)).join("\n").slice(0, 900);
  const memoire = etat ? `ÉTAT : ${etat}\n${body}` : body;
  if (!page) throw new Error("La page générée est vide.");
  if (!isEnd && choices.length !== 2) throw new Error("La réponse ne contient pas exactement deux choix.");
  return {
    page,
    choices: isEnd ? [] : choices.map(c => c.texte),
    directions: isEnd ? [] : choices.map(c => c.suite),
    memoire,
    titre,
    bible: bibleText(value.bible),
    plan: typeof value.plan === "string" ? cleanStoryText(value.plan).replace(/\s+/g, " ").slice(0, 400) : ""
  };
}

// ---------------------------------------------------------------------------
// FOURNISSEURS ET MODÈLES GRATUITS
// Ordre : modèles Groq (plan Free), puis modèles Gemini du niveau gratuit.
// Chaque modèle a son propre quota : quand l'un est épuisé, on passe au suivant.
// Les listes sont mises à jour automatiquement à partir des modèles réellement
// disponibles sur chaque compte (un modèle retiré est ignoré, un nouveau modèle
// d'une famille gratuite est pris en compte).
// ---------------------------------------------------------------------------

// Groq : par ordre de préférence. Sur le plan Free, tous les modèles sont gratuits.
const GROQ_PREFERENCES = [
  /^openai\/gpt-oss-120b$/,
  /^openai\/gpt-oss-20b$/,
  /^qwen\/qwen3[\w.-]*$/,
  /^llama-3\.3-70b-versatile$/,
  /^meta-llama\/llama-4-(maverick|scout)[\w.-]*$/
];
const GROQ_DEFAULTS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

// Gemini : uniquement les familles Flash et Flash-Lite, qui ont un niveau gratuit.
// Exclus : Pro, modèles d'image, de son, de vidéo, « Omni » et expérimentaux (payants ou très limités).
const GEMINI_EXCLUDE = /(pro|image|tts|audio|live|embedding|omni|computer|veo|imagen|lyria|exp|thinking)/i;
const GEMINI_DEFAULTS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const MODEL_LIST_TTL_MS = 6 * 3600 * 1000;
const modelCache = { groq: null, gemini: null };   // { at, list }
const exhausted = new Map();                       // "fournisseur:modèle" -> fin du blocage (ms)

function isExhausted(key) {
  const until = exhausted.get(key);
  if (!until) return false;
  if (Date.now() >= until) { exhausted.delete(key); return false; }
  return true;
}

async function groqModels(env) {
  if (modelCache.groq && Date.now() - modelCache.groq.at < MODEL_LIST_TTL_MS) return modelCache.groq.list;
  let list = GROQ_DEFAULTS;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}` } });
    if (r.ok) {
      const ids = ((await r.json()).data || []).filter(m => m.active !== false).map(m => m.id);
      const ordered = [];
      for (const pattern of GROQ_PREFERENCES) {
        ids.filter(id => pattern.test(id)).sort().reverse().forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
      }
      if (ordered.length) list = ordered;
    }
  } catch { /* liste par défaut */ }
  modelCache.groq = { at: Date.now(), list };
  return list;
}

// Trie les modèles Gemini : version la plus récente d'abord, Flash avant Flash-Lite, stable avant preview.
function geminiRank(name) {
  const version = Number.parseFloat((name.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const lite = /lite/.test(name) ? 1 : 0;
  const preview = /preview|latest/.test(name) ? 1 : 0;
  // Qualité d'abord : Flash complet (la version la plus récente en tête), puis les Flash-Lite en secours.
  const fast = lite ? 1 : 0;
  return [fast, -version, lite, preview, name.length];
}

async function geminiModels(env) {
  if (modelCache.gemini && Date.now() - modelCache.gemini.at < MODEL_LIST_TTL_MS) return modelCache.gemini.list;
  let list = GEMINI_DEFAULTS;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${env.GEMINI_API_KEY}`);
    if (r.ok) {
      const names = ((await r.json()).models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => String(m.name).replace(/^models\//, ""))
        .filter(n => /^gemini-[\d.]+-flash/.test(n) && !GEMINI_EXCLUDE.test(n))
        // Une seule version datée par famille : on préfère le nom court (alias stable).
        .filter(n => !/-\d{3}$|-\d{2}-\d{4}$/.test(n));
      names.sort((a, b) => {
        const ra = geminiRank(a), rb = geminiRank(b);
        for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1;
        return 0;
      });
      if (names.length) list = names.slice(0, 4);
    }
  } catch { /* liste par défaut */ }
  modelCache.gemini = { at: Date.now(), list };
  return list;
}

async function httpError(provider, response) {
  const error = new Error(`${provider} HTTP ${response.status}`);
  error.status = response.status;
  error.retryAfter = retryAfterSeconds(response.headers);
  const body = await response.text().catch(() => "");
  let message = "";
  try { message = JSON.parse(body)?.error?.message || ""; } catch { message = body; }
  error.apiMessage = String(message).slice(0, 300);
  if (error.retryAfter === null) {
    // Gemini indique le délai dans le message (« Please retry in 37.5s »).
    const m = error.apiMessage.match(/retry in ([\d.]+)\s*s/i);
    if (m) error.retryAfter = Number(m[1]);
  }
  if (/per day|\(TPD\)|\(RPD\)|PerDay/i.test(error.apiMessage)) error.limit = "jour";
  else if (/per minute|\(TPM\)|\(RPM\)|PerMinute/i.test(error.apiMessage)) error.limit = "minute";
  return error;
}

function groqParams(model) {
  if (/gpt-oss/.test(model)) return { reasoning_effort: "low" };
  if (/qwen3/.test(model)) return { reasoning_effort: "none" };
  return {};
}

async function callGroq(env, model, prompts, isEnd) {
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
      ...groqParams(model),
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw await httpError("Groq", response);
  const data = await response.json();
  return { ...parseOutput(data.choices?.[0]?.message?.content || "", isEnd), usage: data.usage || null };
}

async function callGemini(env, model, prompts, isEnd, withThinkingConfig = true, signal) {
  const generationConfig = { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 3500 };
  // Réflexion préalable réduite au minimum : réponse beaucoup plus rapide et moins de quota consommé.
  if (withThinkingConfig) {
    generationConfig.thinkingConfig = /^gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "minimal" };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: prompts.system }] },
      contents: [{ role: "user", parts: [{ text: prompts.user }] }],
      generationConfig
    })
  });
  if (!response.ok) {
    // Si ce modèle refuse le réglage de réflexion, on réessaie une fois sans.
    if (response.status === 400 && withThinkingConfig) return callGemini(env, model, prompts, isEnd, false, signal);
    throw await httpError("Gemini", response);
  }
  const data = await response.json();
  return { ...parseOutput(data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || "").join("") || "", isEnd), usage: data.usageMetadata || null };
}

// Lit le délai d'attente renvoyé par Groq : « retry-after » (secondes) ou
// « x-ratelimit-reset-tokens » / « x-ratelimit-reset-requests » (ex. « 7.66s », « 1m2s », « 450ms »).
function retryAfterSeconds(headers) {
  const direct = Number.parseFloat(headers.get("retry-after"));
  if (Number.isFinite(direct)) return Math.max(direct, 0.5);
  const values = ["x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"]
    .map(name => parseDuration(headers.get(name)))
    .filter(v => v !== null);
  return values.length ? Math.max(...values, 0.5) : null;
}

function parseDuration(text) {
  if (!text) return null;
  let total = 0, found = false;
  for (const [, num, unit] of String(text).matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    found = true;
    total += Number(num) * ({ ms: 0.001, s: 1, m: 60, h: 3600 })[unit];
  }
  return found ? total : null;
}

const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

// Gemini a ce délai pour commencer à répondre. Au-delà, on passe à Qwen, puis à Groq (dernier recours).
const GEMINI_WAIT_MS = 8000;

// Liste ordonnée des moteurs à essayer pour cette requête.
async function engineChain(env) {
  const chain = [];
  // Gemini en premier (le modèle le plus rapide), puis Qwen (Groq), puis le reste de Groq en secours.
  if (env.GEMINI_API_KEY) (await geminiModels(env)).forEach(model => chain.push({ provider: "Gemini", model }));
  if (env.GROQ_API_KEY) {
    const groq = await groqModels(env);
    const qwen = groq.filter(model => /^qwen\//.test(model));
    const rest = groq.filter(model => !qwen.includes(model));
    [...qwen, ...rest].forEach(model => chain.push({ provider: "Groq", model }));
  }
  return chain;
}

function callEngine(env, engine, prompts, isEnd, signal) {
  return engine.provider === "Groq"
    ? callGroq(env, engine.model, prompts, isEnd)
    : callGemini(env, engine.model, prompts, isEnd, true, signal);
}

function shortModel(model) {
  return model.replace(/^(openai|meta-llama|qwen)\//, "");
}

// Génère la page avec le premier moteur disponible, en basculant sur le suivant
// dès qu'un quota est atteint ou qu'un modèle ne répond pas correctement.
async function generateWithFallback(env, input, plan) {
  const system = buildSystemPrompt(input, plan);
  let chain = await engineChain(env);
  // TEMPORAIRE (comparaison de modèles) : un seul moteur demandé, sans secours.
  if (input.engine) chain = chain.filter(e => `${e.provider}:${e.model}` === input.engine);
  const errors = [];
  const quotaWaits = [];
  let lastLimit = null;
  let geminiSlow = false;   // Gemini n'a pas répondu dans le délai : on passe directement à Groq

  const tryEngine = async engine => {
    const key = `${engine.provider}:${engine.model}`;
    let maxPages = 2, correction = "", kept = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ac = new AbortController();
        const timer = engine.provider === "Gemini" ? setTimeout(() => ac.abort(), GEMINI_WAIT_MS) : null;
        let result;
        try {
          result = await callEngine(env, engine, { system, user: buildUserPrompt(input, plan, maxPages) + correction }, plan.isEnd, ac.signal);
        } finally {
          if (timer) clearTimeout(timer);
        }
        // Incohérence détectée : une seule nouvelle écriture, avec la correction demandée ; sinon on garde la page telle quelle.
        const issue = plan.isEnd || attempt > 1 || correction ? "" : coherenceIssue(result, input);
        if (issue) { correction = `\n\nCORRECTION OBLIGATOIRE : ta version précédente avait un défaut de cohérence : ${issue}`; attempt--; kept = result; errors.push(`${engine.provider} ${engine.model}: ${issue}`); continue; }
        return { ...result, provider: `${engine.provider} · ${shortModel(engine.model)}` };
      } catch (e) {
        if (e.name === "AbortError") {
          // Délai dépassé : Gemini est trop lent, on ne retente pas.
          geminiSlow = true;
          errors.push(`${engine.provider} ${engine.model}: pas de réponse dans le délai`);
          return kept ? { ...kept, provider: `${engine.provider} · ${shortModel(engine.model)}` } : null;
        }
        errors.push(`${engine.provider} ${engine.model}: ${e.message}${e.apiMessage ? ` (${e.apiMessage})` : ""}`);
        // Visible dans Workers Logs : pourquoi un modèle a été écarté.
        console.log(`[engine] ${key} · ${e.status ?? "sans statut"} · ${e.apiMessage || e.message}`);
        // Modèle retiré (404) : on le met de côté pour plusieurs heures au lieu de le retenter à chaque génération.
        if (e.status === 404) {
          exhausted.set(key, Date.now() + 6 * 3600 * 1000);
          return kept ? { ...kept, provider: `${engine.provider} · ${shortModel(engine.model)}` } : null;
        }
        // Requête trop grosse pour ce modèle : une page d'historique en moins.
        if (e.status === 413 && maxPages > 1) { maxPages--; continue; }
        // Quota atteint : ce modèle est mis de côté jusqu'à la fin du délai, on passe au suivant.
        if (e.status === 429 || e.status === 413) {
          const wait = e.retryAfter ?? 60;
          exhausted.set(key, Date.now() + wait * 1000);
          quotaWaits.push({ engine, wait });
          if (e.limit) lastLimit = e.limit;
          return kept ? { ...kept, provider: `${engine.provider} · ${shortModel(engine.model)}` } : null;
        }
        // Réponse mal formée : on réessaie une fois le même modèle (si une page correcte existe déjà, on la garde).
        if (e.status === undefined && attempt < 2) continue;
        return kept ? { ...kept, provider: `${engine.provider} · ${shortModel(engine.model)}` } : null;
      }
    }
    return null;
  };

  for (const engine of chain) {
    if (engine.provider === "Gemini" && geminiSlow) continue;
    if (isExhausted(`${engine.provider}:${engine.model}`)) {
      errors.push(`${engine.provider} ${engine.model}: quota en pause`);
      continue;
    }
    const result = await tryEngine(engine);
    if (result) return { result };
  }

  // Tous les modèles sont épuisés : si l'un se libère très vite, on l'attend une fois.
  const soonest = quotaWaits.sort((a, b) => a.wait - b.wait)[0];
  if (soonest && soonest.wait <= 12) {
    await sleep(soonest.wait + 0.3);
    exhausted.delete(`${soonest.engine.provider}:${soonest.engine.model}`);
    const result = await tryEngine(soonest.engine);
    if (result) return { result };
  }

  const pausedUntil = [...exhausted.values()].filter(t => t > Date.now());
  const retryAfter = soonest
    ? Math.ceil(Math.min(soonest.wait, ...pausedUntil.map(t => (t - Date.now()) / 1000)))
    : pausedUntil.length ? Math.ceil(Math.min(...pausedUntil.map(t => (t - Date.now()) / 1000))) : null;
  return { errors, retryAfter, limit: lastLimit, quota: retryAfter !== null };
}

// Secours : si le modèle n'a pas fourni de titre, on en demande un à part, à partir du passage.
async function requestTitle(env, category, page, memo) {
  const model = (await groqModels(env))[0];
  if (!env.GROQ_API_KEY || !model || isExhausted(`Groq:${model}`)) return "";
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
      ...groqParams(model)
    })
  });
  if (!response.ok) return "";
  const data = await response.json();
  const raw = String(data.choices?.[0]?.message?.content || "").trim().split("\n")[0];
  return raw.replace(/["«»*#]/g, "").replace(/[.!?:]+$/, "").trim().slice(0, 80);
}

// ---------------------------------------------------------------------------
// ÉCRITURE EN DIRECT (flux)
// Le texte de la page est envoyé au site au fur et à mesure qu'il s'écrit.
// Le modèle répond en JSON : on extrait la liste "paragraphes" pendant qu'elle arrive.
// En cas d'échec, le site repasse par la génération classique (avec ses attentes de quota).
// ---------------------------------------------------------------------------
// Texte de la page déjà écrit (format direct : tout ce qui précède la ligne repère).
function streamedText(raw) {
  const head = raw.trimStart();
  if (head.startsWith("{") || head.startsWith("```")) return extractParagraphs(raw);
  const mark = raw.indexOf("===");
  // On retient les derniers caractères tant qu'ils pourraient être le début du repère.
  const text = mark >= 0 ? raw.slice(0, mark) : raw.replace(/=+$/, "");
  return text.replace(/^\s+/, "");
}

function parseStreamOutput(raw, isEnd) {
  const mark = raw.indexOf("===");
  if (mark < 0) return parseOutput(raw, isEnd);
  const text = raw.slice(0, mark);
  const rest = raw.slice(mark).replace(/^=+[A-ZÉ]*=*/, "");
  const match = rest.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Partie JSON absente.");
  const value = JSON.parse(match[0]);
  value.paragraphes = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return parseOutput(JSON.stringify(value), isEnd);
}

function extractParagraphs(raw) {
  const key = raw.indexOf('"paragraphes"');
  if (key < 0) return "";
  let i = raw.indexOf("[", key);
  if (i < 0) return "";
  i++;
  const parts = [];
  let current = null;
  while (i < raw.length) {
    const c = raw[i];
    if (current === null) {
      if (c === '"') current = "";
      else if (c === "]") break;
      i++;
      continue;
    }
    if (c === "\\") {
      const n = raw[i + 1];
      if (n === undefined) break;
      if (n === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (hex.length < 4) break;
        current += String.fromCharCode(parseInt(hex, 16) || 32);
        i += 6;
        continue;
      }
      current += ({ n: "\n", t: " ", r: "", b: "", f: "" })[n] ?? n;
      i += 2;
      continue;
    }
    if (c === '"') { parts.push(current); current = null; i++; continue; }
    current += c;
    i++;
  }
  if (current !== null) parts.push(current);
  return parts.join("\n\n");
}

async function* sseData(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { yield JSON.parse(payload); } catch {}
    }
  }
}

// Ouvre le flux d'un moteur. Les erreurs HTTP (quota, etc.) sont levées avant tout texte.
async function openStream(env, engine, prompts, withThinkingConfig = true, signal) {
  if (engine.provider === "Groq") {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: engine.model,
        messages: [{ role: "system", content: prompts.system }, { role: "user", content: prompts.user }],
        temperature: 0.8, max_tokens: 3000, ...groqParams(engine.model), stream: true,
        // Qwen ne suit le format du flux qu'en mode JSON strict (comme en génération classique).
        ...(/^qwen\//.test(engine.model) ? { response_format: { type: "json_object" } } : {})
      })
    });
    if (!response.ok) throw await httpError("Groq", response);
    return (async function* () {
      for await (const d of sseData(response)) yield d.choices?.[0]?.delta?.content || "";
    })();
  }
  const generationConfig = { temperature: 0.8, maxOutputTokens: 2200 };
  if (withThinkingConfig) {
    generationConfig.thinkingConfig = /^gemini-2\./.test(engine.model) ? { thinkingBudget: 0 } : { thinkingLevel: "minimal" };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${engine.model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: prompts.system }] },
      contents: [{ role: "user", parts: [{ text: prompts.user }] }],
      generationConfig
    })
  });
  if (!response.ok) {
    if (response.status === 400 && withThinkingConfig) return openStream(env, engine, prompts, false, signal);
    throw await httpError("Gemini", response);
  }
  return (async function* () {
    for await (const d of sseData(response)) {
      yield (d.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
    }
  })();
}

function streamStory(env, input, plan, meta) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = obj => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  const run = async () => {
    const system = buildSystemPrompt(input, plan, true);
    const user = buildUserPrompt(input, plan);
    const t0 = Date.now();
    const chain = await engineChain(env);
    const errors = [];
    let geminiSlow = false;   // Gemini n'a pas commencé dans le délai : on passe à Qwen, puis Groq
    for (const engine of chain) {
      const key = `${engine.provider}:${engine.model}`;
      if (isExhausted(key)) continue;
      if (engine.provider === "Gemini" && geminiSlow) continue;
      // Gemini n'a que GEMINI_WAIT_MS pour envoyer son premier texte ; sinon on l'abandonne.
      const ac = new AbortController();
      let timer = engine.provider === "Gemini" ? setTimeout(() => ac.abort(), GEMINI_WAIT_MS) : null;
      const stopTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
      let deltas;
      try {
        deltas = await openStream(env, engine, { system, user }, true, ac.signal);
      } catch (e) {
        stopTimer();
        if (e.name === "AbortError") geminiSlow = true;
        errors.push(`${key}: ${e.name === "AbortError" ? "pas de réponse dans le délai" : e.message}`);
        if (e.status === 429 || e.status === 413) exhausted.set(key, Date.now() + (e.retryAfter ?? 60) * 1000);
        continue;
      }
      let raw = "", sent = 0, first = 0;
      try {
        for await (const delta of deltas) {
          if (!delta) continue;
          stopTimer();
          raw += delta;
          const text = streamedText(raw);
          if (text.length > sent) { if (!sent) first = Date.now() - t0; await send({ t: text.slice(sent) }); sent = text.length; }
        }
        const result = parseStreamOutput(raw, plan.isEnd);
        const { plan: hiddenPlan, ...visible } = result;
        let titre = visible.titre;
        if (!titre) titre = await requestTitle(env, input.category, visible.page, visible.memoire).catch(() => "");
        await send({ done: true, ...visible, titre, ...meta, provider: `${engine.provider} · ${shortModel(engine.model)}`, timing: { firstText: first, total: Date.now() - t0 } });
        return;
      } catch (e) {
        stopTimer();
        if (e.name === "AbortError") geminiSlow = true;
        errors.push(`${key}: ${e.message}`);
        if (sent) await send({ reset: true });
      }
    }
    await send({ error: "Génération en direct impossible.", details: errors });
  };

  run().catch(e => send({ error: String(e.message || e) }).catch(() => {})).finally(() => writer.close().catch(() => {}));
  return new Response(readable, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      // Diagnostic : /health?check=gemini fait un appel minuscule à Gemini et renvoie le statut exact (sans jamais afficher la clé).
      if (url.searchParams.get("check") === "gemini" && env.GEMINI_API_KEY) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${(await geminiModels(env))[0]}:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Réponds OK." }] }], generationConfig: { maxOutputTokens: 5 } })
          });
          const body = await r.text();
          let message = body;
          try { message = JSON.parse(body)?.error?.message || body; } catch { /* texte brut */ }
          return json({ gemini: { status: r.status, ok: r.ok, message: String(message).slice(0, 300) } });
        } catch (e) {
          return json({ gemini: { status: "réseau", message: String(e.message || e).slice(0, 300) } });
        }
      }
      return json({ ok: true, freeOnly: env.FREE_ONLY === "true", groq: !!env.GROQ_API_KEY, gemini: !!env.GEMINI_API_KEY });
    }
    if (url.pathname !== "/api/story" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (env.FREE_ONLY !== "true") return json({ error: "Génération bloquée : le mode gratuit strict n'est pas activé." }, 503);
    if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return json({ error: "Aucune clé IA n'est configurée." }, 503);

    let input;
    try { input = await request.json(); } catch { return json({ error: "Requête JSON invalide." }, 400); }
    if (!CATEGORIES.has(input.category)) return json({ error: "Catégorie inconnue." }, 400);
    if (JSON.stringify(input).length > MAX_BODY_CHARS) return json({ error: "Contexte trop volumineux." }, 413);

    const plan = planPage(input);
    // TEMPORAIRE : liste des moteurs disponibles, pour la comparaison.
    if (input.engine === "list") return json({ chain: (await engineChain(env)).map(e => `${e.provider}:${e.model}`) });
    const debug = input.debug === "compare";
    const meta = { fin: plan.isEnd, pageNumber: plan.pageNumber, totalPages: plan.total };
    if (input.stream === true && !input.engine && !debug) return streamStory(env, input, plan, meta);
    const outcome = await generateWithFallback(env, input, plan);

    if (outcome.result) {
      const { plan: hiddenPlan, usage, ...visible } = outcome.result;
      let titre = visible.titre;
      if (!titre) titre = await requestTitle(env, input.category, visible.page, visible.memoire).catch(() => "");
      const extra = debug ? { debug: { recette: recipeFor(input, plan), plan: hiddenPlan, usage } } : {};
      return json({ ...visible, titre, ...meta, ...extra });
    }
    if (debug) return json({ error: "échec", details: outcome.errors, retryAfter: outcome.retryAfter ?? null }, 502);

    const retryAfter = outcome.quota ? outcome.retryAfter : 2;
    let error = "Les moteurs gratuits sont temporairement indisponibles. Aucune génération payante n'a été tentée.";
    if (outcome.quota && retryAfter > 60) {
      const minutes = Math.ceil(retryAfter / 60);
      const wait = minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
      error = `Les quotas gratuits de l'IA sont épuisés pour le moment${outcome.limit === "jour" ? " (limite quotidienne)" : ""}. ` +
        `Réessaie dans environ ${wait}. Ton histoire est conservée.`;
    }
    return json({ error, retryAfter, limit: outcome.limit || null, details: outcome.errors }, outcome.quota ? 429 : 503);
  }
};
