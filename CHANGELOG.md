# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

## [1.2.0] - 2026-09-18

**Un seul copier-coller, et un guide d'une page.** Rien du code ne change :
ce qui change, c'est la distance entre l'outil et quelqu'un qui veut s'en
servir.

### Ajouté

- **`distribution/limiteur-de-creneaux.gs`**, engendré par
  `node outils/assembler.js` : les quinze fichiers en un seul, précédé d'un
  en-tête qui dit quoi faire dès les premières lignes. Quinze fichiers à créer
  un par un dans l'éditeur Apps Script, personne ne le fait ; un copier-coller,
  tout le monde le fait. L'assemblage est sûr parce que le banc vérifiait déjà
  que le projet se charge dans l'ordre alphabétique — contrôle posé pour un
  tout autre piège.
- **`DEMARRAGE.md`**, cent lignes qui prennent par la main : installer, le cas
  d'un formulaire qui reçoit déjà des réponses, le quotidien, et la seule
  chose à comprendre. Le README en fait 851 et explique la conception — c'est
  un autre texte, pour un autre lecteur.
- **Le README dit à qui s'adresse chaque dossier**, et renvoie au guide dès sa
  troisième ligne.

### Modifié

- **Le banc vérifie que la distribution n'a pas vieilli** : chaque source doit
  y figurer intégralement, et la version annoncée doit être la bonne. Une
  distribution périmée est pire qu'une distribution absente — elle a l'air
  d'être à jour, et livre du code d'avant-hier à quelqu'un qui n'a aucun moyen
  de s'en apercevoir.
- **L'épreuve réassemble la distribution** après avoir introduit un défaut,
  sans quoi tout défaut ferait échouer le banc par la fraîcheur plutôt que par
  l'assertion visée : elle se serait félicitée pour la mauvaise raison.
- Le banc passe à **213 assertions**, l'épreuve à **quarante défauts**.

## [1.1.0] - 2026-09-18

**Se greffer sur un formulaire qui tourne déjà.** Le cas n'avait jamais été
traité : tout supposait un formulaire neuf.

### Corrigé

- **L'installation n'écrase plus un onglet qui ne lui appartient pas.** Les
  onglets « Aide », « Vérification » et « Listes » sont réécrits en entier ;
  un classeur métier qui en porterait un du même nom perdait son contenu, en
  silence. Le critère est l'en-tête : vide, absent, ou celui qu'on écrit
  soi-même, l'onglet est à nous ; tout le reste appartient à quelqu'un et se
  renomme — ce n'est pas au code d'en décider. Les trois refus sont contrôlés
  **avant** la première écriture : un classeur à moitié installé est pire
  qu'un classeur pas installé.

### Ajouté

- **Une section « Greffer sur un formulaire qui tourne déjà »** au README, et
  ce qu'elle dit surprend : les réponses déjà reçues **sont comptées**, donc
  un créneau déjà plein disparaît du formulaire dès qu'on renseigne sa
  capacité, sans que personne en soit averti.
- Le rappel que **les inscrits d'avant n'ont aucun verdict** — le déclencheur
  n'existait pas quand ils ont répondu, et rien ne le rattrape. « Établir les
  listes » est le seul moyen de savoir lesquels dépassent, et donc qui
  prévenir à la main.

### Modifié

- Le banc passe à **213 assertions**, l'épreuve à **trente-neuf défauts**.

## [1.0.0] - 2026-09-18

Première version complète. Le critère n’est pas la perfection : c’est que ce que
l’outil promet a été vérifié dans les conditions où il servira, défauts compris.

**La surréservation a été produite en conditions réelles, et traitée comme
prévu.** Le code ne change pas : tout ce qui devait l'être est vérifié.

### Vérifié

- **Une réponse envoyée depuis un formulaire resté ouvert après le retrait de
  l'option est acceptée par Google**, comme annoncé depuis la première
  version — et l'outil la nomme « Surréservation », au rang 5 pour 4 places,
  l'inscrit au Journal et envoie le courriel de liste d'attente. C'est le
  raisonnement qui fonde tout le projet : le retrait est un confort
  d'affichage, le verdict est la garantie.
- **Le courriel de dépassement part bien alors que la confirmation est
  désactivée** : c'est la règle voulue, laisser quelqu'un croire qu'il a une
  place étant le seul défaut vraiment coûteux de ce montage.
