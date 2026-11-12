const WORKER_URL = "https://je-suis-une-legende-api.nvzplayforfun.workers.dev";
const categories = [
  ["Fantasy","🧙"],["Science-fiction","🚀"],["Thriller","🕯️"],["Horreur","🌙"],["Romance","💌"],
  ["Aventure","🧭"],["Policier","🔎"],["Mystère","🗝️"],["Conte pour enfant","🦊"],["Comédie","🎭"]
];
const $ = id => document.getElementById(id);
let selectedCategory = "Fantasy";
let currentStory = null;

function loadLibrary(){ try{return JSON.parse(localStorage.getItem("recitsChoixLibrary")||"[]")}catch{return []} }
function saveLibrary(items){ localStorage.setItem("recitsChoixLibrary",JSON.stringify(items)); updateCount(); }
function updateCount(){ $("savedCount").textContent = loadLibrary().length; }
function renderCategories(){
  $("categories").innerHTML = categories.map(([name,emoji])=>`<button class="category ${name===selectedCategory?"selected":""}" data-cat="${name}"><span class="emoji">${emoji}</span><span>${name}</span></button>`).join("");
  document.querySelectorAll(".category").forEach(btn=>btn.addEventListener("click",()=>{
    selectedCategory=btn.dataset.cat; renderCategories(); $("childOptions").classList.toggle("hidden",selectedCategory!=="Conte pour enfant");
  }));
}
// Histoire en cours : sauvegardée à chaque changement d'écran ou de page, pour qu'un
// rechargement de la page (ou la fermeture de l'onglet) ne fasse rien perdre.
const STATE_KEY = "recitsChoixCurrent";
function saveState(view){
  try {
    if (!currentStory || !currentStory.pages.length) return;
    localStorage.setItem(STATE_KEY, JSON.stringify({ story: currentStory, view, index: displayedIndex }));
    // Si l'histoire est déjà dans la bibliothèque, sa copie est mise à jour aussi.
    const items = loadLibrary();
    const i = items.findIndex(x => x.id === currentStory.id);
    if (i >= 0 && JSON.stringify(items[i]) !== JSON.stringify(currentStory)) { items[i] = currentStory; saveLibrary(items); }
  } catch {}
}
function updateResume(){
  const btn = $("resumeBtn");
  const has = currentStory && currentStory.pages.length;
  btn.classList.toggle("hidden", !has);
  if (has) btn.textContent = `↩ Reprendre mon histoire en cours · ${currentStory.category} · page ${currentStory.pages.length}`;
}
// Messages d'attente et d'erreur : affichés sur l'écran où se trouve l'utilisateur
// (accueil quand il vient de cliquer sur « Commencer l'aventure », lecture sinon).
function placeNotes(view){
  (view === "homeView" ? $("noteSlotHome") : $("noteSlotReader")).append($("providerNote"), $("errorBox"));
}
function show(view){
  if (typeof stopReading === "function") stopReading();
  ["homeView","readerView","libraryView"].forEach(id=>$(id).classList.toggle("hidden",id!==view));
  placeNotes(view);
  window.scrollTo({top:0,behavior:"smooth"});
  saveState(view);
  updateResume();
}
function showError(message){ $("errorBox").textContent=message; $("errorBox").classList.remove("hidden"); }
// Nettoie le texte affiché : retours à la ligne écrits sous forme de texte (\n ou /n).
function cleanText(text){
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\\+r\\+n|\\+n|\\+r/g, "\n")
    .replace(/\\+t/g, " ")
    .replace(/(?:\/n)+(?=[\s"«A-ZÀ-ÖØ-Þa-zà-öø-ÿ0-9—–\-.,!?…]|$)/g, "\n")
    .replace(/\*\*|__/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
function paragraphs(text){
  return cleanText(text).split(/\n+/).map(p=>p.trim()).filter(Boolean).map(p=>`<p>${escapeHtml(p)}</p>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

let generating = false;

// choiceIndex : index du choix cliqué sur la dernière page (null pour la première page).
async function generate(choiceIndex = null) {
  if (generating) return;
  generating = true;
  updateNav();
  $("errorBox").classList.add("hidden");
  const last = currentStory.pages[currentStory.pages.length - 1];
  const selectedChoice = choiceIndex === null ? null : last.choices[choiceIndex];
  const selectedDirection = choiceIndex === null ? "" : (last.directions?.[choiceIndex] || "");
  $("providerNote").textContent = "";

  const buttons = [
    ...document.querySelectorAll(".choice"),
    $("startBtn")
  ].filter(Boolean);

  buttons.forEach(button => button.disabled = true);

  // Le bouton cliqué affiche un message d'attente à la place de son texte, le temps de la génération.
  const clicked = choiceIndex === null ? $("startBtn") : document.querySelectorAll(".choice")[choiceIndex];
  const originalHTML = clicked ? clicked.innerHTML : "";
  if (clicked) { clicked.textContent = "L'auteur fait glisser sa plume…"; clicked.classList.add("is-loading"); }
  const restoreButton = () => {
    if (!clicked) return;
    clicked.innerHTML = originalHTML;
    clicked.classList.remove("is-loading");
  };

  const body = {
    category: currentStory.category,
    age: currentStory.age,
    seed: currentStory.seed,
    hero: currentStory.hero || "",
    // Seules les 3 dernières pages sont envoyées ; la mémoire couvre le reste de l'histoire.
    history: currentStory.pages.slice(-3).map(p => ({ page: p.page, choice: p.choice })),
    pageNumber: currentStory.pages.length + 1,
    memo: currentStory.memo || "",
    selectedChoice,
    // Conséquence prévue par l'IA pour ce choix : la page suivante doit la réaliser.
    selectedDirection
  };

  // Délais de secours, utilisés seulement si le serveur n'indique pas le temps d'attente exact.
  const retryDelays = [3, 5, 8, 10, 15];
  const temporaryStatuses = [408, 425, 429, 500, 502, 503, 504];

  const wait = seconds =>
    new Promise(resolve => setTimeout(resolve, seconds * 1000));

  let lastError = null;

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      $("providerNote").textContent =
        attempt === 1
          ? "Génération de votre histoire en cours…"
          : `Nouvelle tentative (${attempt}/6)…`;

      const response = await fetch(`${WORKER_URL}/api/story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      let data;

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const error = new Error(
          data.error || `Erreur du serveur (${response.status}).`
        );
        error.status = response.status;
        error.retryAfter = Number(data.retryAfter) || null;
        throw error;
      }

      if (!data.page || !Array.isArray(data.choices)) {
        throw new Error("La réponse reçue est incomplète. Réessaie.");
      }

      currentStory.pages.push({
        page: cleanText(data.page),
        choices: data.choices.map(cleanText),
        directions: Array.isArray(data.directions) ? data.directions : [],
        choice: selectedChoice || "Début"
      });

      currentStory.memo = data.memoire || currentStory.memo || "";
      currentStory.title = data.titre || currentStory.title || "";
      currentStory.totalPages = data.totalPages || currentStory.totalPages;
      currentStory.finished = data.fin === true;
      currentStory.updatedAt = new Date().toISOString();

      generating = false;
      restoreButton();
      $("startBtn").disabled = false;
      renderStory();

      $("providerNote").textContent =
        `Généré avec ${data.provider} · Histoire enregistrée dans cette session`;

      return;

    } catch (error) {
      lastError = error;

      const temporary =
        temporaryStatuses.includes(error.status) ||
        error.status === undefined;

      // Attente longue (quota gratuit épuisé) : inutile de réessayer en boucle,
      // on affiche tout de suite le message avec le délai.
      if (!temporary || attempt === 6 || (error.retryAfter && error.retryAfter > 60)) {
        break;
      }

      // On attend exactement le temps indiqué par le serveur (quota Groq), sinon un délai court.
      const delay = Math.min(Math.max(Math.ceil(error.retryAfter || retryDelays[attempt - 1]), 1), 60);

      // Compte à rebours affiché seconde par seconde.
      for (let left = delay; left > 0; left--) {
        $("providerNote").textContent =
          `Le moteur gratuit fait une petite pause… Nouvelle tentative dans ${left} s.`;
        await wait(1);
      }
    }
  }

  const longWait = lastError?.retryAfter && lastError.retryAfter > 60;
  const message = longWait
    ? lastError.message
    : `${lastError?.message || "La génération a échoué."} ` +
      "Les nouvelles tentatives automatiques ont échoué. " +
      "Tu peux réessayer manuellement. Aucune génération payante n'a été tentée.";

  $("providerNote").textContent = "";
  showError(message);
  generating = false;
  restoreButton();
  buttons.forEach(button => button.disabled = false);
  updateNav();
}

// Lecture à voix haute (API Web Speech, intégrée au navigateur, gratuite).
const canSpeak = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
let speaking = false;
let readToken = 0; // invalide les événements d'une lecture précédente

function frenchVoice(){
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith("fr-fr"))
      || voices.find(v => v.lang && v.lang.toLowerCase().startsWith("fr"))
      || null;
}

function setReadButton(isSpeaking){
  speaking = isSpeaking;
  const btn = $("readBtn");
  btn.textContent = isSpeaking ? "⏹ Arrêter" : "🔊 Écouter";
  btn.setAttribute("aria-pressed", String(isSpeaking));
}

function stopReading(){
  readToken++;
  if (canSpeak) speechSynthesis.cancel();
  setReadButton(false);
  $("readMenu").classList.add("hidden");
}

// Lit une liste de passages. Chaque passage est une lecture distincte, pour éviter
// que les navigateurs coupent les longs textes.
function speakParts(parts){
  stopReading();
  const token = readToken;
  const voice = frenchVoice();
  parts.forEach((text, i) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.95;
    if (voice) utterance.voice = voice;
    if (i === parts.length - 1) {
      utterance.onend = () => { if (token === readToken) setReadButton(false); };
    }
    utterance.onerror = () => { if (token === readToken) setReadButton(false); };
    speechSynthesis.speak(utterance);
  });
  setReadButton(true);
}

