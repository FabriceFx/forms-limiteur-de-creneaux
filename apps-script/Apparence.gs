/**
 * Limiteur de créneaux — couleurs et notes.
 * Introduit en v0.6.
 *
 * ── Ce que la couleur dit, et ce qu'elle ne dit pas ─────────────────────────
 *
 * **Cinq sens, et les mêmes dans les quatre onglets.** Un tableau où le rouge
 * voudrait dire « complet » ici et « en panne » là ne se lit pas plus vite qu'un
 * tableau sans couleur : il se lit moins vite, parce qu'il faut se rappeler
 * lequel des deux on regarde.
 *
 *   vert   — c'est bon, rien à faire ;
 *   gris   — c'est fini, il n'y a plus rien à faire ;
 *   bleu   — on ne sait pas, et c'est dit ;
 *   orange — il y a quelque chose à traiter ;
 *   rouge  — il faut agir, quelqu'un ou quelque chose est en défaut.
 *
 * Le gris et le bleu sont ce qui distingue cet habillage d'un simple
 * « vert-orange-rouge » : « Complet » n'est pas un problème, c'est le
 * fonctionnement normal ; « Non mesuré » n'est pas un demi-bon, c'est une
 * ignorance avouée. Les confondre avec de l'orange les ferait traiter comme des
 * anomalies, et on cesserait de lire la colonne.
 *
 * **La couleur ne porte jamais l'information seule.** Chaque cellule colorée
 * contient déjà le mot — « Complet », « Bloquant », « Liste d'attente ». La
 * couleur ne fait qu'accélérer une lecture qui reste possible sans elle, pour
 * qui l'imprime en noir et blanc ou ne distingue pas ces teintes.
 *
 * ── Les notes ──────────────────────────────────────────────────────────────
 *
 * L'onglet « Aide » explique l'outil ; les notes expliquent **la colonne qu'on
 * a sous le curseur**. Comprendre « Marge » ne doit pas demander de changer
 * d'onglet — un expert privé d'explication reconstruit un raisonnement
 * approximatif, et décide sur cette approximation.
 */

/** Fond et texte, par sens. Une seule définition pour tout le projet. */
const LIMITEUR_TEINTES_ = {
  bon: { fond: '#e6f4ea', texte: '#137333' },
  fini: { fond: '#f1f3f4', texte: '#5f6368' },
  inconnu: { fond: '#e8f0fe', texte: '#1967d2' },
  aTraiter: { fond: '#fef7e0', texte: '#b06000' },
  agir: { fond: '#fce8e6', texte: '#c5221f' },
};

/**
 * Quelle valeur prend quel sens, onglet par onglet.
 *
 * **Une fonction et non une constante, et c'est obligatoire.** Cette table
 * nomme des onglets déclarés dans d'autres fichiers : évaluée au chargement,
 * elle échouerait dès qu'Apps Script charge celui-ci en premier — ce qu'il fait
 * par défaut, l'ordre étant alphabétique et « Apparence » venant avant tout le
 * reste. Et un projet qui ne se charge pas rend TOUTES ses fonctions
 * introuvables d'un coup, y compris celles qui n'ont rien à voir.
 *
 * Écrit en toutes lettres plutôt que déduit des constantes d'état : c'est ici
 * qu'on veut voir d'un coup d'œil qu'« Hors référentiel » est rouge au Journal
 * comme aux Listes, et le lire dans deux fichiers ne le garantirait pas.
 */
