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

74 assertions, hors de Google. Les faux services refusent ce que les vrais
refusent : une question à choix sans aucune option, une conversion de type
impossible, une feuille liée à aucun formulaire, un envoi sans destinataire.

Le banc s'éprouve lui-même :

```bash
node banc/epreuve.js
```

Il réintroduit **treize défauts réels** dans une copie du projet — l'adoption des
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

## Ce qui reste à faire

**Rien de ce projet n'a encore tourné dans Apps Script.** Le banc simule ; il ne
remplace pas un essai réel, et l'expérience dit que c'est là que se trouvent les
surprises. Trois points attendent cette confirmation :

- que `setChoiceValues` perde bien la navigation par section — le refus est posé
  sur cette hypothèse, documentée mais jamais vérifiée de mes mains ;
- que le déclencheur de soumission parte bien **après** l'écriture de la ligne
  (c'est la raison du choix `forSpreadsheet` plutôt que `forForm`) ;
- la largeur réelle de la fenêtre de surréservation, en soumettant deux réponses
  simultanées sur la dernière place.

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

74 assertions outside Google's environment. Mock services replicate Google's constraints: rejecting empty choice questions, invalid type conversions, sheets without linked forms, or emails without recipients.

The test suite tests itself:

```bash
node banc/epreuve.js
```

It introduces **thirteen deliberate defects** into a project copy (bypassing option adoption, removing section-navigation refusal, blinding the reopening logic, applying margins to verdicts, skipping quota checks, opening forms by ID) and verifies that the bench fails on each. A test suite that remains green against regressions proves nothing.

Syntax checking across all merged files (detecting global scope conflicts):

```bash
cat apps-script/*.gs > /tmp/limiteur.js && node --check /tmp/limiteur.js
```

## Known limitations and roadmap

- **Not yet field-tested in live Apps Script:** The bench mocks Google services; real-world trials remain to confirm `setChoiceValues` section behavior, exact submission trigger timing after row insertion, and live race condition latency.
- Grids and multi-question forms are intentionally unsupported (they require different counting models).
- Very large response sheets are read in full on every submission (fine for hundreds of rows; thousands would warrant paginated or delta counting).

## License

Elastic License 2.0 — see [LICENSE](LICENSE).  
Copyright Fabrice Faucheux (https://faucheux.bzh)