- **Les couleurs du Journal fonctionnent** : « Acceptée » en vert, 
  « Surréservation » en orange, sur quatorze soumissions traitées par le
  déclencheur.

### Su et dit

- **La largeur en secondes de la fenêtre de surréservation reste inconnue.**
  Ce n'est pas un défaut mais une donnée manquante : elle dirait quelle marge
  recommander par défaut. En attendant, la marge vaut zéro et se choisit au
  jugé.
- Le banc reste à **213 assertions** et l'épreuve à **trente-huit défauts** :
  l'essai n'a rien trouvé à corriger cette fois.

## [0.10.1] - 2026-09-18

**Une mise à jour ne laisse plus le classeur se contredire.** Défaut introduit
par la 0.10.0 elle-même, vu dans la minute.

### Corrigé

- **La liste déroulante de la colonne « État » se remet à jour toute seule.**
  Ajouter l'état « Complet par la marge » n'avait pas touché à la validation
  des classeurs déjà installés : le code y écrivait donc une valeur que le
  classeur signalait « Non valide », en rouge, sur des lignes qu'il venait
  lui-même de calculer. Un outil qui écrit ce que son propre tableau déclare
  invalide mine la confiance qu'on met dans tout le reste.
- La remise à jour a lieu **à chaque synchronisation**, et non plus seulement à
  l'installation : personne ne devine qu'il faudrait réinstaller après une
  mise à jour de code. La validation est relue avant d'être reposée, donc
  l'écriture n'a lieu qu'une fois.

### Modifié

- Le faux classeur du banc sait relire une validation, et rend `null` là où
  aucune règle n'a été posée — comme le vrai.
- Le banc passe à **213 assertions**, l'épreuve à **trente-huit défauts**.

## [0.10.0] - 2026-09-18

**Un créneau fermé par la marge le dit.** Trouvé à l'usage, et le défaut était
dans ce que le tableau donnait à lire, pas dans ce qu'il calculait.

### Ajouté

- **L'état « Complet par la marge »**, distinct de « Complet ». Un créneau que
  la marge a fermé affiche encore des places restantes : « Restant 1 » en face
  de « Complet » se lit comme une contradiction, et envoie chercher un défaut
  de calcul là où le calcul est juste. Constaté en conditions réelles le
  18 septembre 2026, sur trois créneaux à la fois.
- **Le résumé du recomptage compte les créneaux fermés par la marge** et le
  dit en toutes lettres : « c'est ce que la marge sert à faire ».
- **La note de la colonne « Restant »** explique le cas, là où on le lit.

### Inchangé

- Le calcul. `pris + marge >= places` ferme le créneau, comme avant : c'est
  l'affichage qui n'en rendait pas compte. Un créneau dont toutes les places
  sont prises dit toujours « Complet », marge ou non.
- La couleur des deux états est la même — celle de ce qui est fini : le mot
  les distingue, la teinte dit qu'il n'y a rien à faire ni dans un cas ni dans
  l'autre.

### Modifié

- Le banc passe à **213 assertions**, l'épreuve à **trente-sept défauts**.

## [0.9.0] - 2026-09-18

**Premier défaut du produit trouvé en conditions réelles**, et il touchait ce
qui fait la valeur de l'outil.

### Corrigé

- **Une soumission qui n'obtenait pas le verrou abandonnait en silence.** Le
  commentaire d'alors affirmait que l'exécution tenant le verrou recompterait
  cette ligne : c'est vrai du comptage, et faux du verdict — elle avait déjà lu
  la feuille. La réponse ne recevait donc ni ligne au Journal, ni courriel, et
  une personne en dépassement pouvait croire avoir une place. C'est exactement
  ce que le code appelle ailleurs « le seul défaut vraiment coûteux de ce
  montage ». Vu le 18 septembre 2026 : « Soumission ligne 10 : Une exécution
  est déjà en cours sur ce document. »

### Modifié

- **Une soumission attend désormais le verrou** vingt-cinq secondes — un
  traitement en dure quelques-unes — au lieu de rendre la main aussitôt. Le
  déclencheur n'emprunte plus `SocleExecution.sousVerrou`, qui pose
  `tryLock(0)` : pour une entrée de menu, abandonner est juste puisque
  quelqu'un est devant l'écran et relancera ; pour une soumission, c'est une
  perte sèche. Les entrées de menu continuent de passer par le socle.
