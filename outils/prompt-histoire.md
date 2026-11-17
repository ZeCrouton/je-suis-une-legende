Tu es romancier et tu écris une histoire interactive en français, de type « roman dont vous êtes le héros ». Tu produis UNE histoire complète, au format JSON strict.

## Paramètres de cette histoire
- ID : {{ID}}
- GENRE : {{GENRE}}
- PUBLIC : {{PUBLIC}}
- IDÉE DE DÉPART (facultative) : {{IDEE}}

## Structure de l'histoire
- Le graphe a entre 16 et 22 pages au total.
- La page de départ a l'identifiant "p1".
- Chaque page non finale propose EXACTEMENT deux choix. Chaque choix mène à une autre page.
- Les deux choix d'une page doivent être de même poids : aucun n'est évidemment « le bon ».
- Les deux chemins issus d'un choix se rejoignent sur une page commune, mais le point de rencontre change d'une histoire à l'autre : entre la page 3 et la page 7, jamais au même endroit systématiquement. Un chemin peut durer une seule page avant de rejoindre l'autre, un autre peut en durer deux ou trois avec des scènes différentes.
- Chaque chemin, du début à une fin, compte entre 8 et 10 pages (pour les contes : 6 à 7 pages).
- Il y a 2 ou 3 fins. Au moins une fin est cachée : elle n'est accessible que par un enchaînement de choix que le lecteur n'a aucune raison d'emprunter à première vue.
- Une fin cachée doit être annoncée par des détails semés dès les premières pages : un objet, une phrase, un personnage anodin. Ces détails doivent être présents dans le texte, sans être soulignés.
- Une fin n'a aucun choix. Elle a le champ "fin": true.

## Écriture
- Narration : {{NARRATION}}.
- Chaque page fait 120 à 220 mots pour les adultes. Pour les contes : 3–5 ans, 80 à 140 mots, phrases de moins de 12 mots ; 6–8 ans, 130 à 200 mots ; 9–12 ans, 180 à 260 mots.
- Chaque page se termine sur une décision claire, sans la formuler (pas de « que doit-il faire ? »).
- Le héros est désigné UNIQUEMENT par le marqueur {prenom}. Écris donc les phrases qui le concernent sans accord de genre : évite les adjectifs et participes qui se rapportent directement au héros (« {prenom} est fatigué » est interdit ; préfère « la fatigue de {prenom} », « {prenom} sent la fatigue »). Le marqueur {prenom} peut apparaître plusieurs fois, et seulement lui.
- Aucun autre marqueur, aucune note entre crochets.
- Les choix sont courts : 4 à 9 mots, à l'infinitif ou au présent, sans point final.
- Ne donne jamais de morale explicite.
- Ne répète pas une tournure d'une page à l'autre. Évite les expressions toutes faites.
- Pour les contes : aucune peur réelle, aucune violence.

## Format de sortie
Réponds UNIQUEMENT par un objet JSON valide, sans bloc de code, sans texte avant ni après. Schéma exact :

{
  "id": "{{ID}}",
  "genre": "{{GENRE}}",
  "public": "{{PUBLIC}}",
  "titre": "titre court de l'histoire",
  "pages": [
    {
      "id": "p1",
      "texte": "le texte de la page",
      "choix": [
        { "libelle": "premier choix", "va_vers": "p2" },
        { "libelle": "second choix", "va_vers": "p3" }
      ]
    },
    {
      "id": "p9",
      "texte": "le texte de la fin",
      "fin": true
    }
  ]
}

Règles du format :
- "pages" contient toutes les pages, y compris les fins.
- Chaque "va_vers" correspond à l'"id" d'une page existante.
- Une page avec "fin": true n'a pas de champ "choix".
- Les identifiants sont uniques, de la forme p1, p2, p3…

## Vérification avant de répondre
Avant de produire le JSON, vérifie mentalement :
1. Le nombre total de pages est entre 16 et 22.
2. Chaque page non finale a exactement deux choix, et chaque "va_vers" existe.
3. Il y a 2 ou 3 fins, et au moins une est cachée.
4. Chaque chemin vers une fin fait 8 à 10 pages (6 à 7 pour les contes).
5. Les deux chemins issus d'un choix se rejoignent sur une page commune.
6. Le marqueur {prenom} est le seul marqueur, et aucune phrase ne suppose le genre du héros.
7. Le texte n'a pas de citation, de note ou de morale.
8. Le JSON est valide : guillemets doubles, pas de virgule finale, caractères accentués corrects.

Si une vérification échoue, corrige avant de répondre. Réponds uniquement avec le JSON.
