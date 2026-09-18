# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Ce projet suit le [Semantic Versioning](https://semver.org/lang/fr/).

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