const limiteurHabillage_ = () => [
  {
    onglet: LIMITEUR_ONGLET_CRENEAUX_,
    colonne: 'État',
    sens: {
      Ouvert: 'bon',
      Complet: 'fini',
      'Fermé à la main': 'fini',
      'Sans capacité': 'aTraiter',
    },
  },
  {
    onglet: LIMITEUR_ONGLET_JOURNAL_,
    colonne: 'Verdict',
    sens: {
      Acceptée: 'bon',
      Surréservation: 'aTraiter',
      'Sans créneau': 'fini',
      'Sans capacité': 'inconnu',
      'Hors référentiel': 'agir',
      Échec: 'agir',
    },
  },
  {
    onglet: LIMITEUR_ONGLET_VERIFICATION_,
    colonne: 'État',
    sens: {
      Bon: 'bon',
      'À vérifier': 'aTraiter',
      Bloquant: 'agir',
      'Non mesuré': 'inconnu',
    },
  },
  {
    onglet: LIMITEUR_ONGLET_LISTES_,
    colonne: 'Statut',
    sens: {
      Retenue: 'bon',
      'Liste d’attente': 'aTraiter',
      'Aucune inscription': 'fini',
      'Capacité non définie': 'inconnu',
      'Hors référentiel': 'agir',
    },
  },
];

/** Ce qu'une colonne veut dire, là où on la lit. */
const limiteurNotes_ = () => ({
  [LIMITEUR_ONGLET_CRENEAUX_]: {
    'Créneau': 'Le libellé EXACT de l’option dans le formulaire.\n\n'
      + 'C’est la clé qui relie les deux : le modifier d’un seul côté fait que '
      + 'les réponses ne sont plus comptées nulle part. Le diagnostic le signale.',
    Places: 'Combien de personnes ce créneau peut accueillir.\n\n'
      + 'Vide ne veut pas dire zéro : cela veut dire « non décidé ». Le créneau '
      + 'reste alors proposé et n’est jamais retiré du formulaire.',
    Marge: 'Retire l’option avant la dernière place.\n\n'
      + 'À 1, le créneau disparaît du formulaire alors qu’il reste encore une '
      + 'place. Sert à réduire les inscriptions de trop, dues aux formulaires '
      + 'restés ouverts dans un navigateur.\n\n'
      + 'Elle ne supprime pas la place : une inscription qui l’occupe reste '
      + 'acceptée. Vide, c’est le réglage « Marge par défaut » qui s’applique.',
    Pris: 'Calculé. Inscriptions comptées dans la feuille des réponses.\n\n'
      + 'Supprimer une ligne de cette feuille rend la place.',
    Restant: 'Calculé : Places moins Pris.',
    'État': 'Calculé à chaque recomptage — sauf « Fermé à la main », que vous '
      + 'pouvez écrire vous-même.\n\n'
      + 'Le code ne défait jamais cette mention : le créneau reste retiré du '
      + 'formulaire tant qu’elle est là. Effacez-la pour le rendre.',
    'Dernier comptage': 'Calculé. Quand ces chiffres ont été établis.',
  },
  [LIMITEUR_ONGLET_JOURNAL_]: {
    Ligne: 'La ligne de la feuille des réponses, pour retrouver la personne.',
    Rang: 'Sa place dans le créneau, selon l’ordre des lignes.\n\n'
      + 'Ne triez pas la feuille des réponses : cela change les rangs, donc '
      + 'déplace la frontière entre les personnes retenues et la liste d’attente.',
    Verdict: 'Acceptée : le rang tient dans la capacité.\n\n'
      + 'Surréservation : la personne est arrivée après, parce que sa page était '
      + 'ouverte avant le retrait de l’option. Google accepte sa réponse et '
      + 'personne ne peut la refuser ; elle est en liste d’attente.',
    Courriel: 'Si un message est parti, et sinon pourquoi.',
    'Ce qui a échoué': 'Vide veut dire que rien n’a échoué.\n\n'
      + 'Sinon, ce que le déclencheur n’a pas pu faire, et quoi faire ensuite.',
  },
  [LIMITEUR_ONGLET_VERIFICATION_]: {
    'État': 'Bon : vérifié, rien à redire.\n\n'
      + 'À vérifier : cela fonctionnera, mais probablement pas comme vous '
      + 'l’attendez.\n\nBloquant : cela ne peut pas fonctionner.\n\n'
      + 'Non mesuré : le contrôle n’a PAS PU s’exécuter. Ce n’est pas « Bon » — '
      + 'on ne sait rien de ce point.',
    'Quoi faire': 'Vide quand il n’y a rien à faire.',
  },
  [LIMITEUR_ONGLET_LISTES_]: {
    Rang: 'La place de la personne dans son créneau, par ordre d’arrivée.',
    Statut: 'Retenue : elle a une place.\n\n'
      + 'Liste d’attente : elle s’est inscrite au-delà de la capacité.\n\n'
      + 'Capacité non définie : la colonne « Places » du créneau est vide, on ne '
      + 'peut donc pas le dire.\n\n'
      + 'Hors référentiel : son créneau ne correspond à aucun créneau connu. '
      + 'Cette personne s’est inscrite et n’est comptée nulle part.',
    'Inscrite le': 'L’horodatage de sa réponse.',
    Ligne: 'La ligne de la feuille des réponses, pour la retrouver.',
  },
});