- **L'abandon se consigne** au Journal, verdict « Non traitée » en rouge, avec
  ce qu'il reste à faire à la main et une alerte à l'exploitant.
- Le banc passe à **213 assertions**, l'épreuve à **trente-six défauts** :
  deux assertions validaient l'ancien comportement, c'est-à-dire le défaut.

## [0.8.2] - 2026-09-18

**La fermeture automatique est vérifiée**, et elle apprend quelque chose sur le
risque que cet outil combat. Le code ne change pas.

### Vérifié

- **Le formulaire se ferme tout seul quand tous les créneaux sont complets**,
  avec son message de clôture. Constaté en conditions réelles.

### Su et dit

- **Quand tout est complet, le risque de surréservation disparaît.** Un
  formulaire fermé refuse toutes les réponses, y compris celles des pages
  restées ouvertes : la fermeture est une protection totale, là où le retrait
  d'une option n'en est pas une. La surréservation n'est donc possible que
  dans la situation intermédiaire — certains créneaux pleins, d'autres encore
  ouverts —, et c'est exactement là que la marge sert.
- Corollaire pour l'essai : éprouver la surréservation demande de garder au
  moins un créneau ouvert, sans quoi il n'y a plus rien à observer.
- Le banc reste à **213 assertions** et l'épreuve à **trente-cinq défauts**.

## [0.8.1] - 2026-09-18

**Le déclencheur est vérifié.** Le code ne change pas ; ce qui change, c'est
ce qu'on en sait.

### Vérifié

- **Le déclencheur de soumission part bien après l'écriture de la ligne.** De
  vraies réponses ont alimenté le Journal toutes seules, avec le bon créneau et
  le bon rang — `forSpreadsheet` plutôt que `forForm` était le bon choix. Le
  dernier point technique ouvert depuis la première version est refermé.
- **Le Journal est le témoin exclusif du déclencheur.** `limiteurSynchroniser_`
  — ce que lance le menu — n'y écrit jamais : un Journal vide alors que les
  créneaux se retirent correctement signifie que rien ne se fait tout seul, et
  que quelqu'un lance la synchronisation à la main. Sans cette asymétrie, les
  deux situations seraient indiscernables.

### Su et dit

- **La fenêtre de surréservation reste inconnue** : c'est le seul point encore
  ouvert, et il ne se mesure qu'avec deux fenêtres de navigateur.
- Les réponses antérieures à l'installation ne figurent pas au Journal — le
  déclencheur n'existait pas quand elles sont arrivées. Elles sont comptées
  malgré tout : le comptage lit la feuille, pas le Journal.
- Le banc reste à **213 assertions** et l'épreuve à **trente-cinq défauts**.

## [0.8.0] - 2026-09-18

**Éprouvée en conditions réelles.** Dix hypothèses confirmées, **aucune
démentie**. Le code ne change pas — ce qui change, c'est ce qu'on en sait.

### Vérifié

- **`setChoiceValues` efface bien la navigation par section.** C'est
  l'hypothèse qui portait le plus de code depuis la première version, et la
  seule qui pouvait rendre un refus injustifié. Elle tient : refuser de
  piloter une question à sauts de section ne prive personne d'un usage
  légitime, et empêche un dégât qui ne se verrait qu'aux premiers répondants
  égarés.
- **Une question à choix refuse une liste d'options vide**, donc fermer le
  formulaire est la seule issue quand tout est complet.
- **`getFormUrl()` rend `null`** sur une feuille non liée — c'est ce qui
  permet de trouver la feuille des réponses sans dépendre de son nom.
- **Une chaîne ISO écrite en cellule ressort en objet `Date`** : la fondation
  de `SocleDates`, jamais vérifiée jusqu'ici ailleurs que dans un CLAUDE.md.
- Et le fuseau, `asListItem()` sur un mauvais type, `hasOtherOption` absent
  d'une liste, `FormApp.ItemType`, `FormApp.PageNavigationType`, le quota.

### Ajouté

- **Un protocole d'essai à la main**, dans le LISEZMOI du dossier d'essai, avec
  sa feuille de relevé. Le contrôle automatique ne dit rien de l'outil vu par
  quelqu'un qui s'en sert, et il ne peut pas produire une course entre deux
  personnes. Son étape 1 — garder un formulaire ouvert dans une fenêtre privée
  pendant qu'on remplit le créneau ailleurs — mesure d'un coup les deux points
  que l'API ne permet pas d'atteindre : la fenêtre de surréservation, et le
  fait que le déclencheur voie bien la ligne écrite.

