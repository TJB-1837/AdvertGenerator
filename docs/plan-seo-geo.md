# Plan SEO et GEO — Adrafteo

Date : 26 octobre 2026. GEO désigne ici la visibilité dans les réponses des moteurs d’IA.

## Mise en œuvre V1

La langue anglaise est confirmée. Les fondations et les premiers contenus sont implémentés : 11 routes publiques pré-rendues, espace `/app` séparé et non indexable, métadonnées par page, FAQ partagée avec le JSON-LD, sitemap généré, image sociale PNG, trois pages produit et deux guides. Le site conserve React/Vite et ne nécessite pas de migration SQL.

Les contrôles locaux portent sur le HTML généré, les liens, les schémas, les exemples chiffrés, l’affichage sans JavaScript, le mobile, l’hydratation, la navigation et les écrans d’authentification. Il reste à déployer, vérifier les réponses HTTP et redirections de production, tester OAuth réel, contrôler les aperçus sociaux, connecter les outils de mesure et soumettre le sitemap. Les sections suivantes conservent le diagnostic initial et le plan de référence ; elles ne constituent pas un état actuel du code.

## Périmètre et limites

Revue du code local : React/Vite, pages publiques, navigation et initialisation de session, métadonnées, JSON-LD, robots.txt, sitemap et llms.txt. Ce document prépare les changements ; aucune modification fonctionnelle n’est effectuée.

L’indexation réelle, les réponses HTTP de production, les performances mobiles, les volumes de recherche et les conversions restent à mesurer. Aucun accès à Search Console, aux statistiques de trafic ou aux journaux de production n’a été utilisé. Les intentions de recherche ci-dessous sont des hypothèses à valider.

## Diagnostic

| Constat vérifié | Emplacement | Conséquence |
| --- | --- | --- |
| Titre, description, canonical, Open Graph et Twitter déjà présents | `index.html` | Base existante à adapter par URL et au périmètre actuel du produit. |
| HTML initial limité à un conteneur React vide | `index.html`, `src/main.jsx` | Le contenu public dépend de l’exécution JavaScript ; sa lecture est plus fragile pour certains robots. Google peut exécuter JavaScript : cela ne prouve pas une absence d’indexation. |
| Affichage public bloqué par `isLoading` jusqu’au retour de `getSession()` | `src/App.jsx` | La landing dépend inutilement d’un service d’authentification. |
| FAQ, tarifs et pages légales sélectionnés par états React et boutons | `src/App.jsx`, `src/pages/PublicPages.jsx` | Pas d’URL dédiée ni de liens explorables vers ces écrans ; impossible de leur attribuer une identité SEO propre. |
| Accueil public et espace connecté partagent la racine | `src/App.jsx` | Séparer clairement les destinations publiques et privées facilitera la navigation et les règles d’indexation. |
| Sitemap limité à la racine, robots autorisant tous les chemins | `public/` | Cohérent avec l’unique URL publique actuelle ; à revoir lors de la création des routes. |
| JSON-LD WebApplication et FAQPage ; FAQ de la landing correspondante présente | `index.html`, `PublicPages.jsx` | Bonne base ; conserver la cohérence avec le contenu visible et attribuer les schémas aux bonnes routes. |
| Métadonnées centrées sur les modèles d’annonces, application incluant stock, lots, coûts d’import et marges | `index.html`, pages métier | Positionnement public incomplet par rapport au produit réel. |
| Image de partage au format SVG | `public/og-image.svg`, `index.html` | Prévoir une version raster et vérifier les aperçus des plateformes ciblées. |
| `llms.txt` placé à la racine du dépôt, sans copie configurée | `llms.txt`, `vite.config.js` | Sa présence dans le dépôt ne le publie pas automatiquement dans le build Vite. Ce fichier reste facultatif, sans bénéfice de visibilité garanti. |

## Orientation proposée

