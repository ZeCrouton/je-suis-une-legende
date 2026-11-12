# Je suis une légende — MVP v1

Application web de romans interactifs « Je suis une légende ». Interface statique + Cloudflare Worker API.

## Fonctionnalités
- 10 catégories : Fantasy, Science-fiction, Thriller, Horreur, Romance, Aventure, Policier, Mystère, Conte pour enfant, Comédie.
- Deux choix par page, sauf sur la dernière page qui conclut l'histoire.
- Longueur d'un récit complet : 10 pages (adolescents et adultes) ou 7 pages (conte enfant).
- Structure dramatique imposée par le code : ouverture, développement, tournant, climax, dénouement.
- Mémoire du récit renvoyée à chaque page (personnages, faits, fils ouverts, secret) pour garder la cohérence.
- Mode conte enfant avec tranches d'âge 3–5, 6–8 et 9–12 ans.
- Bibliothèque locale : les histoires sont enregistrées dans le navigateur (localStorage).
- Clés API conservées côté Worker, jamais envoyées au navigateur.
- Groq prioritaire, Gemini optionnel en secours.
- Liste blanche des modèles et arrêt si aucun fournisseur configuré/disponible.

## Important : gratuité et facturation
Cette version est conçue pour refuser les modèles qui ne figurent pas dans la liste blanche. Elle ne peut toutefois pas lire les paramètres de facturation privés de tes comptes fournisseurs.
- Groq : reste impérativement sur le plan Free. Groq indique que l'usage Free reste gratuit et qu'un dépassement de quota renvoie une erreur 429. Ne passe pas au plan Developer.
- Gemini : n'ajoute une clé que si le projet Google AI Studio est bien sur le niveau gratuit et qu'aucun compte de facturation payant n'est lié. N'active jamais la facturation pour ce projet.
- Les quotas et modèles gratuits peuvent changer. Vérifie les pages officielles avant le lancement.
- Si une clé est configurée sur un compte payant, la liste blanche du code ne peut pas, à elle seule, empêcher la facturation du fournisseur. La garantie repose aussi sur le maintien des comptes sur leurs offres gratuites et l'absence de facturation activée.
- Cloudflare : l'offre Free a des quotas. L'utilisation au-delà des limites peut nécessiter une action de ta part ; ne souscris pas à une offre payante.

## Lancement local
Le site statique peut être ouvert directement via `public/index.html` pour explorer l'interface. Pour générer des histoires, déploie le Worker et configure les secrets.

## Déploiement Cloudflare Worker
Prérequis : compte Cloudflare gratuit et Node.js installé sur ton ordinateur.

1. Installe Wrangler :
   ```bash
   npm install -g wrangler
   ```
2. Connecte-toi :
   ```bash
   cd worker
   npx wrangler login
   ```
3. Configure le Worker :
   - Le nom du Worker est déjà défini dans `wrangler.toml` (`je-suis-une-legende-api`), qui correspond à l'URL utilisée dans `app.js`.
   - Déploie :
     ```bash
     npx wrangler deploy
     ```
4. Ajoute la clé Groq comme secret :
   ```bash
   npx wrangler secret put GROQ_API_KEY
   ```
5. (Facultatif) Si tu as confirmé que ton projet Gemini est sans facturation :
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
   Puis ajoute le secret `GEMINI_FREE_CONFIRMED` avec la valeur `YES_I_CONFIRMED_NO_BILLING`.
6. Dans `public/app.js`, remplace `WORKER_URL` par l'adresse `https://...workers.dev` obtenue après déploiement.
7. Publie le dossier `public` avec Cloudflare Pages (Direct Upload ou dépôt Git).

## Sauvegarde
La bibliothèque de cette première version est locale au navigateur et à l'appareil. Elle ne se synchronise pas entre appareils et peut être perdue si les données du navigateur sont effacées. Un système de comptes et une base D1 pourront être ajoutés ensuite, après validation du choix de connexion.

## Sécurité et limites
- Les secrets sont uniquement lus côté Worker.
- La liste blanche des modèles est codée côté serveur.
- L'API impose une taille maximale de contexte et une limite de génération.
- Le contrôle de gratuité est un garde-fou logiciel, pas une vérification magique des paramètres de facturation du compte.
- Avant mise en production publique, ajouter une protection anti-abus (limitation par IP, Turnstile ou authentification) afin d'éviter qu'un tiers consomme les quotas gratuits.