### Su et dit

- **Le déclencheur reste non mesuré, et la cause est identifiée** : un
  formulaire qui collecte les adresses refuse les réponses construites par
  script. La mesure demande une soumission à la main — le contrôle le dit
  désormais en toutes lettres plutôt que de rapporter une exception muette.
- **La largeur de la fenêtre de surréservation** reste inconnue. C'est elle
  qui déterminera la marge à recommander par défaut, et elle ne se mesure
  qu'avec deux fenêtres de navigateur.
- Le banc reste à **213 assertions** et l'épreuve à **trente-cinq défauts** :
  rien du produit n'a eu besoin d'être corrigé.
## [0.7.2] - 2026-09-18

Deuxième lancement réel. Le rapport est devenu honnête — il dit « non mesuré »
au lieu de « démenti » —, mais **l’hypothèse centrale reste non vérifiée** et
la même exception revient. Deux causes probables traitées, et de quoi savoir
d’où elle vient si elle persiste.

### Corrigé

- **Tous les choix d’une question à navigation doivent porter une**
  **destination**, pas seulement celui qui saute. Un seul choix navigant sur
  deux donne « Invalid data updating form. » — la règle a été payée après
  l’ordre des éléments, sur la même exception.
- **Le contrôle du déclencheur nomme l’étape où il échoue.** « Invalid data
  updating form. » ne dit pas d’où il vient, et un message sans lieu envoie
  chercher partout. Il signale aussi qu’un formulaire collectant les adresses
  refuse les réponses construites par l’API, et dit alors comment faire la même
  mesure à la main.

### Ajouté

- **La vérification de `FormApp.PageNavigationType`.** Une énumération se
  vérifie, elle ne se cite pas de mémoire : un nom inventé vaut `undefined` et
  fait échouer l’appel sans dire pourquoi. Le contrôle de navigation refuse
  désormais de partir si `CONTINUE` manque, plutôt que de lever une exception
  muette de plus.

### Su et dit

- **`setChoiceValues` contre la navigation par section : toujours pas de**
  **réponse.** Deux essais, deux échecs de construction du cas — aucun n’a
  encore mesuré quoi que ce soit. Le refus que porte le produit depuis la
  première version reste une hypothèse.
- Le banc reste à **213 assertions** et l’épreuve à **trente-cinq défauts** :
  les corrections sont dans le contrôle, que le banc ne charge pas — hors
  `controleCas_`, qui l’est depuis la 0.7.1.

## [0.7.1] - 2026-09-18

**Premier lancement réel dans Apps Script**, et il a trouvé quatre défauts — tous
dans le contrôle, aucun dans le produit. Le produit lui-même n'a toujours pas été
essayé à la main.

### Corrigé

- **Une exception n'est plus prise pour un démenti.** Le contrôle rapportait
  « DÉMENTI » pour l'hypothèse la plus importante du projet alors qu'il n'avait
  rien mesuré : l'appel avait levé. Trois états désormais — confirmé, démenti,
  **non mesuré** —, soit exactement la distinction que le diagnostic du produit
  impose depuis la 0.4.0, et que son auteur avait oubliée dans son propre outil.
- **Le contrôle de la navigation par section créait un formulaire invalide.** La
  question était posée après le saut de page, donc sur la seconde page, et
  naviguait vers elle-même ; Google répond « Invalid data updating form. »
  L'hypothèse reste **non vérifiée** : c'est le prochain essai qui la tranchera.
- **L'échec du contrôle du déclencheur disait « le contrôle a échoué »** sans
  dire pourquoi — `SocleErreurs.absorber` compte la cause mais en perd le
  message. Il remonte désormais en toutes lettres.
- **Le contrôle ne supprime plus les formulaires qu'il crée.** `DriveApp` exige
  la portée `drive` entière ; `drive.file` ne lui suffit pas, ce qu'un premier
  essai a appris en se faisant refuser quatre suppressions. Réclamer l'accès au
  Drive complet pour un outil d'essai serait hors de proportion : le rapport
  donne les liens, et l'on jette d'un clic.

### Confirmé en conditions réelles