Présenter Adrafteo comme un outil pour revendeurs indépendants combinant modèles d’annonces réutilisables, suivi de stock et calcul des marges. Garder les modèles comme porte d’entrée et développer progressivement le second axe stock/rentabilité.

Hypothèse de départ : conserver l’anglais, langue actuelle du site. Valider la cible commerciale avant une traduction. Si la priorité devient la France, préparer une version française complète ; ne pas mélanger les langues dans une même page. Utiliser des URL distinctes et hreflang seulement lorsque des traductions équivalentes existent.

Ne pas présenter le produit comme un générateur IA, un outil de publication automatique ou une intégration officielle aux marketplaces : le fonctionnement constaté repose sur les variables et le copier-coller.

## Lot 1 — Fondations techniques, priorité P0

1. Créer de vraies routes publiques : `/`, `/pricing`, `/faq`, `/legal`, `/privacy`, `/terms`. Utiliser des liens `<a href>` pour la navigation et gérer accès direct, actualisation, précédent/suivant.
2. Pré-rendre les pages publiques en HTML au build, avec hydratation des interactions. Conserver React/Vite pour l’espace connecté ; une migration complète de framework n’est pas un prérequis. Valider d’abord un prototype accueil + FAQ et le coût de maintenance de l’outillage choisi.
3. Rendre les pages marketing sans attendre Supabase. Isoler le chargement du workspace et prévoir les erreurs d’authentification.
4. Donner à chaque route son titre, sa description, sa canonical et ses métadonnées sociales dans le HTML livré. Centraliser la définition des routes et métadonnées pour éviter les divergences.
5. Prévoir `/app` pour l’espace privé et une politique `noindex` pour les écrans techniques/authentification. Préserver les callbacks OAuth, liens de confirmation et récupération de mot de passe ; mettre à jour la configuration Supabase si nécessaire. Les contrôles d’accès restent assurés par l’authentification et la RLS, jamais par robots.txt.
6. Générer le sitemap à partir des pages canoniques indexables. Exclure les routes privées, techniques et les erreurs. Définir volontairement l’indexation des pages légales ; elles ne sont pas une priorité d’acquisition.
7. Configurer Vercel : fichiers publics accessibles, routes publiques répondant 200, URL inconnues répondant réellement 404, redirections permanentes des variantes de domaine/protocole vers le domaine canonique confirmé.
8. Ajouter une image sociale raster, par exemple 1200 × 630, avec dimensions et texte alternatif adaptés.

Acceptation : le HTML récupéré sans JavaScript contient le H1, le contenu principal, les liens et les métadonnées propres à chaque page. Les pages publiques restent lisibles si Supabase est indisponible. Les liens directs et les parcours d’authentification restent fonctionnels. Aucune donnée utilisateur dans le HTML pré-rendu ou le sitemap.

## Lot 2 — Positionnement et pages produit, priorité P1

Commencer par trois pages utiles et distinctes, avec maillage depuis l’accueil :

| URL proposée | Intention à valider | Contenu distinctif |
| --- | --- | --- |
| `/listing-templates` | Modèles d’annonces réutilisables | Exemple réel avant/après avec `[Brand]`, `[Size]`, `[Condition]`, étapes et limites du copier-coller. |
| `/reseller-inventory` | Gestion de stock pour revendeurs | Captures avec données fictives, articles et lots, achats, ventes et organisation multi-plateformes. |
| `/reseller-profit-tracking` | Suivi des marges de revente | Exemple chiffré vérifié dans `workspace.js`, distinction acquisition, frais de vente, bénéfice et ROI. |

Actualiser le H1, la présentation courte, le titre et la description de l’accueil pour refléter ce positionnement. Conserver une promesse lisible et éviter d’accumuler des mots-clés.

Revoir `/pricing` pour expliciter « gratuit pendant la bêta », les fonctionnalités réellement disponibles et les conditions connues. Centraliser la FAQ et sa génération JSON-LD afin de synchroniser réponses visibles et données structurées.