function readStory(scope){
  if (!canSpeak || !currentStory || !currentStory.pages.length) return;
  const title = currentStory.title ? currentStory.title + ". " : "";
  const pages = currentStory.pages;
  if (scope === "all") {
    speakParts(pages.map((p, i) => (i === 0 ? title : "") + `Page ${i + 1}. ` + p.page));
  } else {
    const idx = displayedIndex ?? pages.length - 1;
    speakParts([title + pages[idx].page]);
  }
}

$("readBtn").addEventListener("click", () => {
  if (speaking) { stopReading(); return; }
  $("readMenu").classList.toggle("hidden");
});
document.querySelectorAll("[data-read]").forEach(btn =>
  btn.addEventListener("click", () => readStory(btn.dataset.read))
);
if (!canSpeak) $("readBtn").classList.add("hidden");


let displayedIndex = null; // page actuellement affichée (null = aucune)

// Affiche la page la plus récente, ou une page précédente en relecture (atIndex).
function renderStory(atIndex){
  stopReading();
  const pages = currentStory.pages;
  const n = pages.length;
  const idx = typeof atIndex === "number" ? atIndex : n - 1;
  const isLatest = idx === n - 1;
  const page = pages[idx];
  displayedIndex = idx;

  $("genreTag").textContent = currentStory.category;
  $("pageCount").textContent = `Page ${idx + 1}${currentStory.totalPages ? ` sur ${currentStory.totalPages}` : ""}${isLatest ? "" : " · relecture"}`;
  $("storyTitle").textContent = cleanText(currentStory.title || "") || "Une nouvelle aventure";
  $("storyText").innerHTML = paragraphs(page.page);

  updateNav();
  $("storyFooterText").textContent = isLatest ? "À vous de décider…" : "Relecture";

  const heading = document.querySelector(".choices-wrap h3");
  if (isLatest) {
    const ended = page.choices.length === 0;
    heading.classList.toggle("hidden", ended);
    $("choices").innerHTML = ended
      ? `<p class="end-note">Fin de l'histoire. Enregistrez-la dans votre bibliothèque ou commencez une nouvelle aventure.</p>`
      : page.choices.map((choice,i)=>`<button class="choice" data-choice="${i}"><b>${i+1}.</b>${escapeHtml(cleanText(choice))}</button>`).join("");
    document.querySelectorAll(".choice").forEach((btn,i)=>{
      btn.disabled = generating;
      btn.addEventListener("click",()=>generate(i));
    });
  } else {
    // En relecture : le choix déjà fait est affiché, mais ne peut plus être modifié.
    heading.classList.add("hidden");
    const taken = pages[idx + 1].choice;
    $("choices").innerHTML = `<p class="locked-choice">Choix effectué à cette étape : « ${escapeHtml(cleanText(taken))} »<br><span>Ce choix ne peut plus être modifié.</span></p>`;
  }
  show("readerView");
}