Huit hypothèses tenaient, dont trois que le banc ne faisait que simuler : **une
chaîne ISO écrite en cellule ressort bien en objet `Date`** — l'hypothèse
fondatrice de `SocleDates` —, **une question à choix refuse une liste vide**, et
**`getFormUrl()` rend `null`** sur une feuille non liée. Le fuseau du script
valait celui du classeur, ce qui n'allait pas de soi.

### Modifié

- Le manifeste d'essai demande exactement les portées du produit, `drive.file`
  en moins.
- **`controleCas_` est désormais éprouvée au banc** : c’est la seule partie du
  contrôle qui se teste hors de Google, et c’est celle qui s’était trompée. Le
  banc passe à **213 assertions**, l’épreuve à **trente-cinq défauts**.

## [0.7.0] - 2026-09-18

De quoi enfin essayer pour de vrai. **Toujours jamais installée en vrai** — mais
plus par manque d'outillage.

### Ajouté

- **`outils/preparer-essai.js`**, qui engendre `../limiteur-essai/` : les
  fichiers à plat, un manifeste d'essai, un `.claspignore` en liste blanche et
  un LISEZMOI qui prend par la main. Le dossier est engendré **à côté** du dépôt
  — clasp remonte les parents pour trouver un `.clasp.json` — et `.clasp.json`
  survit à la régénération, faute de quoi le lien vers le classeur serait perdu.
- **`outils/Controle.gs`**, qui éprouve dans Google ce que le banc ne peut que
  supposer : les trois hypothèses portant du code de refus depuis la première
  version — `setChoiceValues` contre la navigation par section, le refus d'une
  liste d'options vide, le déclencheur qui part après l'écriture de la ligne —
  plus le fuseau, l'aller-retour d'une date par une cellule, et les énumérations.
  Il jette les formulaires qu'il crée et n'envoie aucun courriel.
- **`preparerLeFormulaireDEssai`**, engendré dans le dossier d'essai : crée un
  formulaire à trois créneaux et le lie au classeur. `clasp create --type sheets`
  ne donne qu'un classeur vide, et le limiteur n'a alors rien à piloter.

### Décidé

- **Les deux fonctions d'essai vivent au menu d'exécution, pas au menu du
  classeur.** Y ajouter une entrée aurait demandé de modifier `Menu.gs`, donc
  d'éprouver autre chose que ce qui est livré.
- **Le préparateur refuse de livrer** un dossier dont la syntaxe concaténée ne
  passe pas, qui déclare deux fois un nom global, ou qui porte deux `onOpen` —
  la faute qu'on ferait en ajoutant une entrée de menu d'essai. Les trois gardes
  ont été éprouvées en introduisant les fautes.
- **Le manifeste d'essai demande `drive.file`** pour jeter les formulaires du
  contrôle. Restreinte aux fichiers créés par ce script, elle n'entre pas dans
  le manifeste du produit.

### Modifié

- Le banc vérifie que **chaque nom du produit cité par `outils/Controle.gs` est
  déclaré** : ce fichier ne tourne que dans Google, et renommer une fonction le
  casserait sans que rien ne le dise — jusqu'à l'essai réel, c'est-à-dire au
  pire moment.
- Le banc passe de 186 à **213 assertions**, l'épreuve de trente-trois à
  **trente-quatre défauts**.

## [0.6.0] - 2026-09-18

Couleurs et notes. **Toujours jamais installée en vrai.**

### Ajouté

- **Les quatre onglets d'état sont colorés**, et la même couleur veut dire la
  même chose dans les quatre. Un rouge qui voudrait dire « complet » ici et
  « en panne » là se lit moins vite qu'une absence de couleur : il faut d'abord
  se rappeler où l'on est.
- **Des notes sur les en-têtes**, visibles au survol : ce que veut dire une
  cellule « Places » vide, ce que fait exactement la « Marge », ce que le code
  ne défera jamais dans « État ». L'onglet « Aide » explique l'outil, les notes
  expliquent la colonne qu'on a sous le curseur.

### Décidé

- **Cinq sens, pas trois.** Le gris (« c'est fini ») et le bleu (« on ne sait
  pas ») font la différence : « Complet » est le fonctionnement normal et non
  une anomalie, « Non mesuré » est une ignorance avouée et non un demi-bon. Les
  peindre en orange les ferait traiter comme des défauts, et on cesserait de
  lire la colonne.
