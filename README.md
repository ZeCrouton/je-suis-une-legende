# Je suis une légende

Application web de romans interactifs « Je suis une légende ». Interface statique (`public/`) + Cloudflare Worker API (`worker/`).

## Fonctionnalités
- 10 catégories : Fantasy, Science-fiction, Thriller, Horreur, Romance, Aventure, Policier, Mystère, Conte pour enfant, Comédie.
- Deux choix par page, sauf sur la dernière page qui conclut l'histoire.
- Longueur d'un récit complet : 10 pages (adolescents et adultes) ou 7 pages (conte enfant).
- Structure dramatique imposée par le code : ouverture, développement, tournant, climax, dénouement.
- Mémoire du récit renvoyée à chaque page (personnages, faits, fils ouverts, secret) pour garder la cohérence.
- Fiches de genre complètes : ton, narration imposée, moteur, secret, tournant, climax, fin et choix typiques.
- Continuité : la page suivante reprend exactement après les dernières lignes lues.
- Choix à conséquence : pour chaque choix, l'IA prévoit ce qu'il déclenche ; la page suivante doit le réaliser.
- Relecture de toutes les pages précédentes, sans pouvoir modifier les choix déjà faits.
- Mode conte enfant avec tranches d'âge 3–5, 6–8 et 9–12 ans.
- Bibliothèque locale : les histoires sont enregistrées dans le navigateur (localStorage).
- Clés API conservées côté Worker, jamais envoyées au navigateur.

## Moteurs IA (gratuits)
Les moteurs sont essayés dans cet ordre, défini dans `worker/src/index.js` :
1. **Gemini** (niveau gratuit) : `gemini-2.5-flash`, puis `gemini-2.5-flash-lite`.
2. **Groq** (plan Free) : `openai/gpt-oss-120b`, puis `openai/gpt-oss-20b`.

Chaque modèle a son propre quota : dès qu'un quota est atteint, le Worker passe au suivant.

La liste blanche est **stricte** : seuls les identifiants exacts ci-dessus peuvent être appelés. Aucun modèle n'est ajouté automatiquement à partir de l'API d'un fournisseur. Pour en ajouter un, modifier `GEMINI_ALLOWED` ou `GROQ_ALLOWED` à la main, après avoir vérifié son niveau gratuit sur la page officielle du fournisseur.

## Garde-fous de coût et d'abus
Le Worker applique, avant chaque génération :
- **Interrupteur d'urgence** : `GENERATION_ENABLED = "false"` dans `wrangler.toml` suspend toute génération.
- **Plafond quotidien global** : `DAILY_LIMIT` pages par jour (300 par défaut).
- **Plafond par adresse IP** : `IP_DAILY_LIMIT` pages par jour et par visiteur (40 par défaut).
- **Fermé par défaut** : sans liaison KV `USAGE`, aucune génération n'est lancée.
- **Mode gratuit strict** : `FREE_ONLY = "true"` est requis.

Limites à connaître :
- Le Worker ne peut pas lire les paramètres de facturation privés de vos comptes fournisseurs. Le garde-fou protège contre les abus et les usages excessifs, pas contre une facturation activée sur un compte. Gardez les comptes sur leur offre gratuite et ne souscrivez à aucune offre payante.
- Les compteurs sont stockés dans Cloudflare KV, qui n'est pas atomique : sous forte charge simultanée, le plafond peut être dépassé de quelques requêtes. Pour un plafond exact, utiliser un Durable Object.
- Les quotas et modèles gratuits peuvent changer. Vérifiez les pages officielles avant chaque mise en production.

## Lancement local
Le site statique se lance avec un petit serveur HTTP, pas en ouvrant directement le fichier (le service worker ne fonctionne pas en `file://`) :
```bash
cd public
python3 -m http.server 8000
```
Puis ouvrir `http://localhost:8000`. Pour générer des histoires, le Worker doit être déployé.

## Déploiement du Worker
Prérequis : compte Cloudflare gratuit et Node.js.

1. Installer Wrangler : `npm install -g wrangler`
2. Se connecter : `cd worker && npx wrangler login`
3. Créer le stockage des compteurs :
   ```bash
   npx wrangler kv namespace create USAGE
   ```
   Reporter l'identifiant affiché dans `worker/wrangler.toml` (champ `id` de `[[kv_namespaces]]`). Tant que la valeur par défaut `REMPLACER_PAR_L_ID_DU_NAMESPACE_KV` est présente, le déploiement échoue.
4. Ajouter les clés comme secrets :
   ```bash
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put GEMINI_API_KEY
   ```
   La clé Gemini doit venir d'un projet Google AI Studio **sans facturation activée**.
5. Déployer : `npx wrangler deploy`
6. Vérifier que `WORKER_URL` dans `public/app.js` correspond à l'URL `https://...workers.dev` obtenue.
7. Publier le dossier `public` avec Cloudflare Pages (Direct Upload ou dépôt Git).

## Sauvegarde
La bibliothèque est locale au navigateur et à l'appareil. Elle ne se synchronise pas entre appareils et peut être perdue si les données du navigateur sont effacées. Un système de comptes et une base D1 pourront être ajoutés ensuite.

## Sécurité
- Les secrets ne sont lus que côté Worker.
- La liste blanche des modèles est codée côté serveur, sans découverte automatique.
- Les garde-fous de plafond et d'interrupteur sont décrits ci-dessus.
- Le CORS est ouvert (`*`) : il ne protège pas contre les appels directs à l'API. Les plafonds par IP et par jour sont la protection réelle.
- Avant une mise en production publique, ajouter si possible une vérification anti-robot (Turnstile) ou une authentification.