// « Je veux être le héros du roman » : le prénom est mémorisé pour les prochaines histoires.
const HERO_KEY = "recitsChoixHero";
function setHeroMode(on){
  $("heroToggle").setAttribute("aria-pressed", String(on));
  $("heroField").classList.toggle("hidden", !on);
}
function saveHeroPrefs(){
  try { localStorage.setItem(HERO_KEY, JSON.stringify({ on: $("heroToggle").getAttribute("aria-pressed") === "true", name: $("heroName").value.trim() })); } catch {}
}
function loadHeroPrefs(){
  try {
    const prefs = JSON.parse(localStorage.getItem(HERO_KEY) || "null");
    if (!prefs) return;
    $("heroName").value = String(prefs.name || "").slice(0, 30);
    setHeroMode(prefs.on === true);
  } catch {}
}
$("heroToggle").addEventListener("click", () => {
  const on = $("heroToggle").getAttribute("aria-pressed") !== "true";
  setHeroMode(on);
  saveHeroPrefs();
  if (on) $("heroName").focus();
});
$("heroName").addEventListener("input", saveHeroPrefs);

$("startBtn").addEventListener("click",async()=>{
  const heroOn = $("heroToggle").getAttribute("aria-pressed") === "true";
  const hero = heroOn ? $("heroName").value.trim() : "";
  if (heroOn && !hero) {
    showError("Écrivez votre prénom pour devenir le héros du roman, ou désactivez cette option.");
    $("heroName").focus();
    return;
  }
  $("errorBox").classList.add("hidden");
  const previousStory = currentStory;
  const previousIndex = displayedIndex;
  currentStory = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    category: selectedCategory,
    age: $("ageSelect").value,
    seed: $("seed").value.trim(),
    hero,
    title: "",
    pages: [],
    memo: "",
    totalPages: null,
    finished: false,
    createdAt: new Date().toISOString()
  };
  displayedIndex = null;
  $("saveBtn").textContent = "♡ Enregistrer";
  await generate();
  // Première page impossible à générer : on retrouve l'histoire précédente, rien n'est perdu.
  if (!currentStory.pages.length) { currentStory = previousStory; displayedIndex = previousIndex; updateResume(); }
});
$("saveBtn").addEventListener("click",()=>{
  if(!currentStory||!currentStory.pages.length)return;
  const items=loadLibrary(); const index=items.findIndex(x=>x.id===currentStory.id);
  if(index>=0)items[index]=currentStory;else items.unshift(currentStory);
  saveLibrary(items); $("saveBtn").textContent="♥ Enregistré";
});
// Navigation de relecture : on peut relire toutes les pages précédentes,
// mais les choix déjà faits restent verrouillés.
function updateNav(){
  if (!currentStory) return;
  const n = currentStory.pages.length;
  const idx = displayedIndex ?? n - 1;
  $("prevBtn").classList.toggle("hidden", idx <= 0);
  $("nextBtn").classList.toggle("hidden", idx >= n - 1);
  $("currentBtn").classList.toggle("hidden", idx >= n - 2);
  ["prevBtn","nextBtn","currentBtn"].forEach(id => $(id).disabled = generating);
}
$("prevBtn").addEventListener("click", () => { if (displayedIndex > 0) renderStory(displayedIndex - 1); });
$("nextBtn").addEventListener("click", () => {
  const n = currentStory.pages.length;
  if (displayedIndex < n - 1) renderStory(displayedIndex + 1);
});
$("currentBtn").addEventListener("click", () => renderStory());
$("backBtn").addEventListener("click",()=>show("homeView"));
$("libraryBtn").addEventListener("click",renderLibrary);
$("libraryBack").addEventListener("click",()=>show("homeView"));
function renderLibrary(){
  const items=loadLibrary();
  $("libraryList").innerHTML=items.length?items.map(s=>`<article class="library-item"><div><h3>${escapeHtml(s.title||"Une aventure")}</h3><p>${escapeHtml(s.category)} · ${s.pages.length} page(s)${s.finished ? " · terminée" : ""}</p></div><div><button class="ghost" data-open="${s.id}">Reprendre</button> <button class="ghost" data-delete="${s.id}" aria-label="Supprimer">×</button></div></article>`).join(""):`<div class="empty">Votre bibliothèque est encore vide.<br>Enregistrez une histoire pour la retrouver ici.</div>`;
  document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{
    currentStory=loadLibrary().find(x=>x.id===b.dataset.open);
    displayedIndex=null;
    $("saveBtn").textContent="♥ Enregistré";
    renderStory();
  }));
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{saveLibrary(loadLibrary().filter(x=>x.id!==b.dataset.delete));renderLibrary()}));
  show("libraryView");
}
// Au chargement : on revient exactement là où l'utilisateur était (page lue, relecture, bibliothèque).
function restoreState(){
  try {
    const st = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    if (!st || !st.story || !Array.isArray(st.story.pages) || !st.story.pages.length) return;
    currentStory = st.story;
    const saved = loadLibrary().find(x => x.id === currentStory.id);
    $("saveBtn").textContent = saved ? "♥ Enregistré" : "♡ Enregistrer";
    const n = currentStory.pages.length;
    const idx = Number.isInteger(st.index) && st.index >= 0 && st.index < n ? st.index : undefined;
    if (st.view === "readerView") renderStory(idx);
    else if (st.view === "libraryView") { displayedIndex = idx ?? n - 1; renderLibrary(); }
    else { displayedIndex = idx ?? n - 1; updateResume(); }
  } catch {}
}
$("resumeBtn").addEventListener("click", () => renderStory(displayedIndex ?? undefined));
placeNotes("homeView");
loadHeroPrefs();
renderCategories(); updateCount(); restoreState();