- **La couleur ne porte jamais l'information seule** : chaque cellule colorée
  contient déjà le mot, et la feuille se lit entière en noir et blanc.
- **L'habillage ne peut pas faire échouer l'outil.** Un onglet protégé le fait
  échouer lui, silencieusement mais comptablement, et le traitement continue :
  l'apparence ne doit pas empêcher un outil de fonctionner.
- Une règle de mise en forme posée sur une autre colonne survit ; sur la colonne
  pilotée, elle est remplacée. `setConditionalFormatRules` remplace toutes les
  règles de la feuille, on ne retire donc que les nôtres.

### Corrigé

- **Le banc vérifie que le projet se charge dans l'ordre alphabétique**, celui
  de l'éditeur Apps Script. Les tables de ce module nommaient des onglets
  déclarés ailleurs : évaluées au chargement, elles auraient fait échouer le
  projet ENTIER — toutes ses fonctions devenant introuvables d'un coup — puisque
  « Apparence » vient avant tout le reste. Elles sont devenues des fonctions,
  évaluées à l'appel.

### Modifié

- Le banc passe de 166 à **213 assertions**, l'épreuve de vingt-neuf à
  **trente-trois défauts**.

## [0.5.0] - 2026-09-18

Les listes par créneau. **Toujours jamais installée en vrai.**

### Ajouté

- **« Établir les listes »** (menu), et son onglet « Listes » : créneau par
  créneau et dans l'ordre d'arrivée, les personnes retenues puis celles en liste
  d'attente, avec leur rang, leur heure d'inscription et leurs réponses. C'est
  ce qui manquait le jour de la visite — la feuille des réponses mêle tous les
  créneaux et les trie par horodatage.
- **Le réglage « Colonnes à reprendre dans les listes »**. Vide, toutes les
  colonnes de réponse sont reprises sauf l'horodatage et le créneau : on ne sait
  pas quelles questions le formulaire pose, et deviner laquelle porte l'identité
  reviendrait à en perdre une.

### Décidé

- **Personne ne disparaît.** Une réponse au créneau inconnu figure en fin de
  liste avec sa valeur brute et le statut « Hors référentiel ». Quelqu'un
  d'inscrit qui n'apparaîtrait sur aucune liste ne se découvrirait que le jour J,
  devant la personne.
- **Un créneau sans inscription figure aussi**, avec « Aucune inscription » :
  son absence se lirait « je ne sais pas s'il existe », et une absence ne doit
  jamais avoir deux sens.
- **Une capacité non renseignée ne dit pas « Retenue »** mais « Capacité non
  définie » : on ne le sait pas.
- **Le formulaire n'est pas ouvert** quand le réglage nomme déjà la colonne des
  créneaux : le jour de la visite, il peut avoir été supprimé, et les listes
  doivent rester établissables.

### Modifié

- Le banc passe de 149 à **213 assertions**, l'épreuve de vingt-cinq à
  **vingt-neuf défauts**. La table des nombres du contrôle K va désormais
  jusqu'à quarante, pour cesser de l'étendre à chaque ajout.

## [0.4.0] - 2026-09-18

Un diagnostic d'installation. **Toujours jamais installée en vrai.**

### Ajouté

- **« Vérifier mon installation »** (menu), et son onglet « Vérification ». Une
  quinzaine de contrôles qui ne se découvraient jusqu'alors qu'à la première
  soumission, donc devant un vrai répondant : déclencheur absent ou posé deux
  fois, confirmation activée sans adresses collectées, libellé modifié d'un seul
  côté, réponse comptée nulle part, quota d'envoi presque épuisé, feuille des
  réponses triée — le tri déplace les rangs, donc la frontière entre les
  personnes retenues et la liste d'attente.
- **La détection d'une marge qui annule son créneau.** Une marge supérieure ou
  égale à la capacité rend le créneau complet dès zéro inscription : il
  disparaît du formulaire sans que personne n'ait jamais pu le choisir, et rien
  n'a l'air cassé.

### Décidé

- **« Non mesuré » n'est pas « Bon ».** Un contrôle qui n'a pas pu s'exécuter le
  dit, avec sa raison, et le résumé les énumère à part. Si le formulaire est
  injoignable, on ne sait rien de sa question ni de ses libellés : les annoncer
  bons serait le mensonge le plus coûteux qui soit, celui qui rassure.
