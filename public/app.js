const WORKER_URL = "https://je-suis-une-legende-api.nvzplayforfun.workers.dev/";
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
function show(view){
  ["homeView","readerView","libraryView"].forEach(id=>$(id).classList.toggle("hidden",id!==view));
  window.scrollTo({top:0,behavior:"smooth"});
}
function showError(message){ $("errorBox").textContent=message; $("errorBox").classList.remove("hidden"); }
function paragraphs(text){ return text.split(/\n+/).filter(Boolean).map(p=>`<p>${escapeHtml(p)}</p>`).join(""); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function generate(selectedChoice=null){
  $("errorBox").classList.add("hidden");
  $("providerNote").textContent="";
  const buttons=[...document.querySelectorAll(".choice"),$("startBtn")].filter(Boolean);
  buttons.forEach(b=>b.disabled=true);
  const body={
    category:currentStory.category,
    age:currentStory.age,
    seed:currentStory.seed,
    history:currentStory.pages,
    selectedChoice
  };
  try{
    const response=await fetch(`${WORKER_URL}/api/story`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"La génération est momentanément indisponible.");
    currentStory.pages.push({page:data.page,choices:data.choices,choice:selectedChoice||"Début"});
    currentStory.updatedAt=new Date().toISOString();
    renderStory();
    $("providerNote").textContent=`Généré avec ${data.provider} · Histoire enregistrée dans cette session`;
  }catch(error){
    showError(`${error.message} Tu peux réessayer plus tard. Aucune génération payante n'a été tentée.`);
  }finally{
    buttons.forEach(b=>b.disabled=false);
  }
}
function renderStory(){
  const n=currentStory.pages.length;
  const page=currentStory.pages[n-1];
  $("genreTag").textContent=currentStory.category;
  $("pageCount").textContent=`Page ${n}`;
  $("storyTitle").textContent=currentStory.title||"Une nouvelle aventure";
  $("storyText").innerHTML=paragraphs(page.page);
  $("choices").innerHTML=page.choices.map((choice,i)=>`<button class="choice" data-choice="${i}"><b>${i+1}.</b>${escapeHtml(choice)}</button>`).join("");
  document.querySelectorAll(".choice").forEach((btn,i)=>btn.addEventListener("click",()=>generate(page.choices[i])));
  show("readerView");
}
$("startBtn").addEventListener("click",async()=>{
  currentStory={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),category:selectedCategory,age:$("ageSelect").value,seed:$("seed").value.trim(),title:$("seed").value.trim().slice(0,55)||"Une nouvelle aventure",pages:[],createdAt:new Date().toISOString()};
  await generate();
});
$("saveBtn").addEventListener("click",()=>{
  if(!currentStory||!currentStory.pages.length)return;
  const items=loadLibrary(); const index=items.findIndex(x=>x.id===currentStory.id);
  if(index>=0)items[index]=currentStory;else items.unshift(currentStory);
  saveLibrary(items); $("saveBtn").textContent="♥ Enregistré";
});
$("backBtn").addEventListener("click",()=>show("homeView"));
$("libraryBtn").addEventListener("click",renderLibrary);
$("libraryBack").addEventListener("click",()=>show("homeView"));
function renderLibrary(){
  const items=loadLibrary();
  $("libraryList").innerHTML=items.length?items.map(s=>`<article class="library-item"><div><h3>${escapeHtml(s.title||"Une aventure")}</h3><p>${escapeHtml(s.category)} · ${s.pages.length} page(s)</p></div><div><button class="ghost" data-open="${s.id}">Reprendre</button> <button class="ghost" data-delete="${s.id}" aria-label="Supprimer">×</button></div></article>`).join(""):`<div class="empty">Votre bibliothèque est encore vide.<br>Enregistrez une histoire pour la retrouver ici.</div>`;
  document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{currentStory=loadLibrary().find(x=>x.id===b.dataset.open);renderStory()}));
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{saveLibrary(loadLibrary().filter(x=>x.id!==b.dataset.delete));renderLibrary()}));
  show("libraryView");
}
renderCategories(); updateCount();