Acceptation : chaque page répond à un besoin différent, apporte une démonstration propre, possède une canonical unique et mène vers une inscription mesurable. Aucun volume de recherche ou gain de temps inventé.

## Lot 3 — Contenus et GEO, priorité P1 puis P2

- Publier une définition claire du produit, du public visé, des fonctions et limites ; rendre ces faits cohérents entre accueil, FAQ, tarifs et données structurées.
- Enrichir le schéma WebApplication avec des informations exactes et visibles. Ajouter une identité Organization ou Person selon l’entité réelle ; ne pas inventer de société, avis, notes ou affiliation.
- Publier d’abord deux guides fondés sur le fonctionnement réel : construire un modèle d’annonce réutilisable et calculer le coût complet d’un article avec frais d’acquisition et de vente. Montrer les formules, hypothèses et exemples vérifiés.
- Ajouter auteur identifiable, date de mise à jour réelle, captures du produit et sources primaires lorsque des règles externes sont expliquées. Mettre à jour les contenus lors des changements métier.
- Créer des pages spécifiques Vinted/eBay/Depop uniquement si elles contiennent des exemples et contraintes propres à chaque plateforme. Éviter les pages quasi identiques.
- Vérifier l’accès des robots de recherche dans robots.txt et dans les protections Vercel/CDN. Distinguer recherche et entraînement : autoriser OAI-SearchBot ne nécessite pas d’autoriser GPTBot. L’autorisation globale actuelle n’exprime pas cette distinction.
- Si `llms.txt` est conservé, le placer dans `public/`, le tenir cohérent avec les pages publiées et n’y lister que des URL existantes. Priorité faible : ce fichier n’est pas un prérequis de visibilité IA.

Acceptation : les faits utiles sont accessibles publiquement, vérifiables et cohérents ; les robots autorisés reçoivent le même contenu que les visiteurs. Aucune promesse de classement ou de citation IA.

## Lot 4 — Mesure et validation, à démarrer avant publication

1. Vérifier le domaine dans Google Search Console et Bing Webmaster Tools, puis relever l’état initial : pages indexées, impressions, clics, requêtes de marque et hors marque.
2. Mesurer les inscriptions issues des pages publiques et la première action utile, par exemple premier modèle créé. Définir la collecte sans inclure de données privées dans les événements.
3. Mesurer les performances mobiles avant/après : LCP, INP, CLS, poids des images et JavaScript. Vérifier séparément les données de terrain disponibles et les mesures de laboratoire.
4. Avant mise en production, contrôler le HTML de chaque route, statuts HTTP, canonical, sitemap, robots, JSON-LD et aperçus sociaux. Compléter avec les tests de build et de navigation/authentification adaptés aux changements.
5. Après publication, soumettre le sitemap et inspecter les URL prioritaires dans Search Console. Vérifier que les pages sont explorables et effectivement indexées.
6. Suivre mensuellement les visites référentes des moteurs IA quand elles sont identifiables, les conversions et un petit ensemble stable de questions de découverte. Consigner date, moteur et sources citées : les réponses varient, un test ponctuel ne mesure pas une part de visibilité.

## Ordre de livraison et décisions

Ordre recommandé : mesure initiale → lot 1 → lot 2 → premiers guides du lot 3 → suivi et itération. Estimation indicative : 5 à 9 jours de travail pour les fondations et les trois pages produit, hors attente d’accès, traduction et création de contenus approfondis ; à affiner après le prototype de pré-rendu.

À confirmer avant la rédaction définitive : marché et langue prioritaires, importance commerciale relative des modèles et du stock, domaine canonique de production et accès aux outils de mesure. Ces décisions n’empêchent pas de préparer l’architecture des routes et le prototype HTML public.

## Références officielles

- Google, JavaScript SEO : https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google, optimisation pour la recherche générative : https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- OpenAI, robots de recherche et d’entraînement : https://developers.openai.com/api/docs/bots