- **Et « Non mesuré » n'est pas « rien trouvé » non plus.** Sans aucune réponse
  enregistrée, l'ordre d'arrivée est « Bon » : on a pu regarder, il n'y avait
  rien à redire. La distinction porte sur ce qu'on a pu vérifier, jamais sur la
  quantité trouvée — deux assertions du banc la fixent, parce qu'elle est trop
  subtile pour rester implicite.
- **Un référentiel vide est « À vérifier », pas « Bon ».** Zéro créneau n'est
  pas « tous ont une capacité ».
- Le diagnostic ne modifie rien hors son propre onglet, et le banc le vérifie :
  ni le formulaire, ni ses options, ni même une révision.

### Modifié

- Le banc passe de 119 à **213 assertions**, l'épreuve de vingt et un à
  **vingt-cinq défauts**.

## [0.3.1] - 2026-09-18

Correction d'un défaut : le déclencheur n'avait aucun filet. **Toujours jamais
installée en vrai.**

### Corrigé

- **Le déclencheur de soumission ne peut plus mourir.** Il n'y avait aucun
  `try/catch` dans le projet : un saut de section ajouté au formulaire, une
  question renommée ou une colonne calculée déplacée arrêtait le limiteur pour
  de bon. Les créneaux complets restaient alors affichés, soumission après
  soumission, sans que rien dans le classeur ne le dise — la panne la plus
  coûteuse de cet outil, parce qu'elle ressemble à un fonctionnement normal.

### Ajouté

- **Un verdict « Échec » au Journal**, et une colonne *Ce qui a échoué* qui porte
  le remède plutôt que la trace technique. Tous les refus du projet en portent
  un, le banc l'impose : il suffisait de le transmettre.
- **Une alerte, agrégée par cause.** Au destinataire réglé, ou à défaut à la
  personne qui a posé le déclencheur — il s'exécute sous son identité, et sans
  cela l'échec resterait muet, c'est-à-dire exactement ce que ce filet existe
  pour empêcher. Une campagne qui échoue à chaque soumission produit une alerte,
  pas trois cents.

### Décidé

- **L'erreur n'est pas relevée**, pour ne pas déclencher en doublon le courriel
  technique de Google. Elle part dans le journal d'exécution, où un
  administrateur la cherchera : la trace existe, à l'endroit où elle sert.
- **Un verrou occupé n'est pas un échec** et ne signale rien : l'exécution qui
  le détient recomptera tout, cette soumission comprise.
- Le filet enveloppe le verrou, et non l'inverse : un contexte sans verrou
  disponible doit lui aussi être signalé plutôt que de tout arrêter.

### Modifié

- Le banc passe de 101 à **213 assertions**, l'épreuve de dix-sept à **vingt et
  un défauts**. Le faux classeur sait désormais refuser une écriture sur un
  onglet protégé, ce que le vrai fait et qu'il ne savait pas simuler.

## [0.3.0] - 2026-09-18

Un cas exemple, pour qui découvre l'outil. **Toujours jamais installée en vrai.**

### Ajouté

- **Un cas exemple jouable** (menu *Voir un exemple*), qui déroule en six étapes
  ce qu'aucun texte ne fait comprendre : une inscription acceptée au-delà de la
  capacité, quelqu'un qui quitte la liste d'attente sans que personne n'agisse,
  et le formulaire qui se ferme de lui-même.
- **Il calcule au lieu de raconter** : la démonstration appelle les mêmes
  fonctions de décision que la vraie synchronisation, sur ses propres onglets.
  Le banc vérifie que ce qu'elle affiche est bien ce que la synchronisation rend
  sur les mêmes données — sans quoi elle serait juste le jour de son écriture et
  fausse à la modification suivante, sans que rien ne le signale.
- **Elle ne touche à rien** : trois onglets préfixés « Démo — », aucun accès au
  formulaire ni à la feuille des réponses, donc lançable sur une campagne en
  cours. *Retirer l'exemple* efface ces trois onglets, et le banc vérifie qu'il
  n'en efface pas un de plus.

### Modifié

- `limiteurLireReferentiel_` accepte le nom de l'onglet à lire, pour que la
  démonstration passe par le vrai code plutôt que par une copie.
- Le banc passe de 81 à **213 assertions**, l'épreuve de quinze à **dix-sept
  défauts**.

