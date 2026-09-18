<!-- SPDX-License-Identifier: Elastic-2.0 -->

<a id="francais"></a>

# Limiteur de créneaux

📖 Français (ci-dessous) · [🇬🇧 English version](#english)

Retire d'un formulaire Google les créneaux dont toutes les places sont prises,
et les remet quand une place se libère.

Écrit pour les inscriptions à places comptées : visites, permanences, ateliers,
entretiens. Google Forms sait fermer un formulaire après un nombre total de
réponses — c'est une nouveauté de janvier 2026 — mais ne sait pas plafonner
chaque option séparément.

## La règle qui gouverne tout

**Retirer une option du formulaire est un confort d'affichage. Ce n'est pas une
garantie, et rien ne peut en faire une.**

Le formulaire qu'une personne a sous les yeux est une page chargée il y a dix
minutes. Modifier le formulaire côté serveur ne modifie pas cette page : elle
affiche encore le créneau complet, la personne le coche, l'envoie — et Google
l'accepte. Aucune API ne permet de refuser une soumission en cours.

Le déclencheur ajoute son propre retard, puisqu'il part *après* l'enregistrement
de la réponse. Entre la dernière place prise et le retrait de l'option, la
fenêtre est réelle et se compte en secondes.

D'où la conception : **la vérité se constate à la réception, pas à
l'affichage.** Chaque réponse reçoit un rang dans son créneau, et ce rang décide.
Une inscription au-delà de la capacité n'est ni refusée ni perdue : elle est
nommée « Surréservation », inscrite au journal, et la personne est prévenue
qu'elle est en liste d'attente. Un outil qui laisserait quelqu'un croire qu'il a
une place qu'il n'a pas serait pire qu'un outil absent.

Deux parades, et il faut les deux :

- la **marge**, qui retire l'option avant la dernière place — à 1, le créneau
  disparaît du formulaire alors qu'il reste encore une place en réserve ;
- le **verdict**, qui dit la vérité même quand l'affichage a menti.

### Quand tout est complet, le risque disparaît

Nuance apprise à l'essai, et elle est rassurante : lorsque **tous** les créneaux
sont pleins, le formulaire se ferme — et une page restée ouverte ne peut alors
plus rien envoyer du tout. La fermeture est une protection totale, là où le
retrait d'une option n'en est pas une.

La surréservation n'est donc possible que dans la situation intermédiaire :
certains créneaux complets, d'autres encore ouverts, donc un formulaire qui
accepte toujours des réponses. C'est exactement là que la marge sert, et nulle
part ailleurs.

Corollaire pour qui veut l'éprouver : il faut garder au moins un créneau ouvert,
sans quoi le formulaire se ferme et il n'y a plus rien à observer.

## Le référentiel fait foi, le formulaire n'en est que le reflet

Une option retirée d'un formulaire n'y existe plus du tout. Si la liste des
créneaux ne vivait que là, une place libérée serait irrécupérable : on ne
saurait plus quel libellé remettre, ni à quelle position.

L'onglet « Créneaux » garde donc la liste complète et son ordre. Le formulaire
est reconstruit à partir de lui à chaque synchronisation. C'est ce qui rend
possible la remise en service — et c'est pourquoi l'ordre des lignes de cet
onglet est l'ordre d'affichage dans le formulaire.

Conséquence à connaître : une option ajoutée **à la main** dans le formulaire
serait effacée à la synchronisation suivante, puisqu'on repose exactement ce que
dit le référentiel. Elle est donc adoptée d'abord, avec une capacité vide, et
c'est une personne qui décide du nombre de places.

## Le comptage se fait sur la feuille des réponses, et c'est voulu

Compter sur `form.getResponses()` donnerait un total que personne ne pourrait
corriger sans passer par l'interface du formulaire. La feuille, elle, est
modifiable : **supprimer la ligne d'une personne qui se décommande rend sa
place**, et le créneau réapparaît à la synchronisation suivante.

Le rang vient du numéro de ligne, parce que le formulaire ajoute en bas. Ne
triez pas la feuille des réponses : cela déplace la frontière entre les
personnes retenues et celles en liste d'attente. Un filtre ne pose pas ce
problème.

## Ce que le module refuse de faire, et pourquoi

Un refus visible vaut mieux qu'un dégât silencieux. Chacun de ces messages dit
quoi faire ensuite.

| Situation | Raison du refus |
|---|---|
| Une option commande un saut de section | Reposer la liste effacerait la navigation. Le dégât ne se verrait qu'aux premiers répondants égarés. |
| Une grille (lignes × colonnes) | Le comptage y change de sens, et une personne y réserve plusieurs créneaux d'un coup. |
| Un libellé à virgule, dans une question à cases à cocher | Google sépare les choix multiples par une virgule : le comptage serait faux, sans que rien ne le signale. |
| Deux questions à choix, et pas de réglage | Deviner reviendrait à retirer des options de la mauvaise question. Les titres sont listés dans le message. |
| Deux formulaires liés au même classeur | Le module n'en pilote qu'un ; en choisir un au hasard serait pire. |
| Les colonnes calculées séparées à la main | L'écriture en bloc écraserait une colonne voisine. |

Une réponse dont le libellé ne correspond à aucun créneau connu n'est **pas**
ignorée : elle est comptée nulle part, et cela est dit. Ce cas vient presque
toujours d'un libellé modifié d'un seul côté.

Une colonne « Places » vide veut dire « non décidé », jamais « zéro » : le
créneau reste proposé et n'est jamais retiré. Le code ne devine pas une capacité
que personne n'a fixée.

## Quand tout est complet

Une question à choix ne peut pas rester sans aucune option — Google le refuse.
Quand le dernier créneau part, le formulaire est donc **fermé**, avec un message
qui dit pourquoi.

Il se rouvre de lui-même dès qu'une place se libère, mais **seulement s'il a été
fermé par l'outil**. Un formulaire que quelqu'un a fermé l'a été pour une raison
qui n'appartient pas au code, et une réouverture automatique la défairait. Le
même principe vaut pour un créneau marqué « Fermé à la main ».

## Se lire d'un coup d'œil

Les quatre onglets qui portent un état — « Créneaux », « Journal »,
« Vérification », « Listes » — sont colorés, et **la même couleur veut dire la
même chose partout**. Cinq sens, pas trois :

| | |
|---|---|
| vert | c'est bon, rien à faire |
| gris | c'est fini, il n'y a plus rien à faire |
| bleu | on ne sait pas, et c'est dit |
| orange | il y a quelque chose à traiter |
| rouge | il faut agir, quelqu'un ou quelque chose est en défaut |

Le gris et le bleu font la différence avec un simple vert-orange-rouge.
« Complet » n'est pas un problème : c'est le fonctionnement normal, donc gris.
« Non mesuré » n'est pas un demi-bon : c'est une ignorance avouée, donc bleu.
Les peindre en orange les ferait traiter comme des anomalies, et on cesserait de
lire la colonne.

La couleur ne porte jamais l'information seule — chaque cellule colorée contient
déjà le mot. Elle accélère une lecture qui reste entière en noir et blanc.

Une règle de mise en forme que vous poseriez sur une **autre** colonne survit à
l'habillage ; sur la colonne pilotée, elle serait remplacée au prochain passage.

### Les colonnes s'expliquent là où on les lit

Chaque en-tête dont le sens n'est pas évident porte une note, visible au survol :
ce que veut dire une cellule « Places » vide, ce que fait exactement la
« Marge », ce que le code ne défera jamais dans la colonne « État », pourquoi
« Non mesuré » n'est pas « Bon ».

L'onglet « Aide » explique l'outil ; les notes expliquent la colonne qu'on a sous
le curseur. Un expert privé d'explication reconstruit un raisonnement
approximatif, et décide sur cette approximation.

## Les listes qu'on emporte

Menu **Créneaux > Établir les listes**. L'onglet « Listes » donne, créneau par
créneau et dans l'ordre d'arrivée, les personnes retenues puis celles en liste
d'attente — avec leur rang, leur heure d'inscription et les réponses qu'elles
ont données.

C'est ce qui manquait le jour de la visite : la feuille des réponses mêle tous
les créneaux et les trie par horodatage, donc il fallait filtrer à la main.

Par défaut, **toutes** les colonnes de réponse sont reprises, sauf l'horodatage
et le créneau qui ont déjà leur place. On ne sait pas quelles questions votre
formulaire pose, et deviner laquelle porte l'identité reviendrait à en perdre
une. Le réglage *Colonnes à reprendre dans les listes* permet de restreindre et
d'ordonner.

### Personne ne disparaît

Une réponse dont le libellé ne correspond à aucun créneau connu figure quand
même, en fin de liste, avec sa valeur brute et le statut « Hors référentiel ».
Quelqu'un d'inscrit qui n'apparaîtrait sur aucune liste est le défaut le plus
coûteux que ce module puisse avoir : il ne se voit que le jour J, devant la
personne.

Un créneau sans aucune inscription figure lui aussi, avec « Aucune
inscription » — son absence se lirait « je ne sais pas s'il existe », et une
absence ne doit jamais avoir deux sens. Un créneau dont la capacité n'est pas
renseignée ne dit pas « Retenue » mais « Capacité non définie » : on ne le sait
pas.

Les listes se lisent, elles ne pilotent rien. Le formulaire n'est même pas
ouvert si le réglage *Colonne du créneau dans les réponses* est renseigné —
ainsi elles restent établissables le jour où le formulaire a été supprimé.

## Vérifier avant d'ouvrir les inscriptions

Menu **Créneaux > Vérifier mon installation**. Une quinzaine de contrôles, un
onglet « Vérification » où chaque ligne dit ce qui va, ce qui ne va pas, et quoi
faire. Rien n'est modifié : le diagnostic se lance sur une campagne en cours.

Tout ce qu'il contrôle ne se découvrait jusqu'alors qu'à la première soumission,
c'est-à-dire devant un vrai répondant : un déclencheur absent ou posé deux fois,
une confirmation activée sans que le formulaire collecte les adresses, un libellé
modifié d'un seul côté, une réponse comptée nulle part, un quota d'envoi presque
épuisé, une feuille de réponses triée — le tri déplace les rangs, donc la
frontière entre les personnes retenues et la liste d'attente.

Il attrape aussi un piège qu'on ne voit pas venir : **une marge supérieure ou
égale à la capacité** rend le créneau complet dès zéro inscription. Il disparaît
du formulaire sans que personne n'ait jamais pu le choisir, et rien n'a l'air
cassé.

### « Non mesuré » n'est pas « Bon »

Un contrôle qui n'a **pas pu** s'exécuter le dit. Si le formulaire est
injoignable, on ne sait rien de sa question, de sa navigation ni de ses
libellés : les annoncer bons serait le mensonge le plus coûteux qui soit, celui
qui rassure. Ces lignes affichent « Non mesuré » avec la raison, et le résumé
les énumère à part.

C'est à distinguer d'un contrôle qui a regardé et n'a rien trouvé à redire :
sans aucune réponse enregistrée, l'ordre d'arrivée est « Bon », parce qu'il n'y
avait rien à redire — et non « Non mesuré », qui voudrait dire qu'on n'a pas su
regarder.

## Quand quelque chose casse

Le déclencheur de soumission ne peut pas mourir : tout ce qu'il fait passe par
un filet.

Sans lui, une seule cause — un saut de section ajouté au formulaire, une
question renommée, une colonne calculée déplacée — arrête le limiteur pour de
bon. Google envoie au propriétaire un message technique qu'il lira ou non, et
les créneaux complets restent affichés, soumission après soumission, sans que
rien dans le classeur ne le dise. C'est la panne la plus coûteuse de cet outil,
parce qu'elle ressemble à un fonctionnement normal.

Avec le filet, un échec produit trois choses :

- une ligne au **Journal**, verdict « Échec », dont la colonne *Ce qui a échoué*
  porte le remède et non la trace technique ;
- une **alerte** au destinataire réglé — ou, à défaut, à la personne qui a posé
  le déclencheur, puisque c'est sous son identité qu'il s'exécute ;
- une entrée dans le **journal d'exécution** Apps Script, là où un
  administrateur la cherchera.

L'alerte est agrégée **par cause** : une campagne dont chaque soumission échoue
pour la même raison produit une alerte, pas trois cents. L'erreur n'est
volontairement pas relevée, pour ne pas déclencher en doublon le courriel
technique de Google — le nôtre dit quoi faire, pas seulement que ça a raté.

Un verrou déjà pris n'est pas un échec et ne signale rien : l'exécution qui le
détient recomptera tout, cette soumission comprise.

## Un cas exemple, pour comprendre sans rien risquer

Menu **Créneaux > Voir un exemple**. Trois onglets préfixés « Démo — » se posent
dans le classeur, et l'onglet « Démo — déroulé » raconte un cas complet en six
étapes : trois créneaux, sept places, des inscriptions, une de trop, deux
annulations, puis la fermeture du formulaire.

Chaque ligne dit ce qui arrive, ce que l'outil décide, ce que le formulaire
proposerait à cet instant — et **pourquoi**.

Trois choses ne se comprennent pas en les lisant, et l'exemple les montre :

- l'étape 3, où une inscription est acceptée **au-delà** de la capacité, parce
  que la personne avait la page ouverte avant le retrait de l'option ;
- l'étape 4, où elle passe de la liste d'attente à une vraie place **sans que
  personne n'agisse**, une annulation ayant décalé les rangs ;
- l'étape 6, où le formulaire se ferme de lui-même faute de pouvoir rester sans
  aucune option.

**La démonstration ne raconte pas, elle calcule.** Elle appelle les mêmes
fonctions de décision que celles qui pilotent votre formulaire, sur ses propres
onglets. Une démonstration qui recopierait la logique serait juste le jour où on
l'écrit et fausse à la modification suivante, sans que rien ne le signale — le
banc vérifie donc que ce qu'elle affiche est bien ce que la vraie
synchronisation rend sur les mêmes données.

Elle ne touche ni au formulaire, ni à la feuille des réponses, ni aux onglets de
production : elle peut se lancer sur une campagne en cours. **Créneaux > Retirer
l'exemple** efface les trois onglets, et rien d'autre.

## Installation

### Prérequis

- Un formulaire Google Forms contenant une question à choix unique, menu déroulant ou cases à cocher pour les créneaux.
- Un classeur Google Sheets lié recevant les réponses du formulaire.

### Étapes d'installation

1. Ouvrez le **classeur qui reçoit les réponses** du formulaire (dans le
   formulaire : onglet *Réponses* > *Afficher dans Sheets*).
2. *Extensions > Apps Script*, puis collez le contenu de `apps-script/`.
3. Lancez `installerLeLimiteur` une fois depuis l'éditeur, et acceptez les
   autorisations. Les onglets sont créés et le déclencheur posé.
4. Rechargez le classeur : le menu **Créneaux** apparaît.
5. Ouvrez l'onglet « Créneaux » et renseignez la colonne **Places**. Tant
   qu'elle est vide, le créneau n'est jamais retiré.

L'installation est rejouable : la relancer complète ce qui manque sans toucher
au reste.

Le déclencheur de soumission est **installable** — le `onFormSubmit` simple n'a
pas le droit de modifier un formulaire ni d'envoyer un courriel. Il s'exécute
donc sous l'identité de qui l'installe, ce qui est ici correct : c'est
l'organisateur qui arbitre les places, pas les répondants.

### Les portées demandées, et ce qu'elles coûtent

| Portée | Pourquoi |
|---|---|
| `spreadsheets.currentonly` | Les onglets de ce classeur, et rien d'autre. |
| `forms` | Ouvrir et modifier le formulaire lié. |
| `script.scriptapp` | Poser le déclencheur de soumission. |
| `script.container.ui` | Le menu et les messages. |
| `script.send_mail` | `MailApp`, qui ne sait qu'envoyer : aucune portée de lecture de la messagerie n'est demandée. |
| `userinfo.email` | Signer les alertes. |

**`forms` est large et il faut le dire :** Google ne propose pas d'équivalent
restreint au seul formulaire lié (`forms.currentonly` n'existe que pour un
script lié au formulaire lui-même, ce qui priverait le projet de son classeur).
Cette portée donne accès à tous les formulaires du compte.

La compensation est vérifiable plutôt que promise — le projet n'ouvre qu'un
formulaire, celui que désigne la feuille des réponses :

```bash
grep -nE "FormApp\.(open|create)" apps-script/*.gs
```

Une seule ligne doit apparaître, `FormApp.openByUrl` dans `Formulaire.gs`, et
son argument vient de `getFormUrl()`. Ni `openById`, ni identifiant en dur, ni
`FormApp.create`. **Le banc le vérifie sur le code source** : la promesse ne
tient pas à ma parole.

## Le banc

```bash
node banc/test.js
```

190 assertions, hors de Google. Les faux services refusent ce que les vrais
refusent : une question à choix sans aucune option, une conversion de type
impossible, une feuille liée à aucun formulaire, un envoi sans destinataire.

Le banc s'éprouve lui-même :

```bash
node banc/epreuve.js
```

Il réintroduit **trente-cinq défauts réels** dans une copie du projet — l'adoption des
options nouvelles supprimée, le refus de la navigation par section levé, la
réouverture rendue aveugle, la marge appliquée au verdict, le quota d'envoi plus
lu, un formulaire ouvert par identifiant — et vérifie que le banc échoue sur
chacun. Un banc qui reste vert sur un défaut ne prouve rien.

**Ajouter une règle au code, c'est ajouter son défaut à l'épreuve.**

Contrôle de chargement avant tout envoi, qui attrape les collisions de noms
globaux — deux fichiers déclarant la même constante empêchent le projet
**entier** de se charger :

```bash
cat apps-script/*.gs > /tmp/limiteur.js && node --check /tmp/limiteur.js
```

### Le classeur d'essai

```bash
node outils/preparer-essai.js
```

Engendre `../limiteur-essai/` — **à côté** du dépôt et non dedans : clasp
remonte les dossiers parents pour trouver un `.clasp.json`, et depuis un dossier
imbriqué il repousserait le projet du parent. Les fichiers y sont à plat, un
sous-dossier devenant un préfixe de nom dans l'éditeur.

Le dossier n'est versionné nulle part : il se réengendre d'une commande, et seul
le préparateur est suivi par git. Ce qui appartient à clasp — `.clasp.json` —
survit à la régénération, faute de quoi le lien vers le classeur serait perdu.

Puis, dans l'éditeur Apps Script du classeur créé, deux fonctions au **menu
d'exécution** : `preparerLeFormulaireDEssai`, qui crée un formulaire à trois
créneaux et le lie au classeur, et `controlerEnConditionsReelles`. Elles ne sont
pas au menu du classeur : y ajouter une entrée aurait demandé de modifier
`Menu.gs`, donc d'éprouver autre chose que ce qui est livré.

Le contrôle éprouve ce que le banc ne peut pas voir — au premier rang les trois
hypothèses qui portent du code de refus depuis la première version et n'ont
jamais été vérifiées ailleurs que dans la documentation de Google :

- **`setChoiceValues` efface-t-il la navigation par section ?** Si non, le refus
  de piloter une telle question est inutilement strict ;
- **une question à choix refuse-t-elle une liste vide ?** C'est pourquoi on
  ferme le formulaire au lieu de vider la question ;
- **le déclencheur part-il après l'écriture de la ligne ?** D'où
  `forSpreadsheet` plutôt que `forForm`. Ce dernier point reste une
  **indication et non une preuve** : un déclencheur lent ressemble à un
  déclencheur qui n'a pas vu la ligne.

Il vérifie aussi ce qu'un faux service ne peut que supposer : qu'une chaîne de
date ressorte en objet `Date`, que le fuseau du script vaille celui du classeur
— `clasp create` pose celui du compte —, que `getFormUrl()` rende `null` sur
une feuille non liée, et que les énumérations citées existent.

Il jette les formulaires qu'il crée et n'envoie aucun courriel. Le manifeste
d'essai demande une portée de plus, `drive.file`, restreinte aux fichiers créés
par ce script ; elle n'entre pas dans le manifeste du produit.

**Ce qui aura été démenti se reporte dans le banc** : un faux service qui valide
un code faux est pire qu'un faux service absent.

## Ce qui est vérifié, et ce qui ne l'est pas

Le projet a tourné dans Apps Script le 18 septembre 2026 : dix hypothèses
confirmées, **aucune démentie**.

Confirmé en conditions réelles, et ces trois-là portaient du code depuis la
première version :

- **`setChoiceValues` efface bien la navigation par section.** Le refus de
  piloter une telle question est donc justifié : il ne prive personne d'un usage
  légitime, il empêche un dégât qui ne se verrait qu'aux premiers répondants
  égarés ;
- **une question à choix refuse une liste d'options vide** — fermer le
  formulaire quand tout est complet est la seule issue ;
- **`getFormUrl()` rend `null`** sur une feuille non liée, ce qui permet de
  trouver la feuille des réponses sans dépendre de son nom.

Ainsi que ce qu'un faux service ne pouvait que supposer : une chaîne ISO écrite
en cellule ressort en objet `Date`, le fuseau du script vaut celui du classeur,
`asListItem()` lève sur un autre type, `hasOtherOption` n'existe pas sur une
liste, et les énumérations citées existent bien.

**Le déclencheur part bien après l'écriture de la ligne** — vérifié par de vraies
soumissions : le Journal s'est alimenté tout seul, avec le bon créneau et le bon
rang. `forSpreadsheet` plutôt que `forForm` était donc le bon choix. C'est aussi
ce qui fait du Journal le témoin exclusif du déclencheur : la synchronisation
lancée depuis le menu n'y écrit jamais, donc un Journal vide alors que tout
semble marcher signifie que rien ne se fait tout seul.

**Un seul point reste ouvert : la largeur réelle de la fenêtre de
surréservation**, qui déterminera la marge à recommander par défaut. Elle ne se
mesure qu'en gardant un formulaire ouvert dans une fenêtre privée pendant qu'on
remplit le créneau ailleurs — c'est l'étape 1 du protocole d'essai.

Non traité, et assumé : les grilles, et les formulaires à plusieurs questions de
créneaux. Les uns comme les autres demandent une autre façon de compter.

Une feuille de réponses très longue est lue en entier à chaque soumission. Pour
quelques centaines d'inscriptions c'est sans effet ; au-delà de quelques
milliers, il faudra compter autrement.

## Licence

Elastic License 2.0 — voir [LICENSE](LICENSE).  
Copyright Fabrice Faucheux (https://faucheux.bzh)

---

<a id="english"></a>

# Form slot limiter

🇬🇧 English (below) · [📖 Version française](#francais)

Removes booked-out time slots from a Google Form, and restores them when a spot is freed.

Written for limited-capacity signups: visits, office hours, workshops, interviews. Google Forms can close a form after a total response count (a feature introduced in January 2026), but cannot cap individual options independently.

## The governing principle

**Removing an option from the form is a display convenience. It is not a guarantee, and nothing can make it one.**

The form a user has open in their browser was loaded ten minutes ago. Modifying the form on the server side does not update that open page: it still shows the full slot, the user checks it, submits it — and Google accepts it. No API can reject an in-flight submission.

The trigger adds its own latency, firing *after* the response row is recorded. Between the last spot being taken and the option being removed, the race condition window is real and spans several seconds.

Hence the core architecture: **truth is determined upon receipt, not at display time.** Each response receives a rank within its chosen slot, and that rank governs. A signup beyond capacity is neither dropped nor lost: it is marked as "Surréservation" (Overbooked) in the audit sheet, and the person is informed that they are on the waiting list. A tool that leads someone to believe they have a confirmed spot when they do not would be worse than having no tool at all.

Two safeguards work together:

- the **margin**, which removes the option before the last spot is taken — with a margin of 1, the slot disappears from the form while one buffer spot remains;
- the **verdict**, which enforces reality even when the display lagged behind.

### When all slots are full, the risk disappears

A reassuring nuance learned through live testing: when **all** slots are full,
the form closes itself — and a page left open in a browser can no longer submit
anything at all. Form closure is a complete safeguard, whereas removing an
option is not.

Overbooking is therefore only possible in the intermediate situation: some
slots full, others still open, meaning the form still accepts submissions. This
is precisely where the margin comes into play, and nowhere else.

A corollary for testing: keep at least one slot open, otherwise the form closes
and there is nothing left to observe.

## The spreadsheet is the source of truth, the form is merely its reflection

An option removed from a form ceases to exist there. If the slot list lived only in the form, a freed spot could never be recovered: the script would no longer know which label to restore, nor in what position.

The "Créneaux" tab retains the full list and its order. The form question is rebuilt from this tab on every sync. This is what makes restoring options possible — and why the row order in this sheet defines the display order in the form.

Key consequence: any option added **manually** directly inside the form would be erased on the next sync, since the form is rebuilt from the sheet. New options are therefore adopted first with an empty capacity, leaving a human operator to decide on the number of spots.

## Counting runs on the response sheet, by design

Counting via `form.getResponses()` would yield an immutable tally that cannot be corrected without Form editor access. The spreadsheet, however, is editable: **deleting the row of someone who cancels frees their spot**, and the slot reappears upon the next sync.

Ranking follows row numbers, as forms append responses chronologically at the bottom. Do not sort the response sheet, as sorting shifts the boundary between accepted participants and the waiting list. Applying a filter view causes no such issue.

## Deliberate refusals, and why

A visible refusal is better than silent corruption. Every error message instructs what action to take.

| Situation | Reason for refusal |
|---|---|
| An option drives section branching ("Go to section") | Rebuilding the options would wipe out section navigation. The damage would only surface when respondents get lost. |
| A grid question (rows × columns) | Counting semantics change, and one person can book multiple slots at once. |
| A label containing a comma in a checkbox question | Google separates multiple choices with commas in the sheet: counting would be corrupted without any visible warning. |
| Multiple choice questions with no configuration set | Guessing could remove options from the wrong question. Candidate titles are listed in the error message. |
| Multiple forms linked to the same spreadsheet | The script controls only one; picking at random would be worse. |
| Calculated columns manually separated | Batch-writing would overwrite an adjacent column. |

A response whose label matches no known slot is **not** ignored: it is counted nowhere, and this is explicitly reported. This almost always indicates a label changed on one side only.

An empty "Places" (Capacity) cell means "undecided", never "zero": the slot remains open and is never removed. The script never guesses a capacity that no human set.

## When all slots are full

A choice question cannot have zero options — Google Forms rejects it. When the last slot is booked up, the form is **closed**, with a customizable message explaining why.

It automatically reopens as soon as a spot is freed, but **only if the form was closed by the tool**. A form manually closed by an administrator was closed for human reasons, and an automated reopening must never override that decision. The same rule applies to any slot marked "Fermé à la main" (Manually closed).

## Readable at a glance

The four sheets carrying a state — `Créneaux`, `Journal`, `Vérification`,
`Listes` — are colour-coded, and **the same colour means the same thing
everywhere**. Five meanings, not three: green (fine, nothing to do), grey (done,
nothing left to do), blue (unknown, and said so), orange (something to handle),
red (act — someone or something is at fault).

Grey and blue are what separates this from a plain green-amber-red. `Complet` is
not a problem, it is normal operation, hence grey. `Non mesuré` is not a
half-pass, it is an admitted gap, hence blue. Painting either orange would have
them treated as anomalies, and the column would stop being read. Colour never
carries the information alone — every coloured cell already holds the word, so
the sheet reads whole in black and white.

A conditional-format rule you set on **another** column survives; on the driven
column it is replaced on the next pass.

### Columns explain themselves where you read them

Every header whose meaning is not obvious carries a hover note: what an empty
`Places` cell means, what `Marge` actually does, what the code will never undo
in `État`, why `Non mesuré` is not `Bon`. The `Aide` sheet explains the tool;
notes explain the column under your cursor.

## Lists to take with you

**Créneaux > Établir les listes** writes a `Listes` sheet giving, slot by slot
and in arrival order, the people confirmed and then those on the waiting list —
with their rank, sign-up time and the answers they gave. The response sheet
mixes every slot and sorts by timestamp, so this used to be manual filtering.

By default **every** response column is carried over, except the timestamp and
the slot, which already have their place: we do not know what questions your form
asks, and guessing which one holds identity would mean dropping one. The
*Colonnes à reprendre dans les listes* setting narrows and orders them.

### Nobody disappears

A response whose label matches no known slot still appears, at the end, with its
raw value and the `Hors référentiel` status. Someone signed up who appeared on
no list at all is the most expensive defect this module could have: it only shows
on the day, in front of them. A slot with no sign-ups also appears, marked
`Aucune inscription` — its absence would read "I don't know whether it exists",
and an absence must never carry two meanings. A slot with no capacity set reads
`Capacité non définie`, not `Retenue`: we do not know.

Lists are read-only. The form is not even opened when the *Colonne du créneau
dans les réponses* setting is filled in, so lists can still be produced the day
the form has been deleted.

## Check before opening sign-ups

**Créneaux > Vérifier mon installation** runs about fifteen checks and writes a
`Vérification` sheet where each row states what is fine, what is not, and what
to do about it. Nothing is modified, so it is safe to run mid-campaign.

Everything it checks used to surface only on the first submission — that is, in
front of a real respondent: a missing or duplicated trigger, confirmation emails
enabled while the form collects no addresses, a label changed on one side only, a
response counted nowhere, a nearly exhausted sending quota, a sorted response
sheet (sorting moves ranks, hence the line between confirmed people and the
waiting list). It also catches a trap you do not see coming: **a margin greater
than or equal to capacity** makes a slot full at zero sign-ups, so it vanishes
from the form without anyone ever being able to pick it, and nothing looks broken.

### "Not measured" is not "fine"

A check that **could not run** says so. If the form cannot be opened, nothing is
known about its question, its navigation or its labels — calling them fine would
be the most expensive kind of lie, the reassuring kind. Those rows read
`Non mesuré` with the reason, and the summary lists them separately. That is
distinct from a check that looked and found nothing wrong: with no responses
recorded, arrival order is `Bon`, because there was nothing to report — not
`Non mesuré`, which would claim we failed to look.

## When something breaks

The submission trigger cannot die: everything it does runs inside a safety net.

Without one, a single cause — a section jump added to the form, a renamed
question, a moved computed column — stops the limiter for good. Google emails
the owner a technical message they may or may not read, while full slots stay on
display, submission after submission, with nothing in the spreadsheet saying so.
It is this tool's most expensive failure, because it looks like normal operation.

A failure now produces three things: a **Journal** row with the `Échec` verdict,
whose *Ce qui a échoué* column carries the remedy rather than the stack trace; an
**alert** to the configured recipient, or failing that to whoever installed the
trigger, since it runs under their identity; and an entry in the Apps Script
**execution log**, where an administrator will look for it.

Alerts are aggregated **by cause**: a campaign failing on every submission for
the same reason produces one alert, not three hundred. The error is deliberately
not rethrown, so Google's own technical email does not duplicate ours — and ours
says what to do about it. A lock already held is not a failure and reports
nothing: whichever run holds it will recount everything, this submission included.

## A worked example, safe to run

**Créneaux > Voir un exemple** adds three sheets prefixed `Démo — ` and walks
through a complete case in six steps: three slots, seven seats, sign-ups, one
too many, two cancellations, then the form closing itself. Each row states what
happens, what the tool decides, what the form would then offer — and why.

Three things cannot be understood by reading about them, and the example shows
them: a sign-up accepted **beyond** capacity because that person's page was
loaded before the option was removed; that same person moving off the waiting
list **without anyone acting**, because a cancellation shifted the ranks; and
the form closing itself, a choice question being unable to hold zero options.

**The walkthrough computes, it does not narrate.** It calls the same decision
functions that drive your real form, against its own sheets — a demonstration
that duplicated the logic would be correct the day it was written and wrong
after the next change, silently. The test bench therefore checks that what it
displays matches what a real synchronisation returns on the same data.

It touches neither the form, nor the response sheet, nor the production sheets,
so it is safe to run mid-campaign. **Créneaux > Retirer l'exemple** removes the
three sheets and nothing else.

## Setup & installation

### Prerequisites

- A Google Form with a Multiple Choice, Dropdown, or Checkbox question for time slots.
- A linked Google Spreadsheet receiving the form responses.

### Installation steps

1. Open the **Google Spreadsheet linked to the form** (in the Form: *Responses* tab > *View in Sheets*).
2. Go to *Extensions > Apps Script*, and paste the contents of `apps-script/`.
3. Run `installerLeLimiteur` once from the Apps Script editor and grant the requested authorizations. The required sheets are created and the form submission trigger is installed.
4. Reload the spreadsheet: the **Créneaux** menu appears.
5. Open the "Créneaux" sheet and fill in the **Places** (Capacity) column for each slot. While empty, the slot is never removed.

Installation is idempotent: running it again adds missing sheets or settings without overwriting existing data.

The submission trigger is **installable** — simple `onFormSubmit` cannot modify forms or send emails. It runs under the account of whoever installs it, which is the intended model: the organizer arbitrates slot allocation, not the respondents.

### Requested OAuth scopes

| Scope | Purpose |
|---|---|
| `spreadsheets.currentonly` | Access only the tabs in this specific spreadsheet. |
| `forms` | Open and update the linked form. |
| `script.scriptapp` | Install the form submission trigger. |
| `script.container.ui` | Provide the custom menu and modal dialogs. |
| `script.send_mail` | Send emails via `MailApp` without requiring email read permissions. |
| `userinfo.email` | Sign alert emails. |

**`forms` is a broad scope:** Google does not provide a restricted equivalent limited to only the linked form (`forms.currentonly` only exists for container-bound form scripts, which would disconnect the script from its spreadsheet). This scope technically grants access to all forms in the account.

The safeguard is verifiable in code rather than promised — the script strictly opens the form linked to the response sheet:

```bash
grep -nE "FormApp\.(open|create)" apps-script/*.gs
```

Only one occurrence appears (`FormApp.openByUrl` in `Formulaire.gs`), using the URL from `getFormUrl()`. No hardcoded IDs, no `openById`, no `FormApp.create`. The test bench enforces this statically.

## Test bench

```bash
node banc/test.js
```

190 assertions outside Google's environment. Mock services replicate Google's constraints: rejecting empty choice questions, invalid type conversions, sheets without linked forms, or emails without recipients.

The test suite tests itself:

```bash
node banc/epreuve.js
```

It introduces **thirty-five deliberate defects** into a project copy (bypassing option adoption, removing section-navigation refusal, blinding the reopening logic, applying margins to verdicts, skipping quota checks, opening forms by ID) and verifies that the bench fails on each. A test suite that remains green against regressions proves nothing.

Syntax checking across all merged files (detecting global scope conflicts):

```bash
cat apps-script/*.gs > /tmp/limiteur.js && node --check /tmp/limiteur.js
```

### The test spreadsheet

```bash
node outils/preparer-essai.js
```

Generates `../limiteur-essai/` — **alongside** the repository rather than inside it: clasp walks up parent directories to find a `.clasp.json`, and from a nested directory it would push the parent project. Files are flat, since subdirectories become file name prefixes in the Apps Script editor.

The test directory is not tracked anywhere: it is generated on demand, and only `outils/preparer-essai.js` is tracked by git. Clasp configuration (`.clasp.json`) survives regeneration so that the spreadsheet binding is preserved.

Once pushed, two functions appear in the editor's **execution menu**: `preparerLeFormulaireDEssai`, which creates a 3-slot form and links it to the sheet, and `controlerEnConditionsReelles`. They are not in the spreadsheet menu: adding them there would have required modifying `Menu.gs`, thereby testing something different from what is shipped.

The live check tests what the bench can only assume — foremost the three hypotheses backing refusal code since v0.1:
- **Does `setChoiceValues` erase section navigation?** If not, refusing to control such questions is needlessly strict;
- **Does a choice question reject an empty option list?** This is why the form is closed instead of clearing the question;
- **Does the trigger fire after the row is written?** Hence `forSpreadsheet` rather than `forForm`. (This remains an indication rather than proof: a slow trigger looks like one that missed the row).

It also verifies what mock services can only assume: date strings returning as `Date` objects, script timezone matching spreadsheet timezone (`clasp create` uses account default), `getFormUrl()` returning `null` on unlinked sheets, and referenced enums existing.

## Known limitations and roadmap

- **Field-tested on 18 September 2026: ten hypotheses confirmed, none refuted.** Notably `setChoiceValues` does erase section navigation — so refusing to drive such a question is justified — a choice question does reject an empty option list, and `getFormUrl()` does return `null` on an unlinked sheet.
- **The submission trigger does fire after the row is written** — verified with real submissions: the Journal filled itself with the right slot and rank, so `forSpreadsheet` was the right choice. This also makes the Journal the trigger's only witness: a menu-driven sync never writes to it.
- **Still open:** the real width of the oversubscription window, which will set the default margin.
- Grids and multi-question forms are intentionally unsupported (they require different counting models).
- Very large response sheets are read in full on every submission (fine for hundreds of rows; thousands would warrant paginated or delta counting).

## License

Elastic License 2.0 — see [LICENSE](LICENSE).  
Copyright Fabrice Faucheux (https://faucheux.bzh)