/**
 * Pose les règles de couleur sur une colonne, sans écraser celles des autres.
 *
 * `setConditionalFormatRules` remplace **toutes** les règles de la feuille : on
 * relit donc les existantes et on ne retire que celles qui portent sur la
 * colonne pilotée. Une règle que vous poseriez vous-même sur cette colonne-là
 * serait remplacée au prochain habillage — posez-la sur une autre colonne.
 */
const limiteurPoserLesCouleurs_ = (feuille, position, sens) => {
  const hauteur = Math.max(feuille.getMaxRows() - 1, 1);
  const plage = feuille.getRange(2, position, hauteur, 1);

  const gardees = feuille.getConditionalFormatRules().filter((regle) => !regle.getRanges()
    .some((une) => une.getColumn() === position));

  const notres = Object.keys(sens).map((valeur) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(valeur)
    .setBackground(LIMITEUR_TEINTES_[sens[valeur]].fond)
    .setFontColor(LIMITEUR_TEINTES_[sens[valeur]].texte)
    .setRanges([plage])
    .build());

  feuille.setConditionalFormatRules([...gardees, ...notres]);
  return { gardees: gardees.length, posees: notres.length };
};

/** Pose les notes sur la ligne d'en-tête, par nom de colonne. */
const limiteurPoserLesNotes_ = (feuille, table, notes) => {
  let posees = 0;
  Object.keys(notes).forEach((nom) => {
    if (!(nom in table.index)) return;
    feuille.getRange(1, table.index[nom] + 1).setNote(notes[nom]);
    posees += 1;
  });
  return { posees };
};

/**
 * Habille un onglet : couleurs et notes.
 *
 * À rappeler après toute réécriture complète d'un onglet — `clear()` emporte
 * les notes et les règles avec le contenu, et un onglet réécrit se retrouverait
 * nu sans que rien ne le signale.
 *
 * Ne lève jamais : l'apparence ne doit pas empêcher un outil de fonctionner.
 * L'échec est compté par `SocleErreurs`, donc visible au bilan, mais le
 * traitement continue.
 */
const limiteurHabiller_ = (nomOnglet) => SocleErreurs.absorber(
  `habillage de l’onglet « ${nomOnglet} »`,
  () => {
    const classeur = limiteurClasseur_();
    const feuille = classeur.getSheetByName(nomOnglet);
    if (!feuille || feuille.getLastRow() < 1) {
      return { fait: false, raison: 'onglet absent ou vide' };
    }

    const table = SocleFeuilles.lireTable(feuille);
    const notes = limiteurNotes_()[nomOnglet] || {};
    const resultatNotes = limiteurPoserLesNotes_(feuille, table, notes);

    const habillage = limiteurHabillage_().find((un) => un.onglet === nomOnglet);
    if (!habillage || !(habillage.colonne in table.index)) {
      return { fait: true, notes: resultatNotes.posees, couleurs: 0 };
    }
    const couleurs = limiteurPoserLesCouleurs_(
      feuille, table.index[habillage.colonne] + 1, habillage.sens);
    return { fait: true, notes: resultatNotes.posees, couleurs: couleurs.posees };
  },
  { fait: false, raison: 'l’habillage a échoué' },
);

/** Habille les quatre onglets, ceux qui existent. */
const limiteurHabillerTout_ = () => limiteurHabillage_()
  .map((un) => ({ onglet: un.onglet, ...limiteurHabiller_(un.onglet) }));