## [0.2.0] - 2026-09-18

Outillage seul : **aucun changement de comportement** dans Apps Script, le code
des onglets et du formulaire est identique à la 0.1.0. Toujours **jamais
installée en vrai**.

### Ajouté

- **Le banc vérifie ses propres chiffres** (section K). Le nombre d'assertions
  et le nombre de défauts de l'épreuve vivaient à quatre endroits — les deux
  versions du README, le CHANGELOG et le banc — sans que rien ne les tienne
  ensemble : ajouter une assertion rendait trois textes faux, en silence. Le
  contrôle du total se compte lui-même, faute de pouvoir connaître le total
  avant d'avoir fini de compter.
- **L'épreuve porte sur tout le projet**, et non plus sur `apps-script/` seul :
  ses deux derniers défauts sont dans la documentation, qui est désormais tenue
  au même titre que le code.

### Modifié

- Le banc passe de 74 à **213 assertions**, l'épreuve de treize à **quinze
  défauts**.
- Du CHANGELOG, le banc ne lit que l'entrée la plus récente : une entrée ancienne
  dit ce qu'était cette version-là, et l'aligner sur l'état courant reviendrait à
  la falsifier.

## [0.1.0] - 2026-09-18

Première version. Éprouvée au banc, **jamais installée en vrai**.

### Ajouté

- **Le retrait et la remise des créneaux complets.** Le référentiel garde la
  liste et son ordre ; le formulaire en est reconstruit à chaque
  synchronisation. C'est ce qui rend une place libérée récupérable : une option
  retirée d'un formulaire n'y existe plus du tout, et le formulaire seul aurait
  oublié quel libellé remettre, et à quelle place.
- **Le verdict rendu à la réception.** Chaque réponse reçoit un rang dans son
  créneau, et ce rang décide. Une inscription au-delà de la capacité est nommée
  « Surréservation », inscrite au journal, et la personne est prévenue qu'elle
  est en liste d'attente — plutôt que laissée à croire qu'elle a une place.
- **La marge**, qui retire l'option avant la dernière place. Elle ne s'applique
  pas au verdict : refuser la place qu'elle réserve la perdrait pour tout le
  monde.
- **La fermeture du formulaire quand tout est complet**, faute de pouvoir vider
  une question à choix — Google le refuse — et sa réouverture automatique dès
  qu'une place se libère.
- **Le comptage sur la feuille des réponses**, et non sur `form.getResponses()`.
  Supprimer la ligne d'une personne qui se décommande rend sa place.
- **Les onglets « Créneaux », « Journal », « Réglages » et « Aide ».** L'aide
  vit dans le classeur : un outil s'explique là où l'on s'en sert.
- **Un banc d'essai de 74 assertions**, hors de Google.
- **Une épreuve du banc** (`banc/epreuve.js`) qui réintroduit treize défauts
  réels dans une copie du projet et vérifie que le banc échoue sur chacun. Les
  treize sont attrapés. Ajouter une règle au code impose d'y ajouter son défaut.

### Refusé, délibérément

- **Les questions dont une option commande un saut de section.** Reposer la
  liste effacerait la navigation, et le dégât ne se verrait qu'aux premiers
  répondants égarés.
- **Les grilles**, et les formulaires à plusieurs questions de créneaux : le
  comptage y change de sens.
- **Les libellés à virgule dans une question à cases à cocher.** Google sépare
  les choix multiples par une virgule ; le comptage serait faux sans que rien
  ne le signale.
- **Toute réouverture d'un formulaire fermé par une personne**, et tout
  créneau marqué « Fermé à la main ». Une décision humaine ne se défait pas.
- **Toute capacité devinée.** Une colonne « Places » vide veut dire « non
  décidé », jamais « zéro » : le créneau reste proposé.

### Su et dit

- Le retrait d'une option **n'empêche pas** une inscription de trop : le
  formulaire déjà ouvert dans un navigateur affiche encore l'ancienne liste, et
  Google accepte sa soumission sans qu'aucune API puisse la refuser. C'est la
  raison d'être du verdict et de la marge.
- La portée `forms` est large — Google n'en propose pas de version restreinte au
  seul formulaire lié. Le banc vérifie sur le code source que le projet n'ouvre
  qu'un formulaire, celui que désigne la feuille des réponses.
- Une feuille de réponses est lue en entier à chaque soumission.
