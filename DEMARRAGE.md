<!-- SPDX-License-Identifier: Elastic-2.0 -->

# Démarrer en dix minutes

Cet outil retire de votre formulaire Google les créneaux dont toutes les places
sont prises, et les remet quand une place se libère.

Vous n'avez besoin d'aucune connaissance en programmation. Il faut simplement
faire les étapes dans l'ordre.

> Ce guide vous prend par la main. Si vous cherchez plutôt à comprendre comment
> l'outil est fait et pourquoi, lisez le [README](README.md).

## Ce qu'il vous faut

- Un **formulaire Google** avec une question « liste déroulante », « choix
  multiple » ou « cases à cocher », dont chaque option est un créneau.
- Le **classeur** qui reçoit ses réponses. Si vous ne l'avez pas encore : dans
  le formulaire, onglet *Réponses*, puis *Afficher dans Sheets*.

## Installer

1. Ouvrez le **classeur** (pas le formulaire).
2. Menu **Extensions > Apps Script**. Un éditeur s'ouvre dans un nouvel onglet.
3. Effacez ce qu'il contient. Ouvrez
   [`distribution/limiteur-de-creneaux.gs`](distribution/limiteur-de-creneaux.gs),
   copiez **tout**, collez-le dans l'éditeur, puis enregistrez (l'icône
   disquette).
4. En haut de l'éditeur, dans la liste déroulante des fonctions, choisissez
   **`installerLeLimiteur`** et cliquez sur **Exécuter**.
5. Google demande des autorisations. Acceptez-les — l'outil doit pouvoir lire
   vos réponses, modifier votre formulaire et envoyer des messages.
6. Revenez au classeur et **rechargez la page**. Un menu **Créneaux** apparaît
   à droite du menu *Aide*.
7. Ouvrez l'onglet **Créneaux** : vos créneaux y sont déjà, repris du
   formulaire. Renseignez la colonne **Places** pour chacun.
8. Menu **Créneaux > Vérifier mon installation**. Corrigez ce qui est signalé
   « Bloquant ».

C'est fini. À partir de maintenant, chaque inscription est comptée et les
créneaux complets disparaissent tout seuls.

## Si votre formulaire reçoit déjà des réponses

Deux choses vont vous surprendre, et il vaut mieux les savoir avant.

**Les réponses déjà reçues sont comptées.** Dès que vous renseignerez les
places, un créneau déjà rempli **disparaîtra du formulaire**, sans prévenir
personne. Si des inscriptions sont en cours, prévenez avant d'installer.

**Les personnes déjà inscrites n'ont pas été vérifiées.** L'outil n'existait pas
quand elles ont répondu : il ne peut pas savoir après coup si certaines
dépassent la capacité. Lancez **Créneaux > Établir les listes** et regardez la
colonne *Statut* : toute personne en « Liste d'attente » s'est inscrite avant
vous et ne le sait pas. Prévenez-la.

Si votre classeur contient déjà un onglet nommé « Aide », « Listes » ou
« Vérification », l'installation s'arrêtera sans rien modifier et vous demandera
de le renommer. C'est normal : ces onglets appartiennent à l'outil, qui les
réécrit entièrement.

## Au quotidien

Vous n'avez rien à faire : tout se passe à la réception de chaque réponse.

| Vous voulez… | Menu **Créneaux** |
|---|---|
| voir où en sont les inscriptions | *Où en sont les créneaux ?* |
| la liste des inscrits, par créneau | *Établir les listes* |
| rendre une place | supprimez la ligne dans la feuille des réponses, puis *Recompter* |
| fermer un créneau à la main | écrivez « Fermé à la main » dans sa colonne *État* |
| comprendre l'outil en six étapes | *Voir un exemple* |

Quand tous les créneaux sont complets, le formulaire se ferme tout seul, avec un
message. Il se rouvre dès qu'une place se libère.

## La seule chose à comprendre

**Retirer un créneau du formulaire n'empêche pas une inscription de trop.**

Quelqu'un qui avait la page ouverte avant le retrait voit encore le créneau. S'il
envoie sa réponse, Google l'accepte — personne ne peut l'en empêcher, aucun outil
au monde.

Ce que fait le limiteur : il le **détecte à la réception**. L'inscription est
notée « Surréservation » dans l'onglet *Journal*, et la personne reçoit un
message lui disant qu'elle est en liste d'attente. Elle n'est ni perdue, ni
laissée à croire qu'elle a une place.

Pour réduire ces cas, mettez **1** dans la colonne *Marge* : le créneau sera
retiré alors qu'il reste encore une place, ce qui laisse une réserve.

## Si quelque chose ne va pas

**Créneaux > Vérifier mon installation** contrôle une quinzaine de points et dit
quoi faire pour chacun. Commencez toujours par là.

L'onglet **Journal** garde une trace de chaque inscription : son rang, son
verdict, et le message envoyé. Une ligne rouge y signale ce qui demande votre
attention.

L'onglet **Aide** répond aux questions courantes, sans quitter le classeur.
