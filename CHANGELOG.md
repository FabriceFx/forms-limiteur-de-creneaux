# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

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
- Le banc passe de 186 à **187 assertions**, l'épreuve de trente-trois à
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

- Le banc passe de 166 à **187 assertions**, l'épreuve de vingt-neuf à
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

- Le banc passe de 149 à **187 assertions**, l'épreuve de vingt-cinq à
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

- Le banc passe de 119 à **187 assertions**, l'épreuve de vingt et un à
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

- Le banc passe de 101 à **187 assertions**, l'épreuve de dix-sept à **vingt et
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
- Le banc passe de 81 à **187 assertions**, l'épreuve de quinze à **dix-sept
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

- Le banc passe de 74 à **187 assertions**, l'épreuve de treize à **quinze
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
