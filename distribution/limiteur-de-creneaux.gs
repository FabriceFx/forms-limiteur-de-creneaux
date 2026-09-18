// Limiteur de créneaux pour Google Forms — version 1.2.0
//
// Retire d'un formulaire les créneaux dont toutes les places sont prises, et les
// remet quand une place se libère.
//
// ── Quoi faire de ce fichier ───────────────────────────────────────────────
//
//   1. Ouvrez le CLASSEUR qui reçoit les réponses de votre formulaire.
//      (Dans le formulaire : onglet « Réponses », puis « Afficher dans Sheets ».)
//   2. Menu « Extensions » > « Apps Script ».
//   3. Effacez ce que contient l'éditeur, collez TOUT ce fichier, enregistrez.
//   4. En haut de l'éditeur, choisissez la fonction « installerLeLimiteur »
//      et lancez-la. Acceptez les autorisations demandées.
//   5. Revenez au classeur et rechargez la page : un menu « Créneaux » apparaît.
//   6. Dans l'onglet « Créneaux », renseignez la colonne « Places ».
//   7. Menu « Créneaux » > « Vérifier mon installation ».
//
// Le guide complet — et ce qui change si votre formulaire reçoit DÉJÀ des
// réponses — est dans DEMARRAGE.md.
//
// ── Ce que vous devez savoir avant de vous en servir ───────────────────────
//
// Retirer un créneau du formulaire n'empêche pas une inscription de trop : la
// page déjà ouverte dans le navigateur de quelqu'un affiche encore l'ancienne
// liste, et Google accepte sa réponse. L'outil le détecte à la réception, le
// note dans l'onglet « Journal » et prévient la personne qu'elle est en liste
// d'attente. Le menu « Créneaux » > « Voir un exemple » le montre en six étapes.
//
// ── Ce fichier est ENGENDRÉ ────────────────────────────────────────────────
//
// Ne le modifiez pas : il est assemblé depuis 15 fichiers sources par
// `node outils/assembler.js`, et toute retouche serait perdue à la prochaine
// génération. Pour modifier l'outil, travaillez dans `apps-script/`.
//
// Sous licence Elastic License 2.0 — Fabrice Faucheux (https://faucheux.bzh)

// ===========================================================================
// Apparence.gs
// ===========================================================================

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
      'Complet par la marge': 'fini',
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
      'Non traitée': 'agir',
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
    Restant: 'Calculé : Places moins Pris.\n\n'
      + 'Un créneau peut être retiré du formulaire alors qu’il reste des places : '
      + 'c’est la marge qui l’a fermé en avance. La colonne « État » le dit — '
      + '« Complet par la marge » plutôt que « Complet ».',
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

// ===========================================================================
// Demonstration.gs
// ===========================================================================

/**
 * Limiteur de créneaux — le cas exemple.
 * Introduit en v0.3.
 *
 * Trois choses ne se comprennent pas en les lisant : qu'une inscription soit
 * acceptée **au-delà** de la capacité, qu'une ligne supprimée rende la place, et
 * que le formulaire se ferme de lui-même. L'onglet « Aide » les explique en
 * mots ; ce module les montre.
 *
 * ── Ce qui fait qu'elle ne peut pas mentir ──────────────────────────────────
 *
 * **La démonstration appelle le vrai code de décision.** `limiteurCompter_`,
 * `limiteurEtatDesCreneaux_` et `limiteurJugerLaLigne_` prennent leurs données
 * en argument : on leur passe les onglets de démo, et ce qui s'affiche est ce
 * que l'outil ferait vraiment. Une démonstration qui recopierait la logique
 * serait juste le jour où on l'écrit et fausse à la modification suivante — et
 * personne ne s'en apercevrait, puisqu'elle continuerait de se dérouler.
 *
 * **Elle ne touche à rien.** Ni au formulaire, ni à la feuille des réponses, ni
 * aux onglets de production : uniquement des onglets préfixés, retirables d'une
 * entrée de menu. Elle peut donc se lancer sur une campagne en cours.
 *
 * Sa limite, assumée : le formulaire ne change pas sous les yeux de qui la
 * regarde. La colonne « Le formulaire proposerait » donne à la place la liste
 * exacte que le vrai calcul rend à cette étape.
 */

const LIMITEUR_PREFIXE_DEMO_ = 'Démo — ';
const LIMITEUR_ONGLET_DEMO_CRENEAUX_ = `${LIMITEUR_PREFIXE_DEMO_}créneaux`;
const LIMITEUR_ONGLET_DEMO_REPONSES_ = `${LIMITEUR_PREFIXE_DEMO_}réponses`;
const LIMITEUR_ONGLET_DEMO_DEROULE_ = `${LIMITEUR_PREFIXE_DEMO_}déroulé`;

const LIMITEUR_DEMO_COLONNE_ = 'Créneau souhaité';
const LIMITEUR_DEMO_ENTETE_REPONSES_ = ['Horodatage', 'Personne', LIMITEUR_DEMO_COLONNE_];

const LIMITEUR_DEMO_COLONNES_DEROULE_ = ['Étape', 'Ce qui arrive', 'Le compte',
  'Ce que l’outil décide', 'Le formulaire proposerait', 'Pourquoi'];

/** Sept places en tout, réparties de façon à ce que chaque étape ait un sens. */
const LIMITEUR_DEMO_CRENEAUX_ = [['Mardi 14 h', 2], ['Jeudi 9 h', 3], ['Vendredi 16 h', 2]];

/**
 * Une heure fixe par personne.
 *
 * Chaque étape réécrit la feuille entière — c'est ainsi qu'on modélise une
 * annulation, qui est une ligne en moins. Si l'horodatage se recalculait au
 * passage, toutes les lignes changeraient à chaque étape et la démonstration
 * donnerait l'impression que l'outil réécrit les réponses des gens.
 */
const LIMITEUR_DEMO_HEURES_ = {
  Alice: '09:05', Bruno: '09:07', Chloé: '09:12', Diane: '09:20',
  Émile: '09:24', Farid: '09:31', Gaëlle: '09:38', Hugo: '09:44', Inès: '09:51',
};

const LIMITEUR_DEMO_ETAPES_ = [
  {
    quoi: 'Trois créneaux sont ouverts, personne ne s’est encore inscrit.',
    reponses: [],
    pourquoi: 'Sept places en tout. Tant qu’il en reste, les trois créneaux sont '
      + 'proposés.',
  },
  {
    quoi: 'Alice puis Bruno prennent le mardi, qui compte deux places.',
    reponses: [['Alice', 'Mardi 14 h'], ['Bruno', 'Mardi 14 h']],
    pourquoi: 'La capacité est atteinte : l’outil retire l’option pour que personne '
      + 'd’autre ne la choisisse.',
  },
  {
    quoi: 'Chloé prend le mardi quand même.',
    reponses: [['Alice', 'Mardi 14 h'], ['Bruno', 'Mardi 14 h'], ['Chloé', 'Mardi 14 h']],
    juger: 'Chloé',
    pourquoi: 'Elle avait le formulaire ouvert avant le retrait : sa page affichait '
      + 'encore le mardi. Google a accepté sa réponse et aucune API ne permet de la '
      + 'refuser. L’outil la classe en liste d’attente plutôt que de la perdre — '
      + 'c’est la raison d’être de la colonne « Marge ».',
  },
  {
    quoi: 'Alice se décommande : sa ligne est supprimée de la feuille.',
    reponses: [['Bruno', 'Mardi 14 h'], ['Chloé', 'Mardi 14 h']],
    juger: 'Chloé',
    pourquoi: 'Chloé prend la place sans rien avoir à faire : le rang suit l’ordre '
      + 'des lignes, donc la liste d’attente se résorbe d’elle-même. Le mardi reste '
      + 'complet, ses deux places étant toujours prises.',
  },
  {
    quoi: 'Bruno se décommande à son tour.',
    reponses: [['Chloé', 'Mardi 14 h']],
    pourquoi: 'Le mardi repasse sous sa capacité : l’option revient d’elle-même, et '
      + 'à sa place dans la liste. C’est l’onglet « Créneaux » qui a gardé son '
      + 'libellé et sa position — le formulaire, lui, les avait oubliés.',
  },
  {
    quoi: 'Les six places restantes sont prises.',
    reponses: [['Chloé', 'Mardi 14 h'], ['Diane', 'Mardi 14 h'],
      ['Émile', 'Jeudi 9 h'], ['Farid', 'Jeudi 9 h'], ['Gaëlle', 'Jeudi 9 h'],
      ['Hugo', 'Vendredi 16 h'], ['Inès', 'Vendredi 16 h']],
    pourquoi: 'Plus une seule place. Une question à choix ne peut pas rester sans '
      + 'aucune option — Google le refuse —, donc le formulaire se ferme avec un '
      + 'message. Il se rouvrira à la première annulation.',
  },
];

// ---------------------------------------------------------------------------

/** Les onglets de la démonstration, et eux seuls. */
const limiteurDemoOnglets_ = () => [LIMITEUR_ONGLET_DEMO_CRENEAUX_,
  LIMITEUR_ONGLET_DEMO_REPONSES_, LIMITEUR_ONGLET_DEMO_DEROULE_];

/** Le référentiel fictif : mêmes colonnes que le vrai, capacités renseignées. */
const limiteurDemoPoserLesCreneaux_ = () => {
  const lignes = LIMITEUR_DEMO_CRENEAUX_.map(([libelle, places]) => LIMITEUR_COLONNES_CRENEAUX_
    .map((nom) => {
      if (nom === 'Créneau') return libelle;
      if (nom === 'Places') return places;
      return '';
    }));
  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_DEMO_CRENEAUX_,
    LIMITEUR_COLONNES_CRENEAUX_, lignes);
};

/** Le compte, écrit pour être lu : « Mardi 14 h 2/2 · Jeudi 9 h 0/3 ». */
const limiteurDemoCompte_ = (evalues) => evalues
  .map((creneau) => `${creneau.libelle} ${creneau.pris}/${creneau.places}`)
  .join(' · ');

/**
 * Ce que l'outil décide à cette étape.
 *
 * Quand l'étape nomme quelqu'un, on montre **son** verdict : c'est la seule
 * façon de rendre visible qu'un rang au-delà de la capacité n'est ni refusé ni
 * perdu. Sinon, on nomme les créneaux devenus complets.
 */
const limiteurDemoDecision_ = (etape, evalues, comptage) => {
  if (etape.juger) {
    const rang = etape.reponses.findIndex(([qui]) => qui === etape.juger);
    if (rang === -1) {
      throw SocleErreurs.erreur({
        quoi: `L’étape « ${etape.quoi} » veut montrer le verdict de ${etape.juger}, `
          + 'qui ne figure pas dans ses réponses.',
        quoiFaire: 'Corrigez LIMITEUR_DEMO_ETAPES_ dans Demonstration.gs : le nom de '
          + '« juger » doit être celui d’une personne de la même étape.',
      });
    }
    const verdicts = limiteurJugerLaLigne_(rang + 2, { creneaux: evalues, comptage });
    return verdicts
      .map((un) => `${etape.juger} : ${un.verdict} — rang ${un.rang} pour `
        + `${un.creneau.places} places`)
      .join(' ; ');
  }

  const complets = evalues.filter((creneau) => creneau.etat === LIMITEUR_ETATS_.complet);
  if (complets.length === 0) return 'Tous les créneaux restent ouverts.';
  return `Complet : ${complets.map((creneau) => creneau.libelle).join(', ')}.`;
};

/**
 * Monte la démonstration et la déroule.
 *
 * Chaque étape réécrit l'ensemble des réponses plutôt que d'ajouter ou de
 * supprimer des lignes : une annulation devient une ligne en moins, et les
 * numéros de ligne se décalent exactement comme ils le feraient en vrai. C'est
 * ce décalage qui fait monter Chloé de la liste d'attente à la place libérée.
 */
const limiteurJouerLaDemonstration_ = () => {
  limiteurDemoPoserLesCreneaux_();

  const deroule = LIMITEUR_DEMO_ETAPES_.map((etape, rang) => {
    SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_DEMO_REPONSES_,
      LIMITEUR_DEMO_ENTETE_REPONSES_,
      etape.reponses.map(([qui, creneau]) => [
        `2026-09-18 ${LIMITEUR_DEMO_HEURES_[qui] || '09:00'}`, qui, creneau,
      ]));

    const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_DEMO_REPONSES_);
    const { creneaux } = limiteurLireReferentiel_(0, LIMITEUR_ONGLET_DEMO_CRENEAUX_);
    const comptage = limiteurCompter_(creneaux, {
      feuilleDesReponses: feuille,
      colonne: LIMITEUR_DEMO_COLONNE_,
    });
    const evalues = limiteurEtatDesCreneaux_(creneaux, comptage.comptes);
    const affiches = evalues.filter((creneau) => creneau.aAfficher)
      .map((creneau) => creneau.libelle);

    return [
      rang + 1,
      etape.quoi,
      limiteurDemoCompte_(evalues),
      limiteurDemoDecision_(etape, evalues, comptage),
      affiches.length === 0
        ? '— aucune option ne reste, le formulaire se ferme'
        : affiches.join(' · '),
      etape.pourquoi,
    ];
  });

  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_DEMO_DEROULE_,
    LIMITEUR_DEMO_COLONNES_DEROULE_, deroule);

  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_DEMO_DEROULE_);
  [50, 300, 220, 260, 220, 480].forEach((largeur, rang) => {
    feuille.setColumnWidth(rang + 1, largeur);
  });

  return { etapes: deroule.length, onglets: limiteurDemoOnglets_() };
};

/**
 * Retire les onglets de la démonstration, et rien d'autre.
 *
 * La garde est le nom : on ne supprime que ce qui porte le préfixe, et
 * seulement les trois onglets qu'on a posés. Une suppression de trop coûterait
 * du travail ; un onglet oublié ne coûte rien.
 */
const limiteurRetirerLaDemonstration_ = () => {
  const classeur = limiteurClasseur_();
  const retires = [];
  limiteurDemoOnglets_().forEach((nom) => {
    const feuille = classeur.getSheetByName(nom);
    if (!feuille) return;
    if (nom.indexOf(LIMITEUR_PREFIXE_DEMO_) !== 0) return;
    classeur.deleteSheet(feuille);
    retires.push(nom);
  });
  return { retires };
};

// ===========================================================================
// Formulaire.gs
// ===========================================================================

/**
 * Limiteur de créneaux — tout ce qui touche à FormApp, et rien d'autre.
 * Introduit en v0.1.
 *
 * ── Les trois pièges payés ici ──────────────────────────────────────────────
 *
 * **`setChoiceValues` écrase la navigation par page.** Un formulaire à
 * sections conditionnelles — « si vous choisissez A, allez à la page 3 » —
 * range cette destination *dans le choix lui-même*. Reposer la liste la perd,
 * et le formulaire se met à envoyer tout le monde au même endroit. Silencieux,
 * irréversible, et découvert bien plus tard par les répondants. D'où le refus
 * pur et simple dès qu'un choix porte une navigation.
 *
 * **Une question à choix ne peut pas avoir zéro option.** Google refuse une
 * liste vide. Quand tout est complet, il faut donc fermer le formulaire plutôt
 * que de vider la question — et se souvenir que c'est l'outil qui l'a fermé,
 * pour ne rouvrir que ce qu'on a soi-même fermé.
 *
 * **Le formulaire déjà ouvert dans un navigateur ne se met pas à jour.** Rien
 * ici n'y peut quoi que ce soit : c'est une page chargée avant la
 * modification. Le retrait d'une option est un confort d'affichage, jamais une
 * garantie. La garantie, c'est le verdict rendu à la réception.
 */

const LIMITEUR_MEMOIRE_FERMETURE_ = 'limiteurDeCreneaux.fermeParLOutil';

/**
 * Ouvre le formulaire qui alimente ce classeur.
 *
 * Par l'URL portée par la feuille de réponses, jamais par un identifiant
 * recopié dans une constante : un identifiant en dur survit au changement de
 * formulaire et pilote alors le mauvais.
 */
const limiteurOuvrirLeFormulaire_ = (feuilleDesReponses) => {
  const url = (feuilleDesReponses || limiteurFeuilleDesReponses_()).getFormUrl();
  if (!url) {
    throw SocleErreurs.erreur({
      quoi: 'La feuille des réponses n’est plus reliée à son formulaire.',
      quoiFaire: 'Dans le formulaire, onglet « Réponses », reliez-le de nouveau '
        + 'à ce classeur, puis relancez la synchronisation.',
    });
  }
  return FormApp.openByUrl(url);
};

/** Les types de question dont on sait piloter les options. */
const limiteurTypesPilotables_ = () => [
  FormApp.ItemType.LIST,
  FormApp.ItemType.MULTIPLE_CHOICE,
  FormApp.ItemType.CHECKBOX,
];

/** Vrai pour une question où une personne peut cocher plusieurs créneaux. */
const limiteurEstMultiple_ = (element) => element.getType() === FormApp.ItemType.CHECKBOX;

/** La question sous sa forme typée, seule à porter `getChoices` / `setChoiceValues`. */
const limiteurQuestionTypee_ = (element) => {
  switch (element.getType()) {
    case FormApp.ItemType.LIST: return element.asListItem();
    case FormApp.ItemType.MULTIPLE_CHOICE: return element.asMultipleChoiceItem();
    case FormApp.ItemType.CHECKBOX: return element.asCheckboxItem();
    default: return null;
  }
};

/**
 * Trouve la question des créneaux : celle que nomme le réglage, ou l'unique
 * question à choix du formulaire.
 *
 * La détection automatique ne s'autorise que le cas sans ambiguïté. Deux
 * questions à choix et pas de réglage : on refuse en listant les titres, parce
 * que deviner ici reviendrait à retirer des options de la mauvaise question.
 */
const limiteurTrouverLaQuestion_ = (formulaire, titreVoulu) => {
  const pilotables = limiteurTypesPilotables_();
  const candidates = formulaire.getItems()
    .filter((element) => pilotables.indexOf(element.getType()) >= 0);

  const voulu = SocleTexte.comparable(titreVoulu);

  if (voulu !== '') {
    const trouvee = candidates.find(
      (element) => SocleTexte.comparable(element.getTitle()) === voulu);
    if (trouvee) return trouvee;

    const grilles = formulaire.getItems().filter((element) => (
      element.getType() === FormApp.ItemType.GRID
      || element.getType() === FormApp.ItemType.CHECKBOX_GRID));
    const estUneGrille = grilles.some(
      (element) => SocleTexte.comparable(element.getTitle()) === voulu);

    if (estUneGrille) {
      throw SocleErreurs.erreur({
        quoi: `« ${titreVoulu} » est une grille, et le limiteur ne sait pas piloter `
          + 'les grilles.',
        quoiFaire: 'Remplacez la grille par une liste déroulante, un choix '
          + 'multiple ou des cases à cocher — une question dont chaque créneau '
          + 'est une option.',
      });
    }
    throw SocleErreurs.erreur({
      quoi: `Aucune question à choix ne s’intitule « ${titreVoulu} » dans le formulaire.`,
      quoiFaire: candidates.length === 0
        ? 'Ajoutez au formulaire une question de type liste, choix multiple ou '
          + 'cases à cocher, dont chaque option est un créneau.'
        : `Corrigez le réglage « Question des créneaux (titre exact) ». Questions `
          + `à choix présentes : ${candidates.map((e) => `« ${e.getTitle()} »`).join(', ')}.`,
    });
  }

  if (candidates.length === 1) return candidates[0];

  if (candidates.length === 0) {
    throw SocleErreurs.erreur({
      quoi: 'Le formulaire ne contient aucune question à choix.',
      quoiFaire: 'Ajoutez-y une question de type liste déroulante, choix multiple '
        + 'ou cases à cocher, dont chaque option est un créneau, puis relancez.',
    });
  }
  throw SocleErreurs.erreur({
    quoi: `Le formulaire contient ${candidates.length} questions à choix : `
      + `${candidates.map((e) => `« ${e.getTitle()} »`).join(', ')}.`,
    quoiFaire: 'Renseignez le réglage « Question des créneaux (titre exact) » avec '
      + 'le titre de celle qui porte les créneaux.',
  });
};

/**
 * Refuse de toucher à une question dont un choix commande la navigation.
 *
 * `getGotoPage()` n'existe que sur les questions à choix unique ; sur les
 * autres, l'appel n'a pas lieu. On teste la présence de la méthode plutôt que
 * le type, pour ne pas dépendre d'une correspondance type/méthode que Google
 * pourrait étendre.
 */
const limiteurVerifierLaNavigation_ = (question, titre) => {
  const choix = question.getChoices();
  const navigants = choix.filter((un) => {
    if (typeof un.getPageNavigationType !== 'function') return false;
    return !!un.getPageNavigationType();
  });
  if (navigants.length === 0) return;

  throw SocleErreurs.erreur({
    quoi: `Dans « ${titre} », ${navigants.length} option(s) commandent un saut de `
      + 'section ; les retirer et les remettre effacerait ces sauts.',
    quoiFaire: 'Retirez la navigation par section de cette question (chaque option '
      + 'doit rester sur « Passer à la section suivante »), ou séparez les '
      + 'créneaux dans une question distincte, sans navigation.',
  });
};

/** Les libellés actuellement proposés, en Map clé comparable → libellé exact. */
const limiteurLibellesDuFormulaire_ = (question) => {
  const map = new Map();
  question.getChoices().forEach((un) => {
    const libelle = SocleTexte.normaliserEspaces(un.getValue());
    if (libelle !== '') map.set(SocleTexte.comparable(libelle), libelle);
  });
  return map;
};

/**
 * Pose la liste des options, en préservant l'option « Autre ».
 *
 * Rien n'est écrit si la liste est déjà la bonne : chaque écriture est une
 * révision du formulaire, et une synchronisation par soumission en produirait
 * des centaines sans rien changer.
 */
const limiteurPoserLesChoix_ = (question, libelles) => {
  const actuels = question.getChoices().map((un) => un.getValue());
  const identiques = actuels.length === libelles.length
    && actuels.every((valeur, rang) => valeur === libelles[rang]);
  if (identiques) return { pose: false };

  if (libelles.length === 0) {
    throw SocleErreurs.erreur({
      quoi: 'Une question à choix ne peut pas rester sans aucune option.',
      quoiFaire: 'Cas normalement traité en fermant le formulaire. Si ce message '
        + 'apparaît, signalez-le : la fermeture n’a pas eu lieu.',
    });
  }

  const avaitAutre = typeof question.hasOtherOption === 'function'
    && question.hasOtherOption();
  question.setChoiceValues(libelles);
  if (avaitAutre && typeof question.showOtherOption === 'function') {
    question.showOtherOption(true);
  }
  return { pose: true, options: libelles.length };
};

/**
 * Ouvre ou ferme le formulaire selon qu'il reste ou non des places.
 *
 * On ne rouvre que ce qu'on a soi-même fermé. Un formulaire fermé à la main
 * l'a été pour une raison qui n'appartient pas au code — fin des inscriptions,
 * erreur à corriger — et une réouverture automatique la défairait.
 */
const limiteurAjusterLOuverture_ = (formulaire, resteDesPlaces, messageDeFermeture) => {
  const memoire = limiteurMemoire_();
  const fermeParLOutil = memoire.getProperty(LIMITEUR_MEMOIRE_FERMETURE_) === 'oui';
  const ouvert = formulaire.isAcceptingResponses();

  if (!resteDesPlaces && ouvert) {
    if (String(messageDeFermeture ?? '').trim() !== '') {
      formulaire.setCustomClosedFormMessage(String(messageDeFermeture));
    }
    formulaire.setAcceptingResponses(false);
    memoire.setProperty(LIMITEUR_MEMOIRE_FERMETURE_, 'oui');
    return { change: true, ouvert: false, raison: 'tous les créneaux sont complets' };
  }

  if (resteDesPlaces && !ouvert && fermeParLOutil) {
    formulaire.setAcceptingResponses(true);
    memoire.deleteProperty(LIMITEUR_MEMOIRE_FERMETURE_);
    return { change: true, ouvert: true, raison: 'une place s’est libérée' };
  }

  if (resteDesPlaces && ouvert && fermeParLOutil) {
    // Quelqu'un a rouvert à la main entre-temps : on oublie notre drapeau,
    // sans quoi la prochaine réouverture se croirait légitime à tort.
    memoire.deleteProperty(LIMITEUR_MEMOIRE_FERMETURE_);
  }

  return {
    change: false,
    ouvert,
    // Fermé sans que ce soit nous : on le dit dans tous les cas. Sans ce mot,
    // un formulaire qui n'accepte plus rien passe pour une panne de l'outil.
    raison: (!ouvert && !fermeParLOutil) ? 'formulaire fermé à la main, laissé tel quel' : '',
  };
};

// ===========================================================================
// Installation.gs
// ===========================================================================

/**
 * Limiteur de créneaux — installation dans un classeur.
 * Introduit en v0.1.
 *
 * L'installation est **rejouable** : la relancer sur un classeur déjà installé
 * complète ce qui manque et ne touche à rien d'autre. C'est la seule façon de
 * livrer une version nouvelle à quelqu'un qui a déjà rempli ses onglets.
 */

const LIMITEUR_DECLENCHEUR_ = 'surSoumissionDuFormulaire';

/** L'onglet d'aide, parce qu'un outil s'explique là où l'on s'en sert. */
const LIMITEUR_AIDE_ = [
  ['À quoi sert cet outil',
    'Il retire du formulaire les créneaux dont toutes les places sont prises, '
    + 'et les remet si une place se libère.'],
  ['Ce qu’il ne peut pas faire',
    'Empêcher une inscription de trop. Le formulaire déjà ouvert dans le '
    + 'navigateur de quelqu’un affiche encore l’ancienne liste : cette personne '
    + 'peut envoyer sa réponse, et Google l’accepte. L’outil le détecte à la '
    + 'réception, le note dans le Journal et prévient la personne.'],
  ['Comment réduire les dépassements',
    'Augmentez la colonne « Marge » : à 1, le créneau est retiré du formulaire '
    + 'quand il reste encore une place libre.'],
  ['Rendre une place',
    'Supprimez la ligne de la personne dans la feuille des réponses, puis '
    + 'lancez « Recompter et mettre à jour le formulaire ». Le créneau '
    + 'réapparaît tout seul.'],
  ['Fermer un créneau à la main',
    'Écrivez « Fermé à la main » dans sa colonne « État ». L’outil ne le '
    + 'rouvrira jamais de lui-même ; effacez cette mention pour le rendre.'],
  ['Un créneau sans capacité',
    'Tant que la colonne « Places » est vide, le créneau reste proposé et '
    + 'n’est jamais retiré : l’outil ne devine pas une capacité que personne '
    + 'n’a décidée.'],
  ['Ne triez pas la feuille des réponses',
    'Le rang de chaque personne se lit dans l’ordre des lignes. Trier la '
    + 'feuille change cet ordre, donc déplace la frontière entre les personnes '
    + 'retenues et celles en liste d’attente. Pour regarder les données '
    + 'autrement, utilisez un filtre plutôt qu’un tri.'],
  ['Le formulaire s’est fermé tout seul',
    'C’est normal quand tous les créneaux sont complets : une question à choix '
    + 'ne peut pas rester sans aucune option. Il se rouvrira de lui-même dès '
    + 'qu’une place se libérera.'],
  ['Où voir ce qui s’est passé',
    'L’onglet « Journal » porte une ligne par créneau et par inscription : le '
    + 'rang obtenu, le verdict, et si un courriel est parti.'],
];

/** La liste des états, telle que la validation de l'onglet doit l'accepter. */
const limiteurEtatsAttendus_ = () => Object.keys(LIMITEUR_ETATS_)
  .map((clef) => LIMITEUR_ETATS_[clef]);

/**
 * Remet la liste déroulante de la colonne « État » en accord avec les états que
 * le code sait écrire.
 *
 * **Appelée à chaque synchronisation, et pas seulement à l'installation.** Une
 * version qui ajoute un état laisserait sinon tous les classeurs déjà installés
 * afficher « Non valide » sur des valeurs que le code vient lui-même d'écrire —
 * un tableau qui se contredit, et rien pour dire qu'il suffit de réinstaller.
 * Payé le 18 septembre 2026 en ajoutant « Complet par la marge ».
 *
 * On relit la validation avant de la reposer : en régime permanent elle est
 * juste, et l'écriture n'a donc lieu qu'une fois après une mise à jour.
 */
const limiteurAjusterLaValidationDesEtats_ = (table) => {
  const attendus = limiteurEtatsAttendus_();
  if (!('État' in table.index)) return { repose: false, raison: 'colonne absente' };
  const position = table.index['État'] + 1;

  const actuelle = SocleErreurs.absorber('lecture de la validation des états',
    () => {
      const regle = table.feuille.getRange(2, position).getDataValidation();
      return regle ? regle.getCriteriaValues()[0] : null;
    }, null);

  const aJour = Array.isArray(actuelle)
    && attendus.every((un) => actuelle.indexOf(un) >= 0);
  if (aJour) return { repose: false, raison: 'déjà à jour' };

  SocleFeuilles.listeSurColonne(LIMITEUR_ONGLET_CRENEAUX_, 'État', attendus);
  return { repose: true, etats: attendus.length };
};

/** Les colonnes que le code calcule, et auxquelles l'utilisateur ne touche pas. */
const limiteurPoserLOngletDesCreneaux_ = () => {
  const { cree } = SocleFeuilles.onglet(LIMITEUR_ONGLET_CRENEAUX_);
  if (cree) {
    SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_CRENEAUX_, LIMITEUR_COLONNES_CRENEAUX_, []);
  } else {
    // Additif : une colonne née d'une version nouvelle doit apparaître aussi
    // chez ceux qui ont déjà rempli leur onglet, et ce sont eux qui en ont
    // besoin.
    SocleFeuilles.completerColonnes(LIMITEUR_ONGLET_CRENEAUX_, LIMITEUR_COLONNES_CRENEAUX_);
  }
  SocleFeuilles.listeSurColonne(LIMITEUR_ONGLET_CRENEAUX_, 'État', limiteurEtatsAttendus_());
  return { cree };
};

const limiteurPoserLOngletDuJournal_ = () => {
  const { cree } = SocleFeuilles.onglet(LIMITEUR_ONGLET_JOURNAL_);
  if (cree) {
    SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_JOURNAL_, LIMITEUR_COLONNES_JOURNAL_, []);
  } else {
    SocleFeuilles.completerColonnes(LIMITEUR_ONGLET_JOURNAL_, LIMITEUR_COLONNES_JOURNAL_);
  }
  return { cree };
};

const limiteurPoserLesReglages_ = () => {
  const { cree } = SocleFeuilles.onglet(LIMITEUR_ONGLET_REGLAGES_);
  if (cree) {
    SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_REGLAGES_, ['Réglage', 'Valeur'], []);
  }
  const poses = SocleFeuilles.completerReglages(
    LIMITEUR_ONGLET_REGLAGES_, LIMITEUR_REGLAGES_PAR_DEFAUT_);

  // Ensemble fermé : on bloque. Une liste ouverte se contenterait d'avertir.
  SocleFeuilles.listeSurReglage(LIMITEUR_ONGLET_REGLAGES_, 'Envoyer une confirmation',
    ['Oui', 'Non'], { bloquant: true });
  SocleFeuilles.nombreSurReglage(LIMITEUR_ONGLET_REGLAGES_, 'Marge par défaut', 0, 50);
  return poses;
};

const limiteurPoserLAide_ = () => {
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_AIDE_, ['Question', 'Réponse']);
  const { cree } = SocleFeuilles.onglet(LIMITEUR_ONGLET_AIDE_);
  // Réécrit à chaque installation, contrairement aux autres onglets : l'aide
  // appartient au code, pas à l'utilisateur, et une aide périmée est pire que
  // pas d'aide.
  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_AIDE_, ['Question', 'Réponse'],
    LIMITEUR_AIDE_);
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_AIDE_);
  feuille.setColumnWidth(1, 260);
  feuille.setColumnWidth(2, 640);
  return { cree };
};

/**
 * Pose le déclencheur de soumission, après avoir retiré les siens.
 *
 * Un déclencheur **installable** est obligatoire : le `onFormSubmit` simple
 * n'a pas le droit de modifier un formulaire ni d'envoyer un courriel. Il
 * s'exécutera donc sous l'identité de qui l'installe, ce qui est ici correct —
 * c'est l'organisateur qui arbitre les places, pas les répondants.
 *
 * Sur le **classeur** et non sur le formulaire : ainsi la ligne de la réponse
 * est déjà écrite quand le déclencheur part, et le comptage la voit.
 */
const limiteurPoserLeDeclencheur_ = () => {
  const retires = SocleExecution.retirerReprise(LIMITEUR_DECLENCHEUR_);
  ScriptApp.newTrigger(LIMITEUR_DECLENCHEUR_)
    .forSpreadsheet(limiteurClasseur_())
    .onFormSubmit()
    .create();
  return { retires };
};

/** Installe ou met à jour, puis synchronise une première fois. */
const limiteurInstaller_ = () => {
  // Tous les refus d'abord : un classeur à moitié installé est pire qu'un
  // classeur pas installé, parce qu'on ne sait plus où l'on en est.
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_AIDE_, ['Question', 'Réponse']);
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_VERIFICATION_,
    LIMITEUR_COLONNES_VERIFICATION_);
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_LISTES_, LIMITEUR_LISTES_AVANT_);

  const creneaux = limiteurPoserLOngletDesCreneaux_();
  const journal = limiteurPoserLOngletDuJournal_();
  const reglages = limiteurPoserLesReglages_();
  const aide = limiteurPoserLAide_();
  const retirees = SocleFeuilles.retirerFeuilleParDefaut();
  const declencheur = limiteurPoserLeDeclencheur_();

  // La première synchronisation adopte les créneaux déjà présents dans le
  // formulaire : l'utilisateur n'a plus qu'à renseigner les capacités.
  const bilan = limiteurSynchroniser_();
  // Après la synchronisation : les couleurs se posent sur des colonnes qui
  // doivent déjà exister, et les notes sur un en-tête déjà écrit.
  const apparence = limiteurHabillerTout_();

  return { creneaux, journal, reglages, aide, retirees, declencheur, bilan, apparence };
};

// ===========================================================================
// Limiteur.gs
// ===========================================================================

/**
 * Limiteur de créneaux — le référentiel, le comptage et le verdict.
 * Introduit en v0.1.
 *
 * Ce module ne touche jamais au formulaire : il dit seulement ce qui est pris,
 * ce qui reste et ce qu'il faudrait afficher. `Formulaire.gs` applique.
 *
 * ── Ce qu'il faut avoir compris avant de le modifier ────────────────────────
 *
 * **Le référentiel fait foi, pas le formulaire.** Une option retirée du
 * formulaire n'y existe plus du tout : si la liste des créneaux ne vivait que
 * là, une place libérée serait irrécupérable — on ne saurait plus quel libellé
 * remettre, ni à quelle position. L'onglet « Créneaux » garde donc la liste
 * complète et son ordre ; le formulaire n'en est qu'un reflet, reconstruit à
 * chaque synchronisation.
 *
 * **Le comptage se fait sur la feuille des réponses, et c'est voulu.** Elle
 * est modifiable : supprimer la ligne d'une personne qui se décommande rend sa
 * place. Compter sur `form.getResponses()` donnerait un total que personne ne
 * pourrait corriger sans passer par l'interface du formulaire.
 *
 * **Le rang vient du numéro de ligne.** Le formulaire ajoute en bas, donc
 * l'ordre des lignes est l'ordre d'arrivée. Trier la feuille des réponses
 * change les rangs et peut donc déplacer la frontière entre les personnes
 * retenues et celles en dépassement — c'est dit dans l'onglet d'aide.
 */

const LIMITEUR_VERSION_ = '1.2.0';

/**
 * Combien de temps une soumission attend le verrou avant d'abandonner.
 *
 * Un traitement dure quelques secondes : vingt-cinq suffisent à absorber deux
 * ou trois soumissions arrivées ensemble. Au-delà, on abandonne — mais on le
 * DIT, parce qu'une réponse abandonnée ne reçoit jamais de verdict.
 *
 * Bien sous le plafond de six minutes par exécution, qui vaut pour tous les
 * types de compte.
 */
const LIMITEUR_ATTENTE_VERROU_MS_ = 25 * 1000;

const LIMITEUR_ONGLET_CRENEAUX_ = 'Créneaux';
const LIMITEUR_ONGLET_JOURNAL_ = 'Journal';
const LIMITEUR_ONGLET_REGLAGES_ = 'Réglages';
const LIMITEUR_ONGLET_AIDE_ = 'Aide';

const LIMITEUR_COLONNES_CRENEAUX_ = ['Créneau', 'Places', 'Marge', 'Pris', 'Restant',
  'État', 'Dernier comptage'];

const LIMITEUR_COLONNES_JOURNAL_ = ['Horodatage', 'Ligne', 'Créneau', 'Rang', 'Places',
  'Verdict', 'Destinataire', 'Courriel', 'Ce qui a échoué'];

/**
 * Les états d'un créneau.
 *
 * `ferme` et `sansCapacite` sont des décisions — l'une humaine, l'autre une
 * omission — et le code ne les défait jamais. Les trois autres se recalculent
 * à chaque synchronisation.
 */
const LIMITEUR_ETATS_ = {
  ouvert: 'Ouvert',
  complet: 'Complet',
  // Distingué de « Complet », et il le faut : un créneau fermé par la marge
  // affiche encore des places restantes. « Restant 1 » à côté de « Complet » se
  // lit comme une contradiction, et envoie chercher un défaut de calcul.
  completParMarge: 'Complet par la marge',
  ferme: 'Fermé à la main',
  sansCapacite: 'Sans capacité',
};

const LIMITEUR_VERDICTS_ = {
  acceptee: 'Acceptée',
  surreservation: 'Surréservation',
  horsReferentiel: 'Hors référentiel',
  sansCapacite: 'Sans capacité',
  echec: 'Échec',
  nonTraitee: 'Non traitée',
};

const LIMITEUR_REGLAGES_PAR_DEFAUT_ = {
  'Question des créneaux (titre exact)': '',
  'Colonne du créneau dans les réponses': '',
  'Colonne de l’adresse e-mail': 'Adresse e-mail',
  // Vide : toutes les colonnes des réponses sauf l'horodatage et le créneau.
  // On ne sait pas quelles questions le formulaire pose, et deviner laquelle
  // porte l'identité reviendrait à en perdre une.
  'Colonnes à reprendre dans les listes': '',
  'Envoyer une confirmation': 'Non',
  'Objet de la confirmation': 'Votre créneau est confirmé',
  'Destinataire des alertes': '',
  'Marge par défaut': 0,
  'Message à la fermeture du formulaire': 'Tous les créneaux sont complets. '
    + 'Merci de votre intérêt.',
};

// ---------------------------------------------------------------------------
// Lecture du contexte
// ---------------------------------------------------------------------------

/** Le classeur courant, isolé pour que le banc puisse le remplacer. */
const limiteurClasseur_ = () => SpreadsheetApp.getActive();

/**
 * Le magasin de propriétés, pour mémoriser ce que l'outil a lui-même décidé.
 *
 * Règle du socle : tout `get…()` de service est suspect de rendre `null` avant
 * d'être suspect de lever. `getDocumentProperties()` rend `null` dans un
 * projet autonome ; on retombe alors sur le magasin de script, qui est
 * partagé mais suffisant pour un unique drapeau.
 */
const limiteurMemoire_ = () => PropertiesService.getDocumentProperties()
  || PropertiesService.getScriptProperties();

/**
 * La feuille où le formulaire déverse ses réponses, trouvée par son lien et
 * non par son nom.
 *
 * « Réponses au formulaire 1 » se renomme, se traduit, et change selon la
 * langue du compte qui a créé le classeur. `getFormUrl()` ne ment pas : il
 * rend `null` sur toute feuille qui n'est pas liée.
 */
const limiteurFeuilleDesReponses_ = () => {
  const liees = limiteurClasseur_().getSheets()
    .filter((feuille) => !!feuille.getFormUrl());

  if (liees.length === 0) {
    throw SocleErreurs.erreur({
      quoi: 'Aucune feuille de ce classeur ne reçoit les réponses d’un formulaire.',
      quoiFaire: 'Ouvrez le formulaire, onglet « Réponses », et liez-le à ce '
        + 'classeur ; ou lancez le limiteur depuis le classeur qui reçoit '
        + 'déjà les réponses.',
    });
  }
  if (liees.length > 1) {
    throw SocleErreurs.erreur({
      quoi: `Ce classeur reçoit les réponses de ${liees.length} formulaires : `
        + `${liees.map((f) => f.getName()).join(', ')}.`,
      quoiFaire: 'Le limiteur ne sait en piloter qu’un. Déplacez les autres '
        + 'formulaires vers leur propre classeur.',
    });
  }
  return liees[0];
};

/** Les réglages, complétés de leurs valeurs par défaut manquantes. */
const limiteurReglages_ = () => {
  const lus = SocleFeuilles.lireReglages(LIMITEUR_ONGLET_REGLAGES_);
  const sortie = {};
  Object.keys(LIMITEUR_REGLAGES_PAR_DEFAUT_).forEach((cle) => {
    const valeur = lus[cle];
    sortie[cle] = (valeur === undefined || String(valeur).trim() === '')
      ? LIMITEUR_REGLAGES_PAR_DEFAUT_[cle]
      : valeur;
  });
  return sortie;
};

/** « Oui » sous toutes ses formes, y compris la case à cocher de Sheets. */
const limiteurEstOui_ = (valeur) => {
  if (valeur === true) return true;
  const texte = SocleTexte.comparable(valeur);
  return texte === 'oui' || texte === 'yes' || texte === 'vrai' || texte === 'true';
};

/** Un entier positif, ou `null` quand la cellule ne dit rien d'exploitable. */
const limiteurEntier_ = (valeur) => {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre) || !Number.isInteger(nombre) || nombre < 0) return null;
  return nombre;
};

// ---------------------------------------------------------------------------
// Le référentiel
// ---------------------------------------------------------------------------

/**
 * Lit l'onglet « Créneaux » en une liste ordonnée.
 *
 * L'ordre des lignes est l'ordre d'affichage dans le formulaire : c'est la
 * seule chose qui permette de remettre une option retirée à sa place.
 */
const limiteurLireReferentiel_ = (margeParDefaut = 0, onglet = LIMITEUR_ONGLET_CRENEAUX_) => {
  const table = SocleFeuilles.lireTable(onglet);
  if (table.lignes.length === 0) return { table, creneaux: [] };

  SocleFeuilles.colonne(table, 'Créneau');
  SocleFeuilles.colonne(table, 'Places');

  const creneaux = table.lignes
    .map((ligne) => ({
      libelle: SocleTexte.normaliserEspaces(ligne['Créneau']),
      cle: SocleTexte.comparable(ligne['Créneau']),
      places: limiteurEntier_(ligne.Places),
      // Une marge propre au créneau l'emporte sur le réglage général ; zéro se
      // distingue d'une cellule vide, sans quoi on ne pourrait jamais annuler
      // la marge par défaut sur un seul créneau.
      marge: limiteurEntier_(ligne.Marge) === null ? margeParDefaut : limiteurEntier_(ligne.Marge),
      etatLu: SocleTexte.normaliserEspaces(ligne['État']),
      numero: ligne.numero,
    }))
    .filter((creneau) => creneau.libelle !== '');

  return { table, creneaux };
};

/**
 * Rapproche le contenu d'une cellule de réponse des créneaux du référentiel.
 *
 * Une question à cases à cocher rend « Mardi 14 h, Jeudi 9 h » : une seule
 * cellule, plusieurs choix, séparés par une virgule et une espace. Or un
 * libellé peut lui-même contenir une virgule — « Mardi 14 h, salle A » —, et
 * découper à l'aveugle compterait deux créneaux inexistants là où il y en a un.
 *
 * On ne devine donc pas : on teste le texte entier, puis chaque fragment. Le
 * cas ambigu — un libellé à virgule dans une question à cases — est refusé en
 * amont par `limiteurVerifierLesLibelles_`, parce qu'un comptage faux et
 * silencieux coûte plus cher qu'un refus visible.
 */
const limiteurCreneauxDeLaCellule_ = (cellule, parCle) => {
  const texte = SocleTexte.normaliserEspaces(cellule);
  if (texte === '') return [];

  const entier = parCle[SocleTexte.comparable(texte)];
  if (entier) return [entier];

  return texte.split(',')
    .map((fragment) => parCle[SocleTexte.comparable(fragment)])
    .filter((creneau) => !!creneau);
};

/**
 * Refuse les libellés qui rendraient le comptage ambigu.
 *
 * Ne vaut que pour les cases à cocher : ailleurs, la cellule porte un seul
 * libellé et la virgule ne gêne personne.
 */
const limiteurVerifierLesLibelles_ = (creneaux, multiple) => {
  if (!multiple) return;
  const fautifs = creneaux.filter((creneau) => creneau.libelle.indexOf(',') >= 0);
  if (fautifs.length === 0) return;
  throw SocleErreurs.erreur({
    quoi: `La question accepte plusieurs choix, et ${fautifs.length} créneau(x) `
      + `contiennent une virgule : ${fautifs.map((c) => `« ${c.libelle} »`).join(', ')}.`,
    quoiFaire: 'Google sépare les choix multiples par une virgule : ces libellés '
      + 'seraient comptés de travers. Remplacez la virgule par un tiret dans '
      + 'le formulaire et dans l’onglet « Créneaux », puis relancez.',
  });
};

// ---------------------------------------------------------------------------
// Le comptage
// ---------------------------------------------------------------------------

/**
 * Compte les réservations par créneau, et rend aussi le rang de chaque ligne.
 *
 * Le rang — « vous êtes la 9ᵉ personne sur ce créneau » — est ce qui rend le
 * verdict stable : il ne dépend que de l'ordre des lignes, donc recompter plus
 * tard redonne le même résultat, et une personne acceptée ne se retrouve
 * jamais rétrogradée par l'arrivée d'une suivante.
 */
const limiteurCompter_ = (creneaux, options = {}) => {
  const feuille = options.feuilleDesReponses || limiteurFeuilleDesReponses_();
  const table = SocleFeuilles.lireTable(feuille);
  const colonne = options.colonne;

  if (table.lignes.length > 0) SocleFeuilles.colonne(table, colonne);

  const parCle = {};
  creneaux.forEach((creneau) => { parCle[creneau.cle] = creneau; });

  const comptes = {};
  const rangs = {};
  const inconnus = {};
  creneaux.forEach((creneau) => { comptes[creneau.cle] = 0; });

  table.lignes.forEach((ligne) => {
    const trouves = limiteurCreneauxDeLaCellule_(ligne[colonne], parCle);

    if (trouves.length === 0) {
      const texte = SocleTexte.normaliserEspaces(ligne[colonne]);
      // Une cellule vide n'est pas un créneau inconnu : c'est une question
      // laissée sans réponse, et la confondre avec une erreur de libellé
      // enverrait le gestionnaire chercher une faute qui n'existe pas.
      if (texte !== '') inconnus[texte] = (inconnus[texte] || 0) + 1;
      return;
    }

    trouves.forEach((creneau) => {
      comptes[creneau.cle] += 1;
      rangs[`${ligne.numero}|${creneau.cle}`] = comptes[creneau.cle];
    });
  });

  return { comptes, rangs, inconnus, table, lignes: table.lignes.length };
};

/**
 * Décide de l'état de chaque créneau à partir des comptes.
 *
 * La marge ferme le créneau avant la dernière place. Elle existe parce que le
 * retrait d'une option arrive toujours en retard — voir le README, section
 * « Ce que ce module ne peut pas faire ».
 */
const limiteurEtatDesCreneaux_ = (creneaux, comptes) => creneaux
  .map((creneau) => {
    const pris = comptes[creneau.cle] || 0;
    const restant = creneau.places === null ? null : Math.max(creneau.places - pris, 0);

    let etat;
    if (creneau.etatLu === LIMITEUR_ETATS_.ferme) etat = LIMITEUR_ETATS_.ferme;
    else if (creneau.places === null) etat = LIMITEUR_ETATS_.sansCapacite;
    else if (pris >= creneau.places) etat = LIMITEUR_ETATS_.complet;
    else if (pris + creneau.marge >= creneau.places) etat = LIMITEUR_ETATS_.completParMarge;
    else etat = LIMITEUR_ETATS_.ouvert;

    return {
      ...creneau,
      pris,
      restant,
      etat,
      // « Sans capacité » reste affiché : ne rien décider, c'est laisser
      // ouvert, et retirer l'option punirait l'oubli d'une capacité.
      aAfficher: etat === LIMITEUR_ETATS_.ouvert || etat === LIMITEUR_ETATS_.sansCapacite,
    };
  });

/** Réécrit les seules colonnes calculées, ligne par ligne, en un bloc. */
const limiteurEcrireReferentiel_ = (table, evalues) => {
  if (evalues.length === 0) return;
  const feuille = table.feuille;
  const maintenant = SocleDates.maintenantHorodatage();

  const debut = SocleFeuilles.colonne(table, 'Pris');
  const fin = SocleFeuilles.colonne(table, 'Dernier comptage');
  // Les quatre colonnes calculées se suivent : une seule plage, une seule
  // écriture. Si quelqu'un les sépare un jour, ce contrôle le dira tout de
  // suite plutôt que d'écraser une colonne voisine.
  if (fin - debut !== 3) {
    throw SocleErreurs.erreur({
      quoi: 'Les colonnes calculées de l’onglet « Créneaux » ne se suivent plus.',
      quoiFaire: 'Remettez « Pris », « Restant », « État » et « Dernier comptage » '
        + 'côte à côte dans cet ordre, ou relancez l’installation.',
    });
  }

  const premiere = evalues[0].numero;
  const contigues = evalues.every((c, rang) => c.numero === premiere + rang);
  const valeurs = evalues.map((creneau) => [
    creneau.pris,
    creneau.restant === null ? '' : creneau.restant,
    creneau.etat,
    maintenant,
  ]);

  if (contigues) {
    feuille.getRange(premiere, debut + 1, valeurs.length, 4).setValues(valeurs);
    return;
  }
  // Des lignes vides intercalées cassent la contiguïté. Rare, mais une
  // écriture en bloc décalerait alors tout le monde d'un cran.
  evalues.forEach((creneau, rang) => {
    feuille.getRange(creneau.numero, debut + 1, 1, 4).setValues([valeurs[rang]]);
  });
};

/** Ajoute au référentiel les options vues dans le formulaire et inconnues de lui. */
const limiteurAdopterLesNouveaux_ = (creneaux, libellesDuFormulaire) => {
  const connus = new Set(creneaux.map((creneau) => creneau.cle));
  const nouveaux = [];
  libellesDuFormulaire.forEach((libelle, cle) => {
    if (!connus.has(cle)) nouveaux.push(libelle);
  });
  if (nouveaux.length === 0) return { ajoutes: [] };

  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_CRENEAUX_);
  const depart = Math.max(feuille.getLastRow(), 1) + 1;
  // Places laissée vide, délibérément : une capacité inventée par le code
  // serait appliquée sans que personne ne l'ait décidée. L'état « Sans
  // capacité » demande l'arbitrage humain, et le dit dans l'onglet.
  const lignes = nouveaux.map((libelle) => [libelle, '', '', 0, '',
    LIMITEUR_ETATS_.sansCapacite, '']);
  feuille.getRange(depart, 1, lignes.length, LIMITEUR_COLONNES_CRENEAUX_.length)
    .setValues(lignes);
  return { ajoutes: nouveaux };
};

// ---------------------------------------------------------------------------
// Le journal
// ---------------------------------------------------------------------------

/**
 * Refuse d'écraser un onglet qui appartient à quelqu'un d'autre.
 *
 * Trois onglets sont **réécrits en entier** à chaque fois — « Aide »,
 * « Vérification » et « Listes » —, parce qu'ils appartiennent au code et non à
 * l'utilisateur. Sur un classeur neuf c'est sans conséquence ; sur un classeur
 * métier qui porterait déjà un onglet de ce nom, c'est une perte de travail, et
 * elle serait silencieuse.
 *
 * Le critère est l'en-tête : un onglet vide, absent, ou dont la première ligne
 * est celle qu'on écrit soi-même est le nôtre. Tout le reste appartient à
 * quelqu'un, et se renomme — ce n'est pas au code d'en décider.
 */
const limiteurExigerOngletANous_ = (nom, entete) => {
  const feuille = limiteurClasseur_().getSheetByName(nom);
  if (!feuille || feuille.getLastRow() === 0) return { notre: true, vide: true };

  const largeur = Math.max(feuille.getLastColumn(), 1);
  const presente = feuille.getRange(1, 1, 1, largeur).getValues()[0]
    .map((une) => SocleTexte.normaliserEspaces(une));
  const notre = entete.every((attendu, rang) => presente[rang] === attendu);
  if (notre) return { notre: true, vide: false };

  throw SocleErreurs.erreur({
    quoi: `L'onglet « ${nom} » existe déjà dans ce classeur, et il ne vient pas du `
      + `limiteur : sa première ligne porte `
      + `« ${presente.filter((une) => une !== '').join(', ')} ».`,
    quoiFaire: `Le limiteur réécrit entièrement l'onglet « ${nom} » à chaque fois, `
      + 'et effacerait donc ce qu’il contient. Renommez l’onglet existant, puis '
      + 'relancez — rien n’a été modifié.',
  });
};

/** Ajoute une ligne au journal, sans jamais en réécrire une ancienne. */
const limiteurJournaliser_ = (entree) => {
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_JOURNAL_);
  const ligne = LIMITEUR_COLONNES_JOURNAL_.map((nom) => (entree[nom] === undefined
    ? '' : entree[nom]));
  feuille.getRange(Math.max(feuille.getLastRow(), 1) + 1, 1, 1, ligne.length)
    .setValues([ligne]);
  return ligne;
};

// ===========================================================================
// Listes.gs
// ===========================================================================

/**
 * Limiteur de créneaux — les listes par créneau.
 * Introduit en v0.5.
 *
 * La sortie qu'on emporte le jour de la visite : par créneau, les personnes
 * retenues dans leur ordre d'arrivée, puis celles en liste d'attente. Jusqu'ici
 * il fallait filtrer à la main une feuille de réponses où tous les créneaux sont
 * mêlés et triés par horodatage.
 *
 * ── Les deux règles de ce fichier ───────────────────────────────────────────
 *
 * **Personne ne disparaît.** Une réponse dont le libellé ne correspond à aucun
 * créneau connu figure quand même, avec sa valeur brute et le statut « Hors
 * référentiel ». Quelqu'un d'inscrit qui n'apparaîtrait sur aucune liste est le
 * défaut le plus coûteux que ce module puisse avoir : il ne se voit que le jour
 * J, devant la personne.
 *
 * **Un créneau sans inscription figure aussi**, avec « Aucune inscription ».
 * Son absence se lirait « je ne sais pas s'il existe » — et une absence ne doit
 * jamais avoir deux sens.
 *
 * Rien n'est modifié ailleurs : les listes se lisent, elles ne pilotent pas. Le
 * formulaire n'est ouvert que si le réglage ne dit pas déjà quelle colonne des
 * réponses porte le créneau — ainsi elles s'établissent encore le jour où le
 * formulaire a été supprimé.
 */

const LIMITEUR_ONGLET_LISTES_ = 'Listes';

const LIMITEUR_LISTES_AVANT_ = ['Créneau', 'Rang', 'Statut', 'Inscrite le'];
const LIMITEUR_LISTES_APRES_ = ['Ligne'];

const LIMITEUR_STATUTS_ = {
  retenue: 'Retenue',
  attente: 'Liste d’attente',
  sansCapacite: 'Capacité non définie',
  aucune: 'Aucune inscription',
  horsReferentiel: 'Hors référentiel',
};

/**
 * Le nom de la colonne des réponses qui porte le créneau.
 *
 * Le réglage d'abord, et alors on n'ouvre pas le formulaire : le jour de la
 * visite, il peut avoir été fermé, déplacé ou supprimé, et les listes doivent
 * rester établissables.
 */
const limiteurColonneDesCreneaux_ = (reglages, feuille) => {
  const duReglage = SocleTexte.normaliserEspaces(
    reglages['Colonne du créneau dans les réponses']);
  if (duReglage !== '') return duReglage;

  const formulaire = limiteurOuvrirLeFormulaire_(feuille);
  return limiteurTrouverLaQuestion_(
    formulaire, reglages['Question des créneaux (titre exact)']).getTitle();
};

/**
 * Les colonnes des réponses à recopier dans les listes.
 *
 * Par défaut toutes, sauf l'horodatage et le créneau qui ont déjà leur place :
 * on ne sait pas quelles questions le formulaire pose, et deviner laquelle
 * porte l'identité reviendrait à en perdre une. Le réglage permet de restreindre
 * et d'ordonner.
 */
const limiteurColonnesReprises_ = (table, colonneCreneau, reglages) => {
  const voulues = SocleTexte.normaliserEspaces(reglages['Colonnes à reprendre dans les listes']);
  if (voulues !== '') {
    return voulues.split(',')
      .map((nom) => SocleTexte.normaliserEspaces(nom))
      .filter((nom) => nom !== '' && (nom in table.index));
  }
  const horodatage = table.entete[0];
  return table.entete.filter((nom, rang) => nom !== ''
    && rang > 0
    && nom !== horodatage
    && nom !== colonneCreneau);
};

/** Regroupe les rangs par créneau, dans l'ordre d'arrivée. */
const limiteurInscritsParCreneau_ = (comptage) => {
  const parCle = {};
  Object.keys(comptage.rangs).forEach((clef) => {
    const separateur = clef.indexOf('|');
    const cle = clef.slice(separateur + 1);
    parCle[cle] = parCle[cle] || [];
    parCle[cle].push({
      numero: Number(clef.slice(0, separateur)),
      rang: comptage.rangs[clef],
    });
  });
  Object.keys(parCle).forEach((cle) => { parCle[cle].sort((a, b) => a.rang - b.rang); });
  return parCle;
};

/** Le statut d'une inscription : ce que la personne doit savoir. */
const limiteurStatutDe_ = (creneau, rang) => {
  if (creneau.places === null) return LIMITEUR_STATUTS_.sansCapacite;
  return rang <= creneau.places ? LIMITEUR_STATUTS_.retenue : LIMITEUR_STATUTS_.attente;
};

/**
 * Établit les listes, sans rien piloter.
 *
 * L'ordre est celui du référentiel — donc celui d'affichage dans le formulaire
 * — puis le rang. Les réponses sans créneau connu viennent à la fin, où elles
 * sautent aux yeux.
 */
const limiteurEtablirLesListes_ = () => {
  const feuille = limiteurFeuilleDesReponses_();
  const reglages = limiteurReglages_();
  const colonne = limiteurColonneDesCreneaux_(reglages, feuille);

  const margeParDefaut = limiteurEntier_(reglages['Marge par défaut']) || 0;
  const { creneaux } = limiteurLireReferentiel_(margeParDefaut);
  const comptage = limiteurCompter_(creneaux, { feuilleDesReponses: feuille, colonne });
  const evalues = limiteurEtatDesCreneaux_(creneaux, comptage.comptes);

  const table = comptage.table;
  const reprises = limiteurColonnesReprises_(table, colonne, reglages);
  const entete = [...LIMITEUR_LISTES_AVANT_, ...reprises, ...LIMITEUR_LISTES_APRES_];

  const parLigne = {};
  table.lignes.forEach((ligne) => { parLigne[ligne.numero] = ligne; });

  const quand = (ligne) => SocleErreurs.absorber('horodatage d’une inscription',
    () => SocleDates.horodatage(ligne.cellules[0]), '');
  const reste = (ligne) => reprises.map((nom) => {
    const valeur = ligne[nom];
    return valeur === undefined || valeur === null ? '' : valeur;
  });

  const inscrits = limiteurInscritsParCreneau_(comptage);
  const lignes = [];
  let retenues = 0;
  let attentes = 0;

  evalues.forEach((creneau) => {
    const siens = inscrits[creneau.cle] || [];
    if (siens.length === 0) {
      // Un créneau absent des listes se lirait « je ne sais pas s'il existe ».
      lignes.push([creneau.libelle, '', LIMITEUR_STATUTS_.aucune, '',
        ...reprises.map(() => ''), '']);
      return;
    }
    siens.forEach(({ numero, rang }) => {
      const ligne = parLigne[numero];
      if (!ligne) return;
      const statut = limiteurStatutDe_(creneau, rang);
      if (statut === LIMITEUR_STATUTS_.retenue) retenues += 1;
      if (statut === LIMITEUR_STATUTS_.attente) attentes += 1;
      lignes.push([creneau.libelle, rang, statut, quand(ligne), ...reste(ligne), numero]);
    });
  });

  // Les réponses que le comptage n'a rattachées à personne. Les omettre ferait
  // disparaître quelqu'un d'inscrit, et cela ne se verrait que le jour J.
  const parCle = {};
  creneaux.forEach((creneau) => { parCle[creneau.cle] = creneau; });
  const orphelines = table.lignes.filter((ligne) => {
    const texte = SocleTexte.normaliserEspaces(ligne[colonne]);
    return texte !== '' && limiteurCreneauxDeLaCellule_(ligne[colonne], parCle).length === 0;
  });

  orphelines.forEach((ligne) => {
    lignes.push([SocleTexte.normaliserEspaces(ligne[colonne]), '',
      LIMITEUR_STATUTS_.horsReferentiel, quand(ligne), ...reste(ligne), ligne.numero]);
  });

  return {
    entete,
    lignes,
    reprises,
    colonne,
    resume: {
      creneaux: evalues.length,
      retenues,
      attentes,
      horsReferentiel: orphelines.length,
      sansInscription: evalues.filter((un) => (inscrits[un.cle] || []).length === 0).length,
    },
  };
};

/** Écrit les listes dans leur onglet, qui appartient au code et se réécrit. */
const limiteurEcrireLesListes_ = (bilan) => {
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_LISTES_, LIMITEUR_LISTES_AVANT_);
  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_LISTES_, bilan.entete, bilan.lignes);
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_LISTES_);
  feuille.setColumnWidth(1, 180);
  feuille.setColumnWidth(2, 60);
  feuille.setColumnWidth(3, 130);
  feuille.setColumnWidth(4, 150);
  limiteurHabiller_(LIMITEUR_ONGLET_LISTES_);
  return { lignes: bilan.lignes.length };
};

// ===========================================================================
// Menu.gs
// ===========================================================================

/**
 * Limiteur de créneaux — les points d'entrée.
 * Introduit en v0.1.
 *
 * **Tout ce qui est ici est une `function` déclarée, et rien d'autre ne l'est
 * dans le projet.** L'éditeur Apps Script ne propose au menu d'exécution que
 * les `function` déclarées : la séparation entre ce qui se lance et ce qui est
 * interne se lit donc dans la forme du code, et l'on ne lance plus par mégarde
 * une fonction interne à la place du point d'entrée.
 *
 * `onOpen` et `surSoumissionDuFormulaire` n'ont de toute façon pas le choix :
 * un déclencheur résout sa cible par son nom global, et une `const` de portée
 * globale n'est jamais une propriété de l'objet global.
 */

/** Le menu. Déclencheur simple : il apparaît sans que personne n'installe rien. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Créneaux')
    .addItem('Recompter et mettre à jour le formulaire', 'synchroniserLesCreneaux')
    .addItem('Où en sont les créneaux ?', 'afficherLEtatDesCreneaux')
    .addItem('Vérifier mon installation', 'verifierMonInstallation')
    .addItem('Établir les listes', 'etablirLesListes')
    .addSeparator()
    .addItem('Voir un exemple', 'voirUnExemple')
    .addItem('Retirer l’exemple', 'retirerLExemple')
    .addSeparator()
    .addItem('Installer ou mettre à jour', 'installerLeLimiteur')
    .addItem('À propos', 'aProposDuLimiteur')
    .addToUi();
}

/**
 * Cible du déclencheur installable de soumission.
 *
 * Elle ne fait plus rien elle-même : tout passe par le filet, qui capture,
 * consigne et prévient. Un déclencheur qui lève cesse de s'exécuter sans que
 * rien dans le classeur ne le dise — et le limiteur cesse alors de limiter.
 */
function surSoumissionDuFormulaire(e) {
  const ligne = (e && e.range) ? e.range.getRow() : null;
  const resultat = limiteurSousFilet_(ligne);

  if (resultat.occupe) {
    // Une autre soumission tient le verrou. La sienne recomptera tout, y
    // compris cette ligne-ci : il n'y a rien à reprendre, et réessayer ne
    // ferait qu'empiler des exécutions sur un travail déjà fait.
    console.log(`Soumission ligne ${ligne} : ${resultat.message}`);
    return;
  }
  if (resultat.echec) {
    console.log(`Soumission ligne ${ligne} — échec consigné : ${resultat.quoi}`);
    return;
  }
  console.log(`Soumission ligne ${ligne} traitée : `
    + `${resultat.valeur.verdicts.map((v) => `${v.creneau.libelle} → ${v.verdict}`).join(' ; ')}`);
}

/** Recompte tout et remet le formulaire en accord. */
function synchroniserLesCreneaux() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => limiteurSynchroniser_());

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  interface_.alert('Créneaux', limiteurResumer_(resultat.valeur), interface_.ButtonSet.OK);
}

/** Montre l'état sans rien modifier — sauf le recomptage, qui est le sujet. */
function afficherLEtatDesCreneaux() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => limiteurSynchroniser_());
  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  interface_.alert('Où en sont les créneaux ?',
    limiteurDetailler_(resultat.valeur), interface_.ButtonSet.OK);
}

/** Installe ou met à jour dans le classeur courant. */
function installerLeLimiteur() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => limiteurInstaller_());

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  const { bilan, reglages } = resultat.valeur;
  const lignes = [
    'Installation terminée.',
    '',
    `Question pilotée : « ${bilan.titre} ».`,
    `Créneaux au référentiel : ${bilan.creneaux.length}`
      + (bilan.adoptes.length > 0
        ? ` (dont ${bilan.adoptes.length} repris du formulaire à l’instant)` : ''),
    reglages.poses.length > 0
      ? `Réglages posés : ${reglages.poses.length}.` : 'Réglages déjà en place.',
    '',
    'À faire maintenant : ouvrez l’onglet « Créneaux » et renseignez la colonne '
      + '« Places » pour chaque créneau. Tant qu’elle est vide, le créneau n’est '
      + 'jamais retiré.',
    '',
    'L’onglet « Aide » explique le reste.',
  ];
  interface_.alert('Créneaux', lignes.join('\n'), interface_.ButtonSet.OK);
}

/**
 * Monte un cas exemple et le déroule, sans toucher à rien.
 *
 * Trois onglets préfixés « Démo — », et aucun accès au formulaire ni à la
 * feuille des réponses : la démonstration peut se lancer sur une campagne en
 * cours sans que personne n'ait à retenir son souffle.
 */
function voirUnExemple() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => limiteurJouerLaDemonstration_());

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  interface_.alert(`Un exemple, en ${resultat.valeur.etapes} étapes`,
    [`L'onglet « ${LIMITEUR_ONGLET_DEMO_DEROULE_} » déroule un cas complet :`,
      'trois créneaux, sept places, des inscriptions, une de trop, deux',
      'annulations, puis la fermeture du formulaire.',
      '',
      'Lisez-le de haut en bas. La colonne « Pourquoi » explique chaque étape.',
      '',
      `Les chiffres ne sont pas écrits d'avance : ils sortent du même calcul que`,
      `celui qui pilote votre vrai formulaire, appliqué aux onglets`,
      `« ${LIMITEUR_PREFIXE_DEMO_.trim()} ».`,
      '',
      'Votre formulaire et vos réponses n’ont pas été touchés. « Retirer',
      'l’exemple » efface les trois onglets.'].join('\n'),
    interface_.ButtonSet.OK);
}

/** Efface les onglets de la démonstration, et eux seuls. */
function retirerLExemple() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => limiteurRetirerLaDemonstration_());

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  const { retires } = resultat.valeur;
  interface_.alert('Créneaux', retires.length === 0
    ? 'Aucun onglet d’exemple n’était présent : il n’y avait rien à retirer.'
    : `${retires.length} onglet(s) retiré(s) : ${retires.join(', ')}.`,
    interface_.ButtonSet.OK);
}

/**
 * Passe l'installation en revue avant que de vrais répondants ne s'en chargent.
 *
 * Ne modifie rien, hors l'onglet du rapport : le diagnostic se lance sur une
 * campagne en cours.
 */
function verifierMonInstallation() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => {
    const bilan = limiteurVerifierLInstallation_();
    limiteurEcrireLaVerification_(bilan.controles);
    return bilan;
  });

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  interface_.alert('Vérification de l’installation',
    limiteurResumerLaVerification_(resultat.valeur), interface_.ButtonSet.OK);
}

/**
 * Établit les listes par créneau : ce qu'on emporte le jour de la visite.
 *
 * Ne pilote rien — c'est une lecture. Le formulaire n'est même pas ouvert si le
 * réglage dit déjà quelle colonne des réponses porte le créneau.
 */
function etablirLesListes() {
  const interface_ = SpreadsheetApp.getUi();
  const resultat = SocleExecution.sousVerrou(() => {
    const bilan = limiteurEtablirLesListes_();
    limiteurEcrireLesListes_(bilan);
    return bilan;
  });

  if (!resultat.pris) {
    interface_.alert('Créneaux', resultat.message, interface_.ButtonSet.OK);
    return;
  }
  const { resume, reprises } = resultat.valeur;
  const lignes = [
    `${resume.retenues} personne(s) retenue(s), ${resume.attentes} en liste `
      + `d'attente, sur ${resume.creneaux} créneau(x).`,
  ];
  if (resume.sansInscription > 0) {
    lignes.push(`${resume.sansInscription} créneau(x) sans aucune inscription.`);
  }
  // Ce qu'on ne verrait pas autrement, et qui se découvrirait devant la personne.
  if (resume.horsReferentiel > 0) {
    lignes.push('', `Attention : ${resume.horsReferentiel} inscription(s) portent un `
      + 'créneau inconnu du référentiel. Elles figurent en fin de liste, statut '
      + '« Hors référentiel » : ces personnes se sont inscrites et ne sont comptées '
      + 'nulle part.');
  }
  lignes.push('', reprises.length === 0
    ? 'Aucune colonne de réponse reprise : le formulaire ne pose pas d’autre question.'
    : `Colonnes reprises : ${reprises.join(', ')}.`,
    'Pour en choisir d’autres, renseignez le réglage « Colonnes à reprendre dans '
    + 'les listes ».');
  lignes.push('', `Les listes sont dans l'onglet « ${LIMITEUR_ONGLET_LISTES_} ».`);
  interface_.alert('Listes par créneau', lignes.join('\n'), interface_.ButtonSet.OK);
}

/** La version qui tourne vraiment — un déploiement sert une copie figée du code. */
function aProposDuLimiteur() {
  const interface_ = SpreadsheetApp.getUi();
  interface_.alert('À propos',
    [`Limiteur de créneaux, version ${LIMITEUR_VERSION_}.`,
      '',
      'Retire du formulaire les créneaux complets, et les remet quand une place',
      'se libère. Le retrait d’une option est un confort d’affichage : la',
      'garantie, c’est le verdict rendu à la réception, visible dans le Journal.',
      '',
      'Fabrice Faucheux — https://faucheux.bzh',
      'Sous licence Elastic License 2.0.'].join('\n'),
    interface_.ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// Mise en mots — un chiffre s'accompagne toujours de ce qui le produit.
// ---------------------------------------------------------------------------

/**
 * Le résumé du diagnostic.
 *
 * Les bloquants d'abord, puis ce qui n'a pas pu être mesuré — c'est ce dernier
 * point qu'on oublie de lire, et c'est celui qui cache les surprises.
 */
const limiteurResumerLaVerification_ = (bilan) => {
  const { resume, controles } = bilan;
  const lignes = [`${controles.length} contrôles : ${resume.bon} bon(s), `
    + `${resume.aVerifier} à vérifier, ${resume.bloquant} bloquant(s), `
    + `${resume.nonMesure} non mesuré(s).`];

  const nommer = (etat) => controles.filter((un) => un.etat === etat)
    .map((un) => `• ${un.nom} — ${un.constat || un.quoiFaire}`);

  if (resume.bloquant > 0) {
    lignes.push('', 'Bloquant :', ...nommer(LIMITEUR_CONTROLES_.bloquant));
  }
  if (resume.aVerifier > 0) {
    lignes.push('', 'À vérifier :', ...nommer(LIMITEUR_CONTROLES_.aVerifier));
  }
  // « Non mesuré » ne veut pas dire « rien trouvé » : le dire, sans quoi un
  // rapport à moitié aveugle passerait pour un rapport rassurant.
  if (resume.nonMesure > 0) {
    lignes.push('', 'Non mesuré — ces points n’ont pas pu être vérifiés :',
      ...nommer(LIMITEUR_CONTROLES_.nonMesure));
  }
  lignes.push('', `Le détail, avec quoi faire, est dans l’onglet `
    + `« ${LIMITEUR_ONGLET_VERIFICATION_} ».`);
  return lignes.join('\n');
};

/** Le résumé d'une synchronisation, en quelques lignes. */
const limiteurResumer_ = (bilan) => {
  const complets = bilan.creneaux.filter((c) => c.etat === LIMITEUR_ETATS_.complet
    || c.etat === LIMITEUR_ETATS_.completParMarge);
  const parMarge = bilan.creneaux.filter(
    (c) => c.etat === LIMITEUR_ETATS_.completParMarge);
  const sansCapacite = bilan.creneaux.filter(
    (c) => c.etat === LIMITEUR_ETATS_.sansCapacite);
  const inconnus = Object.keys(bilan.inconnus);

  const lignes = [
    `${bilan.comptage.lignes} réponse(s) recomptée(s) sur la colonne « ${bilan.colonne} ».`,
    `${bilan.affiches.length} créneau(x) proposé(s), ${complets.length} complet(s).`,
  ];

  // Sans ce mot, on cherche un défaut de calcul là où il n'y en a pas.
  if (parMarge.length > 0) {
    lignes.push(`Dont ${parMarge.length} fermé(s) par la marge, alors qu’il y reste `
      + 'des places — c’est ce que la marge sert à faire.');
  }
  if (bilan.pose.pose) lignes.push('La liste du formulaire a été mise à jour.');
  else lignes.push('Le formulaire était déjà à jour : rien n’a été modifié.');

  if (bilan.ouverture.change) {
    lignes.push(bilan.ouverture.ouvert
      ? `Le formulaire a été rouvert : ${bilan.ouverture.raison}.`
      : `Le formulaire a été fermé : ${bilan.ouverture.raison}.`);
  } else if (bilan.ouverture.raison !== '') {
    lignes.push(bilan.ouverture.raison.charAt(0).toUpperCase()
      + bilan.ouverture.raison.slice(1) + '.');
  }

  if (bilan.adoptes.length > 0) {
    lignes.push('', `${bilan.adoptes.length} créneau(x) repris du formulaire et `
      + `ajouté(s) au référentiel : ${bilan.adoptes.join(', ')}.`);
  }
  if (sansCapacite.length > 0) {
    lignes.push('', `${sansCapacite.length} créneau(x) sans capacité, donc jamais `
      + `retiré(s) : ${sansCapacite.map((c) => c.libelle).join(', ')}. `
      + 'Renseignez leur colonne « Places ».');
  }
  // Une réponse qui ne correspond à aucun créneau connu ne disparaît pas en
  // silence : elle signale presque toujours un libellé modifié d'un côté
  // seulement, et donc un comptage incomplet.
  if (inconnus.length > 0) {
    lignes.push('', `Attention : ${inconnus.length} valeur(s) de réponse ne `
      + `correspondent à aucun créneau du référentiel et ne sont donc comptées `
      + `nulle part : ${inconnus.map((v) => `« ${v} » (${bilan.inconnus[v]})`).join(', ')}. `
      + 'Le libellé a sans doute été modifié d’un côté seulement.');
  }
  return lignes.join('\n');
};

/** Le détail créneau par créneau : un rang doit savoir dire pourquoi il est là. */
const limiteurDetailler_ = (bilan) => {
  if (bilan.creneaux.length === 0) {
    return 'Aucun créneau au référentiel. Ouvrez le formulaire, ajoutez des '
      + 'options à la question des créneaux, puis relancez.';
  }
  const detail = bilan.creneaux.map((creneau) => {
    const capacite = creneau.places === null ? '— places non définies' : `${creneau.places}`;
    const marge = creneau.marge > 0 ? `, marge ${creneau.marge}` : '';
    return `• ${creneau.libelle} : ${creneau.pris} / ${capacite}${marge} → ${creneau.etat}`;
  });
  return [limiteurResumer_(bilan), '', 'Détail :', ...detail].join('\n');
};

// ===========================================================================
// SocleCourriel.gs
// ===========================================================================

/**
 * Socle — courriels sortants. Introduit en v0.2.
 *
 * Ce module n'est pas entré ici parce qu'il était réécrit partout : la mesure
 * dit l'inverse — quatre envois dans tout le corpus, et **aucune notification
 * d'erreur**. Il y est entré parce que c'est une absence qui coûte : des
 * outils qui tournent sur déclencheurs, en arrière-plan, sans que personne ne
 * soit prévenu quand ils échouent. Les erreurs partent dans `console.error`,
 * c'est-à-dire dans un journal que personne n'ouvre.
 *
 * L'axe de classement n'est pas la gravité, c'est **ce qu'on attend du
 * destinataire** — rien, un acte, ou une réponse. C'est ce qui décide de tout
 * le reste : ce qui se groupe, ce qui se répète, ce qui a une échéance.
 *
 *   information  on n'attend rien. Se lit, se supprime, se groupe.
 *   erreur       on attend un acte. Doit dire quoi faire, pas ce qui a cassé.
 *   question     on attend une réponse. Sans canal de réponse ni échéance,
 *                ce n'est pas une question : c'est une information déguisée,
 *                et le module refuse de l'envoyer.
 *
 * `MailApp` et non `GmailApp` : il ne sait qu'envoyer, aucune portée de
 * lecture de la messagerie n'est demandée. La portée nécessaire est
 * `https://www.googleapis.com/auth/script.send_mail`.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_COURRIEL_VERSION_ = '0.12.1';

/**
 * Marqueurs d'objet, pour que le destinataire puisse filtrer.
 *
 * Un administrateur qui reçoit trois natures de messages du même outil a
 * besoin de les trier sans les ouvrir. Le marqueur est en tête de l'objet
 * parce que c'est la seule partie visible dans une notification mobile.
 */
const SOCLE_COURRIEL_MARQUEURS_ = {
  information: 'Info',
  erreur: 'Erreur',
  question: 'Question',
};

/** Silence par défaut entre deux signalements d'une même cause. */
const SOCLE_COURRIEL_SILENCE_MS_ = 6 * 60 * 60 * 1000;

const SOCLE_COURRIEL_PREFIXE_ETAT_ = 'socleCourriel:';

const socleCourrielProprietes_ = () => PropertiesService.getScriptProperties();

const socleCourrielMaintenant_ = () => Date.now();

const socleCourrielTexte_ = (valeur) => String(valeur ?? '').trim();

/**
 * Mémoire d'une cause d'erreur : quand elle a été signalée, combien de fois
 * elle est survenue depuis.
 *
 * Une propriété par cause, et rien d'autre : l'état tient largement sous les
 * 9 Ko par valeur, et une cause disparue cesse simplement d'être relue.
 */
const socleCourrielEtat_ = (cle) => {
  try {
    const brut = socleCourrielProprietes_().getProperty(SOCLE_COURRIEL_PREFIXE_ETAT_ + cle);
    return brut ? JSON.parse(brut) : { signaleeLe: 0, occurrences: 0, depuis: 0 };
  } catch (e) {
    // Propriétés indisponibles : on préfère envoyer en double que se taire.
    return { signaleeLe: 0, occurrences: 0, depuis: 0 };
  }
};

const socleCourrielEnregistrer_ = (cle, etat) => {
  try {
    socleCourrielProprietes_().setProperty(
      SOCLE_COURRIEL_PREFIXE_ETAT_ + cle, JSON.stringify(etat));
  } catch (e) { /* sans mémoire, l'anti-répétition ne s'applique pas : tant pis */ }
};

/**
 * Pied de page commun : d'où vient ce message.
 *
 * Un chiffre s'accompagne toujours de ce qui le produit. Un message
 * automatique sans provenance est un message qu'on ne peut ni recouper ni
 * faire cesser — et qui finira en filtre « supprimer ».
 */
const socleCourrielPied_ = (source) => {
  const lignes = ['', '—'];
  if (source && source.outil) lignes.push(`Envoyé par ${source.outil}`
    + (source.version ? ` (version ${source.version})` : ''));
  if (source && source.lien) lignes.push(source.lien);
  if (source && source.pourquoi) lignes.push(source.pourquoi);
  return lignes.length > 2 ? lignes.join('\n') : '';
};

const socleCourrielEnvoyer_ = (destinataires, objet, corps) => {
  const a = (Array.isArray(destinataires) ? destinataires : [destinataires])
    .map(socleCourrielTexte_).filter((x) => x !== '');
  if (a.length === 0) {
    throw new Error('Aucun destinataire : le message n\'a pas été envoyé. '
      + 'Renseignez « a » avec au moins une adresse.');
  }

  // Le quota se lit avant d'envoyer, plutôt qu'échouer à mi-parcours.
  const reste = MailApp.getRemainingDailyQuota();
  if (reste <= 0) {
    throw new Error('Quota d\'envoi épuisé pour aujourd\'hui : le message n\'est pas parti. '
      + 'Relancez demain, après la remise à zéro quotidienne du quota.');
  }

  MailApp.sendEmail({ to: a.join(','), subject: objet, body: corps });
  return { destinataires: a, objet, quotaRestant: reste - 1 };
};

const SocleCourriel = {
  version: SOCLE_COURRIEL_VERSION_,
  marqueurs: SOCLE_COURRIEL_MARQUEURS_,

  /**
   * Message dont on n'attend rien : un compte rendu, un relevé, une fin de
   * traitement.
   *
   * C'est la catégorie qu'il faut se retenir d'utiliser. Trois informations
   * de trop et le destinataire pose un filtre — qui emportera aussi les
   * erreurs et les questions, puisqu'elles viennent du même expéditeur.
   */
  information: ({ a, objet, corps, source }) => {
    const titre = socleCourrielTexte_(objet);
    if (titre === '') throw new Error('Une information doit porter un objet. Renseignez « objet ».');
    return socleCourrielEnvoyer_(a,
      `[${SOCLE_COURRIEL_MARQUEURS_.information}] ${titre}`,
      `${socleCourrielTexte_(corps)}\n${socleCourrielPied_(source)}`);
  },

  /**
   * Message dont on attend un acte.
   *
   * Trois exigences, et le module refuse d'envoyer sans elles :
   *
   *   - **`quoiFaire` est obligatoire.** Un message d'erreur dit quoi faire
   *     ensuite, pas ce qui a échoué. « Échec de la synchronisation » n'aide
   *     personne ; « le dossier de photos n'est plus partagé avec le compte de
   *     service — repartagez-le, puis relancez » se traite ;
   *   - **`cle` identifie la cause, pas l'occurrence.** On agrège par cause et
   *     non par victime : un manager parti produit une ligne, pas trois cents
   *     messages portant le même défaut ;
   *   - **le silence est borné et avoué.** Une même cause ne repart pas avant
   *     `silenceMs` (six heures par défaut), et le message qui repart dit
   *     combien de fois elle est survenue entre-temps. Un anti-répétition qui
   *     cacherait le volume mentirait sur l'ampleur.
   *
   * `cause` porte le détail technique, en fin de message : le destinataire
   * n'est pas toujours du métier, et ce qu'un utilisateur lit n'est pas ce
   * qu'un administrateur lit.
   */
  erreur: ({ a, quoi, quoiFaire, cause, cle, silenceMs, source }) => {
    const sujet = socleCourrielTexte_(quoi);
    const remede = socleCourrielTexte_(quoiFaire);
    if (sujet === '') {
      throw new Error('Une erreur doit dire ce qui ne va pas. Renseignez « quoi ».');
    }
    if (remede === '') {
      throw new Error(
        'Une erreur doit dire quoi faire ensuite. Sans remède, le message n\'apprend '
        + 'rien à qui le reçoit. Renseignez « quoiFaire » avec le geste attendu.');
    }

    const identifiant = socleCourrielTexte_(cle) || sujet;
    const etat = socleCourrielEtat_(identifiant);
    const maintenant = socleCourrielMaintenant_();
    const silence = silenceMs === undefined ? SOCLE_COURRIEL_SILENCE_MS_ : silenceMs;

    if (etat.signaleeLe && maintenant - etat.signaleeLe < silence) {
      socleCourrielEnregistrer_(identifiant, {
        signaleeLe: etat.signaleeLe,
        occurrences: etat.occurrences + 1,
        depuis: etat.depuis || etat.signaleeLe,
      });
      return { envoye: false, raison: 'silence', occurrences: etat.occurrences + 1 };
    }

    const repetitions = etat.occurrences > 0
      ? `\nCette cause est survenue ${etat.occurrences + 1} fois depuis le dernier signalement.\n`
      : '';

    const corps = [
      sujet,
      '',
      'À faire :',
      remede,
      repetitions,
      cause ? `Détail technique :\n${socleCourrielTexte_(cause)}` : '',
      socleCourrielPied_(source),
    ].filter((bloc) => bloc !== '').join('\n');

    const envoi = socleCourrielEnvoyer_(a,
      `[${SOCLE_COURRIEL_MARQUEURS_.erreur}] ${sujet}`, corps);

    socleCourrielEnregistrer_(identifiant, { signaleeLe: maintenant, occurrences: 0, depuis: 0 });
    return { envoye: true, ...envoi };
  },

  /**
   * Message dont on attend une réponse.
   *
   * `repondreVia` et `avantLe` sont obligatoires, et ce refus est l'essentiel
   * du module : **une question sans canal de réponse ni échéance n'est pas une
   * question**, c'est une information déguisée qui laissera son auteur croire
   * qu'il a demandé quelque chose.
   *
   * Le module n'assure pas le suivi des réponses, et c'est délibéré : lui seul
   * ne peut pas savoir ce qui vaut réponse. Il rend une `reference` que
   * l'appelant consigne là où vit son état — typiquement la ligne d'un plan,
   * qui passera de « À faire » à « Fait » quand la réponse arrivera.
   */
  question: ({ a, objet, question, repondreVia, avantLe, source }) => {
    const titre = socleCourrielTexte_(objet);
    const demande = socleCourrielTexte_(question);
    const canal = socleCourrielTexte_(repondreVia);
    const echeance = socleCourrielTexte_(avantLe);

    if (titre === '' || demande === '') {
      throw new Error('Une question doit porter un objet et une demande. '
        + 'Renseignez « objet » et « question ».');
    }
    if (canal === '') {
      throw new Error(
        'Une question doit dire par où répondre (« repondreVia ») : un lien, un '
        + 'formulaire, une adresse. Sans canal de réponse, ce n\'est pas une question. '
        + 'Renseignez « repondreVia ».');
    }
    if (echeance === '') {
      throw new Error(
        'Une question doit porter une échéance (« avantLe ») : sans elle, personne '
        + 'ne saura qu\'elle est restée sans réponse. Renseignez « avantLe ».');
    }

    const reference = `${SOCLE_COURRIEL_MARQUEURS_.question}-${socleCourrielMaintenant_()}`;
    const corps = [
      demande,
      '',
      `Répondre : ${canal}`,
      `Avant le : ${echeance}`,
      '',
      `Référence : ${reference}`,
      socleCourrielPied_(source),
    ].filter((bloc) => bloc !== '').join('\n');

    const envoi = socleCourrielEnvoyer_(a,
      `[${SOCLE_COURRIEL_MARQUEURS_.question}] ${titre}`, corps);
    return { reference, ...envoi };
  },

  /**
   * Oublie la mémoire d'une cause d'erreur, ou de toutes.
   *
   * Le pendant de « repartir de zéro » : quand une cause est corrigée, on ne
   * veut pas attendre six heures pour être prévenu si elle revient.
   */
  oublierCause: (cle) => {
    const proprietes = socleCourrielProprietes_();
    if (cle) {
      proprietes.deleteProperty(SOCLE_COURRIEL_PREFIXE_ETAT_ + socleCourrielTexte_(cle));
      return { oubliees: 1 };
    }
    const toutes = proprietes.getKeys()
      .filter((k) => k.indexOf(SOCLE_COURRIEL_PREFIXE_ETAT_) === 0);
    toutes.forEach((k) => proprietes.deleteProperty(k));
    return { oubliees: toutes.length };
  },
};

// ===========================================================================
// SocleDates.gs
// ===========================================================================

/**
 * Socle — dates. Introduit en v0.1.
 *
 * Une chaîne ISO écrite dans une cellule revient de `getValues()` sous forme
 * d'objet `Date`. `String(valeur)` rend alors « Thu May 14 2026 02:00:00
 * GMT+0200 ». L'affichage en anglais n'est que le symptôme : le vrai défaut
 * est que ces chaînes se comparent **alphabétiquement, sur le nom du jour**,
 * si bien que tout tri, tout minimum, tout maximum devient faux en silence.
 *
 * D'où la règle que ce module applique : normaliser **à la lecture**, jamais
 * à l'écriture — on ne maîtrise pas ce que Sheets fait d'une valeur en la
 * stockant. Et deux formats, pas un seul : `yyyy-MM-dd` pour stocker, parce
 * que c'est le seul qui se trie en tant que texte ; « 6 septembre 2026 »
 * pour lire, parce qu'une interface s'adresse à des humains. La conversion
 * appartient à la présentation, jamais à la donnée.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_DATES_VERSION_ = '0.12.1';

/**
 * Noms de mois explicites, et non `Utilities.formatDate(…, 'MMMM')`.
 *
 * `formatDate` suit la locale du script, pas la langue demandée : un projet
 * bilingue afficherait « September » en français si la locale du script est
 * en anglais, et il n'existe aucun moyen de le lui interdire. La table coûte
 * douze chaînes par langue et rend le résultat déterministe.
 */
const SOCLE_DATES_MOIS_ = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
};

const SOCLE_DATES_ISO_ = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const SOCLE_DATES_FR_ = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

const socleDatesFuseau_ = () => Session.getScriptTimeZone();

const socleDatesDeuxChiffres_ = (n) => (n < 10 ? `0${n}` : String(n));

/**
 * Rend un objet `Date` à partir de ce qu'une cellule peut contenir, ou `null`.
 *
 * **Ne devine jamais.** Un `new Date('01/02/2026')` rend le 2 janvier en
 * locale américaine et le 1er février ailleurs : la même cellule, lue par
 * deux scripts, donnerait deux dates. Seules deux écritures sont donc
 * acceptées — ISO et jj/mm/aaaa — et tout le reste rend `null`, à charge
 * pour l'appelant de dire « non mesuré » plutôt que d'inventer.
 *
 * Un nombre est refusé de la même façon : rien ne distingue un numéro de
 * série Sheets d'un identifiant, et se tromper y coûte une date en 1899.
 */
const socleDatesVersDate_ = (valeur) => {
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur;
  if (valeur === null || valeur === undefined || typeof valeur === 'number') return null;

  const texte = String(valeur).trim();
  if (texte === '') return null;

  const iso = SOCLE_DATES_ISO_.exec(texte);
  if (iso) {
    // Une chaîne ISO **portant un fuseau** — « Z » ou « +02:00 » — n'est pas
    // ambiguë : tous les moteurs l'analysent pareil, et on la laisse faire.
    // C'est le cas de tout ce que rendent les API Google : Drive, Agenda et
    // Meet horodatent en UTC. Les analyser composante par composante, comme
    // ci-dessous, les lisait en heure locale — deux heures d'écart l'été, et
    // un jour de décalage près de minuit, dans une colonne qui se trie.
    if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(texte)) {
      const avecFuseau = new Date(texte);
      if (!Number.isNaN(avecFuseau.getTime())) return avecFuseau;
    }
    // Sans fuseau, la chaîne est ambiguë : on choisit l'heure locale, parce
    // que c'est ce que Sheets rend d'une cellule que nous avons écrite.
    const [, a, m, j, h, mn, s] = iso;
    return new Date(Number(a), Number(m) - 1, Number(j),
      Number(h || 0), Number(mn || 0), Number(s || 0));
  }

  const fr = SOCLE_DATES_FR_.exec(texte);
  if (fr) {
    const [, j, m, a, h, mn, s] = fr;
    return new Date(Number(a), Number(m) - 1, Number(j),
      Number(h || 0), Number(mn || 0), Number(s || 0));
  }

  return null;
};

const SocleDates = {
  version: SOCLE_DATES_VERSION_,

  /**
   * Format de stockage : `yyyy-MM-dd`, ou `''` si la valeur n'est pas une date.
   *
   * `''` veut dire « je n'ai pas su lire », jamais « il n'y a rien » — et
   * c'est à l'appelant de le distinguer dans son rapport.
   */
  jour: (valeur) => {
    const date = socleDatesVersDate_(valeur);
    return date === null ? '' : Utilities.formatDate(date, socleDatesFuseau_(), 'yyyy-MM-dd');
  },

  /** Format de stockage avec l'heure : `yyyy-MM-dd HH:mm:ss`. Se trie aussi. */
  horodatage: (valeur) => {
    const date = socleDatesVersDate_(valeur);
    return date === null ? ''
      : Utilities.formatDate(date, socleDatesFuseau_(), 'yyyy-MM-dd HH:mm:ss');
  },

  maintenantJour: () => Utilities.formatDate(new Date(), socleDatesFuseau_(), 'yyyy-MM-dd'),

  maintenantHorodatage: () => Utilities.formatDate(
    new Date(), socleDatesFuseau_(), 'yyyy-MM-dd HH:mm:ss'),

  /**
   * Format de lecture : « 6 septembre 2026 ». Pour une interface, jamais pour
   * une cellule dont on trierait la colonne.
   */
  lisible: (valeur, langue = 'fr') => {
    const date = socleDatesVersDate_(valeur);
    if (date === null) return '';
    const mois = SOCLE_DATES_MOIS_[langue] || SOCLE_DATES_MOIS_.fr;
    const jour = date.getDate();
    if (langue === 'en') return `${mois[date.getMonth()]} ${jour}, ${date.getFullYear()}`;
    // « 1er » et non « 1 » : la seule irrégularité du français sur les quantièmes.
    const quantieme = jour === 1 ? '1er' : String(jour);
    return `${quantieme} ${mois[date.getMonth()]} ${date.getFullYear()}`;
  },

  /** « 6 septembre 2026 à 14:05 ». */
  lisibleAvecHeure: (valeur, langue = 'fr') => {
    const date = socleDatesVersDate_(valeur);
    if (date === null) return '';
    const heure = `${socleDatesDeuxChiffres_(date.getHours())}:${socleDatesDeuxChiffres_(date.getMinutes())}`;
    const jour = SocleDates.lisible(valeur, langue);
    return langue === 'en' ? `${jour} at ${heure}` : `${jour} à ${heure}`;
  },

  /** Vrai si le texte est déjà au format de stockage. Sert aux contrôles, pas aux conversions. */
  estJour: (texte) => /^\d{4}-\d{2}-\d{2}$/.test(String(texte ?? '')),

  /** Nombre de jours entiers entre deux valeurs, ou `null` si l'une n'est pas lisible. */
  ecartEnJours: (depuis, jusqua) => {
    const a = socleDatesVersDate_(depuis);
    const b = socleDatesVersDate_(jusqua);
    if (a === null || b === null) return null;
    const jour = 24 * 60 * 60 * 1000;
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
      - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / jour);
  },
};

// ===========================================================================
// SocleErreurs.gs
// ===========================================================================

/**
 * Socle — échecs. Introduit en v0.3.
 *
 * Ce module n'est pas entré par duplication : il n'existait rien à
 * factoriser. Il est entré par ce que la mesure a trouvé dans six projets —
 * 118 exceptions levées dont 9 disent quoi faire ensuite, et 17 blocs `catch`
 * qui décident en silence qu'un échec n'a pas eu lieu.
 *
 * Le défaut n'est pas d'absorber un échec : certains le méritent, et un cache
 * qui ne répond pas ne doit pas arrêter une génération. Le défaut est que
 * **rien ne distingue « ça n'a pas eu lieu » de « je n'ai pas su »**. Un Drive
 * dont on n'a pas pu lire les membres rend une liste vide, et la liste vide
 * devient « propriétaire inconnu » ; un fichier illisible disparaît d'un
 * rapport d'audit qui se déclare complet. Un rendu faux qui se dit réussi
 * coûte plus cher qu'un échec, parce que personne ne va chercher la cause
 * d'un succès.
 *
 * D'où la doctrine, en trois sorts et pas un de plus. À chaque échec, il faut
 * en nommer un :
 *
 *   absorber   l'échec est prévu et sans conséquence sur le résultat. On rend
 *              une valeur de repli, **et on compte**. Le compteur est la
 *              trace : c'est ce qui empêche l'absorption d'être un oubli.
 *   lever      l'échec empêche de continuer. On lève une erreur qui porte son
 *              remède — le module refuse d'en construire une sans.
 *   signaler   l'échec concerne quelqu'un d'autre que celui qui exécute.
 *              C'est l'affaire de SocleCourriel, à qui l'on passe ce bilan.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_ERREURS_VERSION_ = '0.12.1';

/**
 * Registre des échecs absorbés, pour la durée de l'exécution.
 *
 * Un objet `const` muté en place, et non `let` : une liaison `let` de portée
 * globale traverse mal les fichiers d'un même projet Apps Script.
 *
 * Il ne va pas dans `PropertiesService` : ce registre est le bilan **d'une
 * exécution**, pas un état de reprise. Le persister ferait cumuler les échecs
 * de lundi avec ceux de mardi dans le même rapport.
 */
const SOCLE_ERREURS_REGISTRE_ = { causes: {} };

const SOCLE_ERREURS_MARQUE_ = 'socleErreurAttendue';

const socleErreursTexte_ = (valeur) => String(valeur ?? '').trim();

const socleErreursMessage_ = (erreur) => socleErreursTexte_(
  (erreur && erreur.message) || erreur);

const SocleErreurs = {
  version: SOCLE_ERREURS_VERSION_,

  /**
   * Construit une erreur qui porte son remède.
   *
   * `quoiFaire` est obligatoire, et ce refus est l'essentiel : un message
   * d'erreur dit quoi faire ensuite, pas ce qui a échoué. « Échec de la
   * synchronisation » n'apprend rien à qui le lit ; « le dossier n'est plus
   * partagé avec ce compte — repartagez-le, puis relancez » se traite.
   *
   * `cause` porte le détail technique. Il est gardé à part et non concaténé au
   * message : ce qu'un utilisateur final lit n'est pas ce qu'un administrateur
   * lit, et les deux textes se tirent ensuite de la même erreur.
   */
  erreur: ({ quoi, quoiFaire, cause }) => {
    const sujet = socleErreursTexte_(quoi);
    const remede = socleErreursTexte_(quoiFaire);
    if (sujet === '') {
      throw new Error('SocleErreurs.erreur : « quoi » est obligatoire. '
        + 'Renseignez ce qui ne va pas, du point de vue de qui lira le message.');
    }
    if (remede === '') {
      throw new Error(
        `SocleErreurs.erreur : « quoiFaire » est obligatoire pour « ${sujet} ». `
        + 'Une erreur qui ne dit pas quoi faire ensuite laisse son lecteur devant '
        + 'un constat, et il improvisera. Renseignez le geste attendu.');
    }
    const erreur = new Error(`${sujet} ${remede}`);
    erreur[SOCLE_ERREURS_MARQUE_] = true;
    erreur.quoi = sujet;
    erreur.quoiFaire = remede;
    erreur.cause = socleErreursTexte_(cause);
    return erreur;
  },

  /** Vrai si l'erreur a été construite par ce module, donc porte un remède. */
  estAttendue: (erreur) => !!(erreur && erreur[SOCLE_ERREURS_MARQUE_] === true),

  /**
   * Exécute l'opération ; si elle échoue, compte l'échec sous cette cause et
   * rend la valeur de repli.
   *
   * `cause` est obligatoire et nomme **la cause, pas l'occurrence** : on
   * agrège par cause et non par victime, sans quoi un rapport aligne trois
   * cents lignes portant le même défaut et n'est plus lu.
   *
   * Ce que fait ce module et que ne fait pas un `catch` nu : la valeur de
   * repli est rendue **et** l'échec reste comptable. `bilan()` permet ensuite
   * au rapport de dire « 12 Drives dont les membres n'ont pas pu être lus »
   * plutôt que de laisser croire qu'ils n'avaient pas de membres.
   */
  absorber: (cause, operation, repli) => {
    const nom = socleErreursTexte_(cause);
    if (nom === '') {
      throw new Error(
        'SocleErreurs.absorber : une cause doit être nommée. Absorber un échec sans '
        + 'le nommer, c\'est exactement le catch muet que ce module remplace. '
        + 'Nommez la cause, pas l\'occurrence : « lecture des membres du Drive », '
        + 'et non « Drive 1A2B ».');
    }
    try {
      return operation();
    } catch (erreur) {
      const registre = SOCLE_ERREURS_REGISTRE_.causes;
      const connue = registre[nom] || { occurrences: 0, premierMessage: '', dernierMessage: '' };
      const message = socleErreursMessage_(erreur);
      registre[nom] = {
        occurrences: connue.occurrences + 1,
        premierMessage: connue.premierMessage || message,
        dernierMessage: message,
      };
      return repli;
    }
  },

  /**
   * Ce qui a été absorbé depuis le dernier oubli, agrégé par cause.
   *
   * Destiné au compte rendu final : un chiffre s'accompagne toujours de ce qui
   * le produit, et une exécution qui a absorbé douze échecs ne doit pas se
   * présenter comme une exécution parfaite.
   */
  bilan: () => {
    const causes = Object.keys(SOCLE_ERREURS_REGISTRE_.causes)
      .map((nom) => ({ cause: nom, ...SOCLE_ERREURS_REGISTRE_.causes[nom] }))
      .sort((a, b) => b.occurrences - a.occurrences);
    return {
      total: causes.reduce((somme, c) => somme + c.occurrences, 0),
      causes,
    };
  },

  /** Remet le registre à zéro. À appeler au début d'une exécution. */
  oublier: () => {
    const total = SocleErreurs.bilan().total;
    SOCLE_ERREURS_REGISTRE_.causes = {};
    return { oubliees: total };
  },

  /**
   * Le texte destiné à qui s'est servi de l'outil.
   *
   * Une erreur attendue rend son remède. Une exception imprévue — un défaut du
   * code — ne se déguise pas en conseil : on dit qu'elle est imprévue, et on
   * donne de quoi la rapporter. Faire passer un bug pour un problème de saisie
   * envoie l'utilisateur corriger ce qui n'a rien à se reprocher.
   */
  pourLUtilisateur: (erreur) => {
    if (SocleErreurs.estAttendue(erreur)) return `${erreur.quoi} ${erreur.quoiFaire}`;
    return 'Une erreur imprévue est survenue — ce n\'est pas votre saisie qui est en '
      + 'cause. Signalez-la à l\'administrateur de l\'outil, avec l\'heure à laquelle '
      + 'elle s\'est produite.';
  },

  /**
   * Le texte destiné au journal et à l'administrateur : tout, y compris ce que
   * l'utilisateur n'a pas besoin de lire.
   */
  pourLeJournal: (erreur) => {
    if (SocleErreurs.estAttendue(erreur)) {
      return [
        `Attendue : ${erreur.quoi}`,
        `Remède annoncé : ${erreur.quoiFaire}`,
        erreur.cause ? `Cause : ${erreur.cause}` : '',
      ].filter((l) => l !== '').join('\n');
    }
    const pile = (erreur && erreur.stack) ? `\n${erreur.stack}` : '';
    return `Imprévue : ${socleErreursMessage_(erreur)}${pile}`;
  },
};

// ===========================================================================
// SocleExecution.gs
// ===========================================================================

/**
 * Socle — le plafond des six minutes. Introduit en v0.5.
 *
 * Le motif le plus répandu du corpus : 54 occurrences dans **cinq projets sur
 * six**. Trois primitives qui vont toujours ensemble, et qu'on réécrit chaque
 * fois un peu différemment.
 *
 * Le fait qui commande tout : **une exécution qui atteint six minutes n'est
 * pas interrompue, elle est tuée.** Aucun `catch`, aucun `finally`, aucune
 * écriture de retour. Ce qui n'est pas parti vers Google n'existe pas pour la
 * reprise. Les six minutes valent pour tous les types de compte — les trente
 * minutes qu'on cite encore pour Workspace ont été retirées.
 *
 * Ce module ne sait pas reprendre un travail : il donne de quoi savoir quand
 * s'arrêter, comment ne pas être deux à travailler, et comment se réveiller.
 * Le motif complet « plan puis application » vit dans son propre dépôt, et
 * porte aujourd'hui sa propre copie de ces primitives — les faire converger
 * est une étape à part, qui se vérifiera à son banc.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_EXECUTION_VERSION_ = '0.12.1';

/** Budget par défaut, sous le plafond : de quoi écrire l'état et rendre la main. */
const SOCLE_EXECUTION_BUDGET_MS_ = 4 * 60 * 1000;

/**
 * Déclencheurs autorisés par utilisateur et par script (page des quotas Apps
 * Script). Un déclencheur ponctuel s'exécute une fois mais **reste inscrit au
 * projet** : une exécution tuée laisse le sien derrière elle, et l'on atteint
 * la limite sans l'avoir vue venir.
 */
const SOCLE_EXECUTION_DECLENCHEURS_MAX_ = 20;

const SocleExecution = {
  version: SOCLE_EXECUTION_VERSION_,

  /**
   * Ouvre un budget de temps.
   *
   *     const budget = SocleExecution.budget();
   *     for (const unite of file) {
   *       if (!budget.permet(dureeUniteMs)) { programmerLaReprise(); break; }
   *       traiter(unite);
   *     }
   *
   * `permet(ms)` et non `reste() > 0` : **on ne démarre pas une unité sur un
   * budget entamé.** Le pari coûte l'exécution entière, alors que la suivante
   * repartira avec ses six minutes. C'est la nuance qui manque à la plupart
   * des boucles écrites à la main.
   */
  budget: (options = {}) => {
    const maximum = options.msMax || SOCLE_EXECUTION_BUDGET_MS_;
    const depart = Date.now();
    return {
      msMax: maximum,
      ecoule: () => Date.now() - depart,
      reste: () => Math.max(0, maximum - (Date.now() - depart)),
      permet: (msNecessaires) => (Date.now() - depart) + (msNecessaires || 0) <= maximum,
      depasse: () => Date.now() - depart > maximum,
    };
  },

  /**
   * Exécute l'opération sous le verrou du document, ou renonce.
   *
   * `getDocumentLock` et non `getScriptLock` : l'état appartient à ce
   * classeur, et deux classeurs n'ont aucune raison de s'attendre.
   *
   * **Attente nulle** : celui qui arrive second n'a rien d'utile à faire, et
   * l'attente ne ferait que consommer son propre budget. Il rend
   * `{ pris: false }` et l'appelant le dit à l'utilisateur.
   *
   * `releaseLock()` dans un `finally`, sans quoi une exception bloquerait
   * toute exécution jusqu'à l'expiration du verrou.
   */
  sousVerrou: (operation) => {
    // `getDocumentLock()` rend **null** — il ne lève pas — quand le script
    // n'est lié à aucun document. Découvert au premier essai réel, sur un
    // projet autonome : « Cannot read properties of null (reading 'tryLock') ».
    //
    // On retombe alors sur le verrou de script, et c'est le bon choix : sans
    // document, il n'y a rien à quoi rattacher l'exclusion, et l'intention —
    // ne pas travailler à deux en même temps — reste entière. Mais on le
    // **dit** dans le résultat, parce qu'une portée d'exclusion silencieusement
    // élargie est exactement le genre de chose qu'on découvre trop tard.
    const documentaire = LockService.getDocumentLock();
    const verrou = documentaire || LockService.getScriptLock();
    const portee = documentaire ? 'document' : 'script';

    if (!verrou) {
      throw new Error(
        'Aucun verrou disponible dans ce contexte : ni document, ni script. '
        + 'Relancez depuis un projet lié à un classeur, ou depuis l\'éditeur.');
    }

    if (!verrou.tryLock(0)) {
      return {
        pris: false,
        portee,
        message: 'Une exécution est déjà en cours sur ce document. Attendez qu\'elle '
          + 'se termine, puis relancez.',
      };
    }
    try {
      return { pris: true, portee, valeur: operation() };
    } finally {
      verrou.releaseLock();
    }
  },

  /** Retire les déclencheurs qui visent cette fonction, et dit combien. */
  retirerReprise: (nomFonction) => {
    let retires = 0;
    ScriptApp.getProjectTriggers().forEach((declencheur) => {
      if (declencheur.getHandlerFunction() === nomFonction) {
        ScriptApp.deleteTrigger(declencheur);
        retires += 1;
      }
    });
    return retires;
  },

  /** Vrai si une reprise est déjà programmée pour cette fonction. */
  repriseProgrammee: (nomFonction) => ScriptApp.getProjectTriggers()
    .some((declencheur) => declencheur.getHandlerFunction() === nomFonction),

  /**
   * Programme une reprise, après avoir ramassé les précédentes.
   *
   * La cible doit être une `function` déclarée du projet : un déclencheur est
   * résolu par son nom global au moment où il se réveille, et rien ne signale
   * l'erreur avant. Vérifier ici coûte une ligne et évite de découvrir
   * « Fonction de script introuvable » dans un journal, une minute plus tard,
   * sans personne pour le lire.
   *
   * Le ramassage se fait à trois endroits, et le troisième est le seul qui
   * opère dans le cas dégradé : avant d'en créer un nouveau (ici), à la fin
   * d'un travail terminé, et **en première ligne de la fonction cible** —
   * celle-là opère quand l'exécution renonce aussitôt, verrou déjà pris.
   */
  programmerReprise: (nomFonction, delaiMs) => {
    SocleExecution.retirerReprise(nomFonction);

    if (typeof globalThis !== 'undefined'
        && typeof globalThis[nomFonction] !== 'function') {
      throw new Error(
        `La reprise vise « ${nomFonction} », qui n'est pas une function déclarée de ce `
        + 'projet : un déclencheur qui la viserait échouerait une minute plus tard, en '
        + 'arrière-plan. Déclarez-la avec « function », et non « const … = () => ».');
    }

    const existants = ScriptApp.getProjectTriggers().length;
    if (existants >= SOCLE_EXECUTION_DECLENCHEURS_MAX_) {
      throw new Error(
        `Ce projet compte déjà ${existants} déclencheurs sur les `
        + `${SOCLE_EXECUTION_DECLENCHEURS_MAX_} autorisés par utilisateur et par script. `
        + 'Supprimez-en avant de relancer.');
    }

    ScriptApp.newTrigger(nomFonction).timeBased().after(delaiMs || 60 * 1000).create();
    return { programmee: true, dans: delaiMs || 60 * 1000 };
  },
};

// ===========================================================================
// SocleFeuilles.gs
// ===========================================================================

/**
 * Socle — feuilles de calcul. Introduit en v0.1.
 *
 * Quatre règles, toutes payées au moins une fois, que ce module rend
 * difficiles à enfreindre :
 *
 *   - **les colonnes se retrouvent par en-tête**, jamais par indice en dur :
 *     l'ordre des colonnes change, et une colonne insérée à la main par un
 *     utilisateur ne doit décaler aucune écriture ;
 *   - **on écrit par lots**, jamais cellule par cellule ;
 *   - **le référentiel n'est pas dans le code** : ce qui relève du jugement
 *     vit dans un onglet, et le code n'y ajoute que ce qui manque — il ne
 *     réécrit jamais une décision humaine ;
 *   - **un onglet déjà présent mais vide n'est pas un onglet absent.** Les
 *     confondre laisse un onglet sans en-tête, et la première clé se retrouve
 *     en ligne 1 où elle sera prise pour un titre de colonne et ignorée.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_FEUILLES_VERSION_ = '0.12.1';

/**
 * Noms que Google donne à la feuille d'un classeur neuf.
 *
 * La liste n'a pas à être exhaustive, et ce n'est pas grave : **c'est le
 * contrôle de vacuité qui protège, pas le nom.** Un nom oublié laisse un
 * onglet vide de trop — sans conséquence. Une suppression de trop perdrait des
 * données. Le défaut penche donc du bon côté.
 */
const SOCLE_FEUILLES_PAR_DEFAUT_ = /^(feuille|sheet|hoja|blatt|foglio|folha)\s?1$/i;

const socleFeuillesClasseur_ = () => SpreadsheetApp.getActive();

/**
 * Résout un onglet désigné par son nom.
 *
 * **Écrire crée, lire ne crée pas**, et l'asymétrie est voulue : écrire dans
 * un onglet neuf est l'usage normal, tandis que lire un onglet absent est
 * presque toujours une faute de frappe ou une installation incomplète — la
 * créer à la volée rendrait un tableau vide qu'on prendrait pour « aucune
 * donnée » au lieu de « mauvais onglet ».
 */
const socleFeuillesResoudre_ = (feuilleOuNom, options = {}) => {
  if (typeof feuilleOuNom !== 'string') return feuilleOuNom;
  const feuille = socleFeuillesClasseur_().getSheetByName(feuilleOuNom);
  if (feuille) return feuille;
  if (options.creerSiAbsent) return socleFeuillesClasseur_().insertSheet(feuilleOuNom);
  throw new Error(`L'onglet « ${feuilleOuNom} » n'existe pas. `
    + 'Vérifiez son nom, ou lancez l\'installation qui le pose.');
};

const SocleFeuilles = {
  version: SOCLE_FEUILLES_VERSION_,

  /**
   * Rend l'onglet, et le crée s'il manque.
   *
   * Rend aussi `{ cree: true }` par le second élément, pour que l'appelant
   * sache s'il vient de le poser — c'est ce qui permet de n'écrire les
   * valeurs d'exemple qu'une seule fois dans la vie du classeur.
   */
  onglet: (nom, options = {}) => {
    const classeur = socleFeuillesClasseur_();
    const existante = classeur.getSheetByName(nom);
    if (existante) return { feuille: existante, cree: false };
    if (options.creerSiAbsent === false) {
      throw new Error(`L'onglet « ${nom} » n'existe pas. `
        + 'Vérifiez son nom, ou appelez onglet() sans creerSiAbsent: false.');
    }
    return { feuille: classeur.insertSheet(nom), cree: true };
  },

  /**
   * Lit tout un onglet en lignes indexées par le nom de colonne.
   *
   * Une seule lecture en bloc, jamais cellule par cellule. Chaque ligne porte
   * son `numero` dans l'onglet, sans quoi l'appelant ne saurait pas où
   * réécrire — et recalculer ce numéro plus tard est la façon la plus sûre
   * de se tromper d'une ligne.
   *
   * Les valeurs sont rendues **brutes** : une cellule de date rend un objet
   * `Date`. La normalisation appartient à l'appelant (module des dates du
   * socle), pour que ce module n'impose rien sur la forme des données.
   */
  lireTable: (feuilleOuNom) => {
    const feuille = socleFeuillesResoudre_(feuilleOuNom);
    const hauteur = feuille.getLastRow();
    const largeur = feuille.getLastColumn();
    if (hauteur < 1 || largeur < 1) return { feuille, entete: [], index: {}, lignes: [] };

    const valeurs = feuille.getRange(1, 1, hauteur, largeur).getValues();
    const entete = valeurs[0].map((titre) => String(titre ?? '').trim());
    const index = {};
    entete.forEach((nom, position) => {
      if (nom !== '' && !(nom in index)) index[nom] = position;
    });

    const lignes = valeurs.slice(1).map((cellules, rang) => {
      const ligne = { numero: rang + 2, cellules };
      Object.keys(index).forEach((nom) => { ligne[nom] = cellules[index[nom]]; });
      return ligne;
    });

    return { feuille, entete, index, lignes };
  },

  /**
   * Position d'une colonne, ou une exception qui dit laquelle manque.
   *
   * Un `undefined` silencieux se transforme en lecture de la colonne A —
   * c'est-à-dire en données fausses qui ont l'air justes.
   */
  colonne: (table, nom) => {
    if (!(nom in table.index)) {
      throw new Error(
        `La colonne « ${nom} » est absente de l'onglet « ${table.feuille.getName()} ». `
        + `Colonnes présentes : ${table.entete.filter((e) => e !== '').join(', ')}. `
        + 'Vérifiez l\'orthographe de l\'en-tête, ou ajoutez la colonne manquante.');
    }
    return table.index[nom];
  },

  /** Écrit un en-tête et des lignes en une seule opération. */
  ecrireTable: (feuilleOuNom, entete, lignes, options = {}) => {
    const feuille = socleFeuillesResoudre_(feuilleOuNom, { creerSiAbsent: true });
    if (options.vider !== false) feuille.clear();
    feuille.getRange(1, 1, 1, entete.length).setValues([entete]).setFontWeight('bold');
    if (lignes.length > 0) {
      const corps = lignes.map((ligne) => (Array.isArray(ligne)
        ? ligne
        : entete.map((nom) => (ligne[nom] === undefined || ligne[nom] === null ? '' : ligne[nom]))));
      feuille.getRange(2, 1, corps.length, entete.length).setValues(corps);
    }
    feuille.setFrozenRows(1);
    return { lignes: lignes.length };
  },

  /**
   * Ajoute les colonnes apparues après coup à un onglet déjà rempli, de façon
   * purement additive.
   *
   * Sans cela, une colonne nouvelle n'existerait que sur les classeurs neufs
   * et resterait invisible à ceux qui en ont justement besoin.
   */
  completerColonnes: (feuilleOuNom, colonnes) => {
    const table = SocleFeuilles.lireTable(feuilleOuNom);
    const manquantes = colonnes.filter((nom) => !(nom in table.index));
    if (manquantes.length === 0) return { ajoutees: [] };
    const depart = Math.max(table.entete.length, 1) + (table.entete.length === 0 ? 0 : 1);
    table.feuille.getRange(1, depart, 1, manquantes.length)
      .setValues([manquantes]).setFontWeight('bold');
    return { ajoutees: manquantes };
  },

  /**
   * Pose une liste déroulante sur la valeur d'un réglage, trouvé **par sa
   * clé**.
   *
   * Jamais par numéro de ligne : une ligne insérée à la main par
   * l'utilisateur déplacerait la validation sur le mauvais réglage, et c'est
   * le genre de défaut qu'on ne voit qu'une fois qu'il a fait choisir la
   * mauvaise valeur à quelqu'un.
   *
   * `bloquant` décide de ce qu'il advient d'une saisie hors liste. Pour un
   * ensemble fermé — Oui / Non — bloquer est juste. Pour une liste tirée d'une
   * API — les modèles disponibles — **avertir sans bloquer** : la liste peut
   * dater, et un nom valide apparu depuis ne doit pas être refusé. Le défaut
   * est donc de ne pas bloquer.
   */
  listeSurReglage: (nom, cle, valeurs, options = {}) => {
    const feuille = socleFeuillesResoudre_(nom);
    const hauteur = Math.max(feuille.getLastRow(), 1);
    const cles = feuille.getRange(1, 1, hauteur, 1).getValues()
      .map((r) => String(r[0] ?? '').trim());
    const rang = cles.indexOf(String(cle).trim());
    if (rang === -1) {
      throw new Error(
        `Aucun réglage nommé « ${cle} » dans l'onglet « ${feuille.getName()} ». `
        + 'Posez le réglage avant sa liste, ou vérifiez son orthographe.');
    }
    const regle = SpreadsheetApp.newDataValidation()
      .requireValueInList(valeurs, true)
      .setAllowInvalid(options.bloquant !== true)
      .build();
    feuille.getRange(rang + 1, 2).setDataValidation(regle);
    return { ligne: rang + 1, valeurs: valeurs.length };
  },

  /**
   * Impose un nombre dans un intervalle sur la valeur d'un réglage.
   *
   * Une liste déroulante quand l'ensemble est fini et court ; un intervalle
   * quand il ne l'est pas. Dérouler cent valeurs n'aide personne.
   */
  nombreSurReglage: (nom, cle, min, max) => {
    const feuille = socleFeuillesResoudre_(nom);
    const hauteur = Math.max(feuille.getLastRow(), 1);
    const cles = feuille.getRange(1, 1, hauteur, 1).getValues()
      .map((r) => String(r[0] ?? '').trim());
    const rang = cles.indexOf(String(cle).trim());
    if (rang === -1) {
      throw new Error(
        `Aucun réglage nommé « ${cle} » dans l'onglet « ${feuille.getName()} ». `
        + 'Posez le réglage avant sa contrainte, ou vérifiez son orthographe.');
    }
    const regle = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(min, max)
      .setAllowInvalid(false)
      .setHelpText(`Un nombre entre ${min} et ${max}.`)
      .build();
    feuille.getRange(rang + 1, 2).setDataValidation(regle);
    return { ligne: rang + 1, min, max };
  },

  /** Pose une liste déroulante sur toute une colonne d'un tableau, en-tête exclu. */
  listeSurColonne: (nom, nomColonne, valeurs, options = {}) => {
    const table = SocleFeuilles.lireTable(nom);
    const position = SocleFeuilles.colonne(table, nomColonne);
    const regle = SpreadsheetApp.newDataValidation()
      .requireValueInList(valeurs, true)
      .setAllowInvalid(options.bloquant !== true)
      .build();
    const hauteur = Math.max(table.lignes.length, options.lignes || 500);
    table.feuille.getRange(2, position + 1, hauteur, 1).setDataValidation(regle);
    return { colonne: position + 1, lignes: hauteur };
  },

  /**
   * Retire la feuille vide que Google pose dans un classeur neuf.
   *
   * À appeler **après** avoir créé ses propres onglets : un classeur ne peut
   * pas rester sans feuille, et Sheets refuse de supprimer la dernière.
   *
   * Trois conditions, et les deux dernières sont les gardes :
   *
   *   - le nom ressemble à celui d'une feuille par défaut ;
   *   - **la feuille est vide** — `getLastRow()` et `getLastColumn()` à zéro.
   *     Une feuille par défaut où quelqu'un a écrit n'est plus une feuille par
   *     défaut, c'est le travail de quelqu'un ;
   *   - **il reste au moins une autre feuille** après.
   *
   * Rend les noms retirés, pour que l'installation puisse le dire plutôt que
   * de faire disparaître un onglet sans un mot.
   */
  retirerFeuilleParDefaut: () => {
    const classeur = socleFeuillesClasseur_();
    const retirees = [];
    classeur.getSheets().forEach((feuille) => {
      if (classeur.getSheets().length <= 1) return;
      const nom = feuille.getName();
      if (!SOCLE_FEUILLES_PAR_DEFAUT_.test(nom)) return;
      if (feuille.getLastRow() !== 0 || feuille.getLastColumn() !== 0) return;
      classeur.deleteSheet(feuille);
      retirees.push(nom);
    });
    return { retirees };
  },

  /**
   * Lit un onglet de réglages en objet clé → valeur (colonnes A et B).
   *
   * Ne lève jamais : un onglet absent ou incomplet rend un objet vide plutôt
   * qu'une exception, pour qu'une installation puisse le compléter.
   */
  lireReglages: (nom) => {
    const feuille = socleFeuillesClasseur_().getSheetByName(nom);
    if (!feuille || feuille.getLastRow() < 2) return {};
    const valeurs = feuille.getRange(1, 1, feuille.getLastRow(), 2).getValues();
    const lu = {};
    valeurs.slice(1).forEach(([cle, valeur]) => {
      const clef = String(cle ?? '').trim();
      if (clef !== '') lu[clef] = valeur;
    });
    return lu;
  },

  /**
   * Écrit un réglage **par sa clé**, jamais par numéro de ligne.
   *
   * Une ligne insérée à la main par l'utilisateur ne doit jamais décaler une
   * écriture automatique. La clé absente est ajoutée à la fin.
   */
  ecrireReglage: (nom, cle, valeur) => {
    const { feuille } = SocleFeuilles.onglet(nom);
    const hauteur = Math.max(feuille.getLastRow(), 1);
    const cles = feuille.getRange(1, 1, hauteur, 1).getValues().map((r) => String(r[0] ?? '').trim());
    const rang = cles.indexOf(String(cle).trim());
    const ligne = rang === -1 ? hauteur + 1 : rang + 1;
    feuille.getRange(ligne, 1, 1, 2).setValues([[cle, valeur]]);
    return { ligne, ajoutee: rang === -1 };
  },

  /**
   * Pose les réglages qui manquent, sans jamais toucher à ceux qui existent.
   *
   * C'est la différence entre compléter et réécrire : le code n'a pas à
   * défaire une décision humaine, même pour la « corriger ».
   */
  completerReglages: (nom, defauts) => {
    const presents = SocleFeuilles.lireReglages(nom);
    const poses = [];
    Object.keys(defauts).forEach((cle) => {
      if (cle in presents && String(presents[cle] ?? '') !== '') return;
      SocleFeuilles.ecrireReglage(nom, cle, defauts[cle]);
      poses.push(cle);
    });
    return { poses };
  },
};

// ===========================================================================
// SocleTexte.gs
// ===========================================================================

/**
 * Socle — texte et échappement. Introduit en v0.1.
 *
 * Tout ce qui part dans du HTML — une boîte de dialogue, une barre latérale,
 * une carte Chat, une application web — passe par ici. Un échappement partiel
 * n'est pas un échappement : une version qui oublie les guillemets laisse
 * passer une injection dès que la valeur atterrit dans un attribut.
 *
 * Ce fichier se recopie tel quel. Il ne dépend d'aucun autre module du socle.
 */

const SOCLE_TEXTE_VERSION_ = '0.12.1';

/**
 * Les cinq remplacements, et pas trois.
 *
 * `&` d'abord, sans quoi les entités produites par les remplacements suivants
 * seraient elles-mêmes échappées. Les deux sortes de guillemets ensuite :
 * elles couvrent le contenu d'un attribut, qu'il soit délimité par `"` ou
 * par `'` — c'est précisément ce qu'oublie un échappement à trois
 * remplacements, et le trou ne se voit qu'une fois exploité.
 */
const SocleTexte = {
  version: SOCLE_TEXTE_VERSION_,

  echapperHtml: (valeur) => String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;'),

  /**
   * Rend une URL sûre à poser dans un `href`, ou `''`.
   *
   * Échapper ne suffit pas : `javascript:alert(1)` ne contient aucun caractère
   * à échapper et s'exécute tout de même. On filtre donc le schéma, en
   * n'autorisant que ceux qui ont un sens dans nos interfaces. Une URL
   * relative est acceptée telle quelle.
   */
  urlSure: (valeur) => {
    const texte = String(valeur ?? '').trim();
    if (texte === '') return '';
    const schema = /^([a-z][a-z0-9+.-]*):/i.exec(texte);
    if (schema && !['http', 'https', 'mailto'].includes(schema[1].toLowerCase())) return '';
    return SocleTexte.echapperHtml(texte);
  },

  /**
   * Tronque sans couper au milieu d'un mot quand c'est possible, et **dit
   * qu'il a tronqué**. Un texte coupé en silence se lit comme un texte
   * complet.
   */
  tronquer: (valeur, maximum, suffixe = '…') => {
    const texte = String(valeur ?? '');
    if (texte.length <= maximum) return texte;
    const brut = texte.slice(0, Math.max(0, maximum - suffixe.length));
    const espace = brut.lastIndexOf(' ');
    return `${espace > maximum / 2 ? brut.slice(0, espace) : brut}${suffixe}`;
  },

  /** Réduit les blancs successifs et retire ceux des extrémités. */
  normaliserEspaces: (valeur) => String(valeur ?? '').replace(/\s+/g, ' ').trim(),

  /**
   * Compare deux textes comme le ferait un humain : sans accents, sans casse,
   * sans blancs superflus. Pour rapprocher une saisie libre d'un référentiel,
   * jamais pour en faire une clé de stockage.
   *
   * Table explicite plutôt que `normalize('NFD')` : la décomposition Unicode
   * dépend d'ICU, dont on ne contrôle ni la présence ni la version dans le
   * moteur qui exécutera ce code. Même raison que les noms de mois du module
   * des dates — ce qui doit être déterministe ne se délègue pas à une locale.
   */
  comparable: (valeur) => {
    const accents = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ';
    const sans = ['a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i',
      'n', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u', 'y', 'y', 'oe', 'ae'];
    return String(valeur ?? '').toLowerCase()
      .split('')
      .map((c) => {
        const rang = accents.indexOf(c);
        return rang === -1 ? c : sans[rang];
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  },
};

// ===========================================================================
// Synchronisation.gs
// ===========================================================================

/**
 * Limiteur de créneaux — la synchronisation et le verdict.
 * Introduit en v0.1.
 *
 * Une seule opération fait tout le travail, et elle est **idempotente** : la
 * relancer deux fois de suite ne change rien la seconde fois. C'est ce qui
 * permet de l'appeler après chaque soumission, depuis le menu, ou après avoir
 * supprimé une ligne à la main, sans jamais avoir à se demander dans quel état
 * on laisse le formulaire.
 *
 * L'ordre des étapes n'est pas indifférent : **on adopte les options nouvelles
 * avant de reposer la liste.** Sans cela, un créneau ajouté à la main dans le
 * formulaire serait effacé à la synchronisation suivante, puisqu'on repose
 * exactement ce que dit le référentiel.
 */

/**
 * Recompte tout et remet le formulaire en accord avec le référentiel.
 *
 * Rend un bilan lisible par un humain plutôt qu'un booléen : c'est ce que
 * le menu affiche, et ce que le journal cite.
 */
const limiteurSynchroniser_ = () => {
  const feuille = limiteurFeuilleDesReponses_();
  const formulaire = limiteurOuvrirLeFormulaire_(feuille);
  const reglages = limiteurReglages_();

  const element = limiteurTrouverLaQuestion_(
    formulaire, reglages['Question des créneaux (titre exact)']);
  const titre = element.getTitle();
  const question = limiteurQuestionTypee_(element);
  const multiple = limiteurEstMultiple_(element);

  limiteurVerifierLaNavigation_(question, titre);

  const libellesDuFormulaire = limiteurLibellesDuFormulaire_(question);

  const margeParDefaut = limiteurEntier_(reglages['Marge par défaut']) || 0;
  let referentiel = limiteurLireReferentiel_(margeParDefaut);
  const adoption = limiteurAdopterLesNouveaux_(referentiel.creneaux, libellesDuFormulaire);
  // Relecture obligatoire après une adoption : les lignes neuves n'ont pas de
  // numéro tant qu'elles n'ont pas été relues, et écrire sans numéro reviendrait
  // à écrire au hasard.
  if (adoption.ajoutes.length > 0) referentiel = limiteurLireReferentiel_(margeParDefaut);

  limiteurVerifierLesLibelles_(referentiel.creneaux, multiple);

  const colonne = SocleTexte.normaliserEspaces(
    reglages['Colonne du créneau dans les réponses']) || titre;

  const comptage = limiteurCompter_(referentiel.creneaux, {
    feuilleDesReponses: feuille,
    colonne,
  });

  const evalues = limiteurEtatDesCreneaux_(referentiel.creneaux, comptage.comptes);
  limiteurEcrireReferentiel_(referentiel.table, evalues);
  // Avant que quiconque ne voie « Non valide » sur un état que le code écrit.
  const validation = limiteurAjusterLaValidationDesEtats_(referentiel.table);

  const aAfficher = evalues.filter((creneau) => creneau.aAfficher)
    .map((creneau) => creneau.libelle);

  // Liste vide : on ne pose rien. Google refuse une question sans option, et
  // le formulaire va de toute façon être fermé juste après — les options
  // restées en place n'y sont plus offertes à personne.
  const pose = aAfficher.length > 0
    ? limiteurPoserLesChoix_(question, aAfficher)
    : { pose: false };

  const ouverture = limiteurAjusterLOuverture_(
    formulaire, aAfficher.length > 0, reglages['Message à la fermeture du formulaire']);

  return {
    titre,
    colonne,
    multiple,
    creneaux: evalues,
    comptage,
    adoptes: adoption.ajoutes,
    inconnus: comptage.inconnus,
    affiches: aAfficher,
    pose,
    ouverture,
    validation,
    reglages,
  };
};

/**
 * Le verdict d'une ligne de réponse, créneau par créneau.
 *
 * Une ligne peut porter plusieurs créneaux quand la question est à cases à
 * cocher ; chacun se juge séparément, et il est normal qu'une personne soit
 * retenue sur l'un et en dépassement sur l'autre.
 *
 * **Le verdict ne tient pas compte de la marge.** La marge sert à retirer
 * l'option en avance ; refuser les places qu'elle réserve reviendrait à
 * perdre ces places pour tout le monde.
 */
const limiteurJugerLaLigne_ = (numeroLigne, bilan) => {
  const parCle = {};
  bilan.creneaux.forEach((creneau) => { parCle[creneau.cle] = creneau; });

  const verdicts = [];
  Object.keys(bilan.comptage.rangs).forEach((clef) => {
    const separateur = clef.indexOf('|');
    if (Number(clef.slice(0, separateur)) !== numeroLigne) return;

    const creneau = parCle[clef.slice(separateur + 1)];
    if (!creneau) return;
    const rang = bilan.comptage.rangs[clef];

    let verdict;
    if (creneau.places === null) verdict = LIMITEUR_VERDICTS_.sansCapacite;
    else if (rang <= creneau.places) verdict = LIMITEUR_VERDICTS_.acceptee;
    else verdict = LIMITEUR_VERDICTS_.surreservation;

    verdicts.push({ creneau, rang, verdict });
  });

  return verdicts;
};

/** La valeur d'une colonne sur une ligne donnée, ou une chaîne vide. */
const limiteurValeurDeLaLigne_ = (table, numeroLigne, nomColonne) => {
  if (!nomColonne || !(nomColonne in table.index)) return '';
  const ligne = table.lignes.find((une) => une.numero === numeroLigne);
  return ligne ? SocleTexte.normaliserEspaces(ligne[nomColonne]) : '';
};

/**
 * Écrit au répondant, directement et sans marqueur.
 *
 * `SocleCourriel` sert à écrire à l'exploitant : ses marqueurs `[Info]` et son
 * anti-répétition par cause y sont précieux. Adressés à un public, ils seraient
 * incompréhensibles — et l'agrégation par cause supprimerait les confirmations
 * de tout le monde sauf la première. Deux destinataires, deux canaux.
 */
const limiteurEcrireAuRepondant_ = (destinataire, objet, corps) => {
  if (String(destinataire ?? '').trim() === '') return { envoye: false, motif: 'sans adresse' };

  // Lire le quota avant plutôt qu'échouer à mi-parcours : 100 envois par jour
  // sur un compte grand public, 1 500 sur Workspace. Un essai concluant sur un
  // compte personnel ne dit donc rien de la production.
  if (MailApp.getRemainingDailyQuota() <= 0) {
    return { envoye: false, motif: 'quota d’envoi épuisé pour aujourd’hui' };
  }

  MailApp.sendEmail({ to: destinataire, subject: objet, body: corps });
  return { envoye: true, motif: '' };
};

/**
 * Le rang, écrit comme on l'écrit en français.
 *
 * « 1ᵉ personne » n'est pas du français, et ce message est lu par des gens qui
 * n'ont rien demandé à personne : la première est « 1ʳᵉ ».
 */
const limiteurRang_ = (n) => `${n}${n === 1 ? 'ʳᵉ' : 'ᵉ'}`;

/** Le corps du message de confirmation, en français lisible par n'importe qui. */
const limiteurCorpsConfirmation_ = (verdict) => [
  'Bonjour,',
  '',
  `Votre inscription au créneau « ${verdict.creneau.libelle} » est enregistrée.`,
  `Vous êtes la ${limiteurRang_(verdict.rang)} personne inscrite sur ce créneau, `
    + `qui en compte ${verdict.creneau.places}.`,
  '',
  'Si vous ne pouvez plus venir, prévenez l’organisateur : votre place sera '
    + 'rendue à quelqu’un d’autre.',
].join('\n');

/** Le corps du message de dépassement. Il dit pourquoi, sans jargon. */
const limiteurCorpsSurreservation_ = (verdict) => [
  'Bonjour,',
  '',
  `Votre demande pour le créneau « ${verdict.creneau.libelle} » nous est bien `
    + 'parvenue, mais ce créneau était complet au moment où elle est arrivée.',
  '',
  `Il compte ${verdict.creneau.places} places et vous êtes la `
    + `${limiteurRang_(verdict.rang)} personne inscrite : vous êtes donc en `
    + 'liste d’attente.',
  '',
  'Cela arrive quand plusieurs personnes remplissent le formulaire en même temps, '
    + 'ou quand la page était ouverte depuis un moment. L’organisateur vous '
    + 'recontactera si une place se libère.',
].join('\n');

/**
 * Traite une soumission : synchronise, juge, journalise, écrit.
 *
 * Tout est sous un verrou unique. Il ne supprime pas la surréservation — au
 * moment où ce code s'exécute, la réponse est déjà enregistrée et Google ne
 * sait pas la refuser — mais il garantit que deux traitements simultanés ne
 * comptent pas chacun de leur côté et n'écrivent pas deux états contradictoires.
 */
const limiteurTraiterLaSoumission_ = (numeroLigne) => {
  const bilan = limiteurSynchroniser_();
  const ligne = numeroLigne || bilan.comptage.table.lignes.length + 1;
  const verdicts = limiteurJugerLaLigne_(ligne, bilan);

  const horodatage = SocleDates.maintenantHorodatage();
  const destinataire = limiteurValeurDeLaLigne_(
    bilan.comptage.table, ligne, bilan.reglages['Colonne de l’adresse e-mail']);
  const confirmer = limiteurEstOui_(bilan.reglages['Envoyer une confirmation']);

  if (verdicts.length === 0) {
    const brut = limiteurValeurDeLaLigne_(bilan.comptage.table, ligne, bilan.colonne);
    limiteurJournaliser_({
      Horodatage: horodatage,
      Ligne: ligne,
      'Créneau': brut,
      Verdict: brut === '' ? 'Sans créneau' : LIMITEUR_VERDICTS_.horsReferentiel,
      Destinataire: destinataire,
      Courriel: 'non',
    });
    return { bilan, verdicts, envois: [] };
  }

  const envois = verdicts.map((verdict) => {
    let envoi = { envoye: false, motif: 'confirmation désactivée' };

    if (verdict.verdict === LIMITEUR_VERDICTS_.surreservation) {
      // Le dépassement se dit toujours, même confirmation désactivée : laisser
      // quelqu'un croire qu'il a une place qu'il n'a pas est le seul défaut
      // vraiment coûteux de ce montage.
      envoi = limiteurEcrireAuRepondant_(destinataire,
        `Liste d’attente — ${verdict.creneau.libelle}`,
        limiteurCorpsSurreservation_(verdict));
    } else if (confirmer && verdict.verdict === LIMITEUR_VERDICTS_.acceptee) {
      envoi = limiteurEcrireAuRepondant_(destinataire,
        `${bilan.reglages['Objet de la confirmation']} — ${verdict.creneau.libelle}`,
        limiteurCorpsConfirmation_(verdict));
    } else if (verdict.verdict === LIMITEUR_VERDICTS_.sansCapacite) {
      envoi = { envoye: false, motif: 'créneau sans capacité définie' };
    }

    limiteurJournaliser_({
      Horodatage: horodatage,
      Ligne: ligne,
      'Créneau': verdict.creneau.libelle,
      Rang: verdict.rang,
      Places: verdict.creneau.places === null ? '' : verdict.creneau.places,
      Verdict: verdict.verdict,
      Destinataire: destinataire,
      Courriel: envoi.envoye ? 'envoyé' : `non (${envoi.motif})`,
    });

    return { verdict, envoi };
  });

  limiteurAlerterSiBesoin_(bilan, verdicts);
  return { bilan, verdicts, envois };
};

/**
 * Prévient l'exploitant de ce qu'il ne verra pas autrement.
 *
 * Passe par `SocleCourriel.erreur`, dont l'anti-répétition agrège par cause :
 * une campagne qui déborde produit une alerte, pas trois cents.
 */
const limiteurAlerterSiBesoin_ = (bilan, verdicts) => {
  const destinataire = SocleTexte.normaliserEspaces(
    bilan.reglages['Destinataire des alertes']);
  if (destinataire === '') return { alerte: false };

  const debordements = verdicts.filter(
    (un) => un.verdict === LIMITEUR_VERDICTS_.surreservation);
  if (debordements.length === 0) return { alerte: false };

  SocleCourriel.erreur({
    a: destinataire,
    quoi: `Une inscription a dépassé la capacité du créneau `
      + `« ${debordements[0].creneau.libelle} ».`,
    quoiFaire: 'Ouvrez l’onglet « Journal » pour voir qui est en liste d’attente, '
      + 'et recontactez ces personnes. Pour réduire ces dépassements, augmentez '
      + 'la « Marge » du créneau dans l’onglet « Créneaux ».',
    cause: `Rang ${debordements[0].rang} pour `
      + `${debordements[0].creneau.places} place(s).`,
    cle: `surreservation:${debordements[0].creneau.cle}`,
    source: 'Limiteur de créneaux',
  });
  return { alerte: true };
};

// ---------------------------------------------------------------------------
// Le filet du déclencheur
// ---------------------------------------------------------------------------

/**
 * À qui dire qu'un déclencheur a échoué.
 *
 * Le réglage d'abord. À défaut, **la personne qui a posé le déclencheur** : il
 * s'exécute sous son identité, et sans destinataire l'échec resterait muet —
 * c'est-à-dire exactement ce que ce filet existe pour empêcher.
 *
 * La lecture des réglages est elle-même enveloppée : l'onglet « Réglages » est
 * parfois ce qui a échoué, et un filet qui tombe en cherchant à qui écrire ne
 * sert à rien.
 */
const limiteurDestinataireDesAlertes_ = () => {
  const duReglage = SocleErreurs.absorber('lecture des réglages pour l’alerte', () => {
    const reglages = limiteurReglages_();
    return SocleTexte.normaliserEspaces(reglages['Destinataire des alertes']);
  }, '');
  if (duReglage !== '') return duReglage;

  return SocleErreurs.absorber('lecture de l’utilisateur effectif',
    () => Session.getEffectiveUser().getEmail(), '');
};

/**
 * Écrit l'échec au Journal, sans jamais devenir lui-même la cause d'un échec.
 *
 * C'est le seul endroit du projet où un `catch` muet se justifie : on est déjà
 * en train de traiter une erreur, et lever ici la remplacerait par une autre,
 * moins parlante. On la pousse tout de même dans le journal d'exécution, pour
 * qu'elle ne disparaisse pas complètement.
 */
const limiteurJournaliserLEchec_ = (entree) => {
  try {
    limiteurJournaliser_(entree);
    return true;
  } catch (erreur) {
    console.error(`Le Journal est inaccessible : ${erreur.message || erreur}. `
      + `Échec non consigné pour la ligne ${entree.Ligne}.`);
    return false;
  }
};

/**
 * Traite l'échec : le consigne, et prévient quelqu'un.
 *
 * `SocleCourriel.erreur` agrège **par cause** : la clé est le message, jamais
 * le numéro de ligne. Une campagne dont chaque soumission échoue pour la même
 * raison produit une alerte, pas trois cents — et celle qui repart au bout du
 * silence dit combien de fois la cause est survenue entre-temps.
 */
const limiteurSignalerLEchec_ = (ligne, erreur) => {
  const attendue = SocleErreurs.estAttendue(erreur);
  const message = String((erreur && erreur.message) || erreur);

  const quoi = attendue
    ? erreur.quoi
    : `Le limiteur n’a pas pu traiter la réponse de la ligne ${ligne}.`;
  const quoiFaire = attendue
    ? erreur.quoiFaire
    : 'Lancez « Créneaux > Recompter et mettre à jour le formulaire » : le message '
      + 'complet s’affichera et dira quoi corriger. Tant que la cause dure, les '
      + 'créneaux complets ne sont plus retirés du formulaire.';

  const destinataire = limiteurDestinataireDesAlertes_();
  const envoi = SocleErreurs.absorber('envoi de l’alerte d’échec', () => {
    if (destinataire === '') return { envoye: false, motif: 'aucun destinataire connu' };
    SocleCourriel.erreur({
      a: destinataire,
      quoi,
      quoiFaire,
      cause: message,
      // La cause, pas l'occurrence : même défaut, même clé, une seule alerte.
      cle: `echec:${SocleTexte.tronquer(attendue ? erreur.quoi : message, 120, '')}`,
      source: 'Limiteur de créneaux',
    });
    return { envoye: true, motif: '' };
  }, { envoye: false, motif: 'l’envoi lui-même a échoué' });

  const consigne = limiteurJournaliserLEchec_({
    Horodatage: SocleErreurs.absorber('horodatage de l’échec',
      () => SocleDates.maintenantHorodatage(), ''),
    Ligne: ligne === null ? '' : ligne,
    Verdict: LIMITEUR_VERDICTS_.echec,
    Destinataire: destinataire,
    Courriel: envoi.envoye ? 'alerte envoyée' : `non (${envoi.motif})`,
    // Ce qu'il faut lire pour comprendre : le refus porte son remède, et c'est
    // lui qui est utile — pas la trace technique.
    'Ce qui a échoué': `${quoi} ${quoiFaire}`,
  });

  return { fait: false, echec: true, quoi, quoiFaire, envoi, consigne };
};

/**
 * Le filet : rien de ce qui se passe ici ne doit pouvoir tuer le déclencheur.
 *
 * Sans lui, une seule cause — un saut de section ajouté au formulaire, une
 * question renommée, une colonne calculée déplacée — arrête le limiteur pour de
 * bon : Google envoie au propriétaire un message technique qu'il lira ou non,
 * et les créneaux complets restent affichés, soumission après soumission, sans
 * que rien dans le classeur ne le dise.
 *
 * **L'erreur n'est pas relevée.** La relever ferait partir un second courriel,
 * celui de Google, technique et en doublon du nôtre — qui, lui, dit quoi faire.
 * Elle part en revanche dans le journal d'exécution, où un administrateur la
 * cherchera : la trace existe, à l'endroit où elle sert.
 *
 * Le verrou est **à l'intérieur** du filet, et non l'inverse : un contexte sans
 * verrou disponible doit lui aussi être signalé plutôt que de tout arrêter.
 */
const limiteurSousFilet_ = (ligne) => {
  try {
    // On n'emprunte PAS `SocleExecution.sousVerrou` ici, et c'est délibéré : il
    // pose `tryLock(0)` et rend la main aussitôt. Pour une entrée de menu c'est
    // juste — quelqu'un est devant l'écran et relancera. Pour une soumission,
    // c'est une perte sèche : la réponse ne recevra jamais de verdict, donc ni
    // ligne au Journal, ni courriel. Une personne en dépassement croirait avoir
    // une place.
    //
    // Payé en conditions réelles le 18 septembre 2026 : « Soumission ligne 10 :
    // Une exécution est déjà en cours sur ce document. » Le commentaire d'alors
    // affirmait que l'exécution tenant le verrou recompterait cette ligne. C'est
    // vrai du comptage, et faux du verdict — elle avait déjà lu la feuille.
    const verrou = LockService.getDocumentLock() || LockService.getScriptLock();
    if (!verrou) {
      throw SocleErreurs.erreur({
        quoi: 'Aucun verrou n’est disponible dans ce contexte.',
        quoiFaire: 'Relancez depuis un projet lié à un classeur.',
      });
    }

    if (!verrou.tryLock(LIMITEUR_ATTENTE_VERROU_MS_)) {
      return limiteurSignalerLAbandon_(ligne);
    }
    try {
      return { fait: true, valeur: limiteurTraiterLaSoumission_(ligne) };
    } finally {
      verrou.releaseLock();
    }
  } catch (erreur) {
    console.error(`Limiteur de créneaux, ligne ${ligne} : ${erreur.stack || erreur}`);
    return limiteurSignalerLEchec_(ligne, erreur);
  }
};

/**
 * La soumission qu'on n'a pas pu traiter, faute d'avoir obtenu le verrou.
 *
 * Elle se consigne, parce qu'elle a une conséquence : les créneaux se
 * rétabliront au prochain recomptage — le comptage lit la feuille — mais **le
 * verdict, lui, est perdu**. Personne ne saura que cette personne dépassait la
 * capacité si elle la dépassait, et elle n'aura reçu aucun message.
 *
 * Une ligne rouge au Journal vaut mieux qu'un silence : c'est la seule trace
 * qui permette de rattraper à la main.
 */
const limiteurSignalerLAbandon_ = (ligne) => {
  const quoiFaire = 'Cette réponse sera comptée dans les créneaux au prochain '
    + 'recomptage, mais elle n’a reçu aucun verdict et aucun message n’est parti. '
    + 'Ouvrez « Établir les listes » pour voir le rang de cette personne : si elle '
    + 'est en liste d’attente, prévenez-la vous-même.';

  const destinataire = limiteurDestinataireDesAlertes_();
  const envoi = SocleErreurs.absorber('alerte d’abandon', () => {
    if (destinataire === '') return { envoye: false, motif: 'aucun destinataire connu' };
    SocleCourriel.erreur({
      a: destinataire,
      quoi: `Une réponse (ligne ${ligne}) n’a pas pu être traitée : une autre `
        + 'soumission occupait le document.',
      quoiFaire,
      cause: `Verrou indisponible après ${LIMITEUR_ATTENTE_VERROU_MS_ / 1000} s.`,
      cle: 'abandon:verrou',
      source: 'Limiteur de créneaux',
    });
    return { envoye: true, motif: '' };
  }, { envoye: false, motif: 'l’envoi lui-même a échoué' });

  limiteurJournaliserLEchec_({
    Horodatage: SocleErreurs.absorber('horodatage de l’abandon',
      () => SocleDates.maintenantHorodatage(), ''),
    Ligne: ligne === null ? '' : ligne,
    Verdict: LIMITEUR_VERDICTS_.nonTraitee,
    Destinataire: destinataire,
    Courriel: envoi.envoye ? 'alerte envoyée' : `non (${envoi.motif})`,
    'Ce qui a échoué': `Une autre soumission occupait le document plus de `
      + `${LIMITEUR_ATTENTE_VERROU_MS_ / 1000} s. ${quoiFaire}`,
  });

  return { fait: false, abandon: true, ligne, quoiFaire };
};

// ===========================================================================
// Verification.gs
// ===========================================================================

/**
 * Limiteur de créneaux — le diagnostic d'installation.
 * Introduit en v0.4.
 *
 * Tout ce qui est contrôlé ici ne se découvrait jusqu'alors qu'à la première
 * soumission — c'est-à-dire devant un vrai répondant, une fois les inscriptions
 * ouvertes. Le filet du déclencheur empêche désormais qu'une telle découverte
 * arrête l'outil ; ce module la fait arriver avant.
 *
 * ── La règle qui gouverne ce fichier ────────────────────────────────────────
 *
 * **Un contrôle qui n'a pas pu s'exécuter dit « Non mesuré », jamais « Bon ».**
 * Si le formulaire est injoignable, on ne sait rien de sa question, de sa
 * navigation ni de ses libellés : les annoncer bons serait un mensonge, et le
 * plus coûteux qui soit — celui qui rassure. Chaque contrôle en aval d'un échec
 * dit donc ce qu'il n'a pas pu vérifier, et pourquoi.
 *
 * Aucun contrôle ne modifie quoi que ce soit. Le diagnostic se lance sur une
 * campagne en cours sans rien y changer — seul l'onglet du rapport est écrit.
 */

const LIMITEUR_ONGLET_VERIFICATION_ = 'Vérification';

const LIMITEUR_COLONNES_VERIFICATION_ = ['Contrôle', 'État', 'Constat', 'Quoi faire'];

/**
 * Les quatre états d'un contrôle.
 *
 * « À vérifier » n'est pas un demi-échec : c'est ce qui fonctionnera, mais
 * probablement pas comme on l'attend. Le distinguer de « Bloquant » évite qu'on
 * s'habitue à voir du rouge et qu'on cesse de le lire.
 */
const LIMITEUR_CONTROLES_ = {
  bon: 'Bon',
  aVerifier: 'À vérifier',
  bloquant: 'Bloquant',
  nonMesure: 'Non mesuré',
};

/** Le texte d'une erreur, qu'elle porte un remède ou non. */
const limiteurVerifTexte_ = (erreur) => (SocleErreurs.estAttendue(erreur)
  ? { constat: erreur.quoi, quoiFaire: erreur.quoiFaire }
  : { constat: String((erreur && erreur.message) || erreur), quoiFaire: '' });

/**
 * Passe l'installation en revue, sans rien modifier.
 *
 * Écrit en une suite linéaire plutôt qu'en tableau de contrôles indépendants :
 * chacun a besoin de ce que le précédent a trouvé, et un enchaînement explicite
 * se lit mieux qu'une mécanique de dépendances.
 */
const limiteurVerifierLInstallation_ = () => {
  const controles = [];
  const dire = (nom, etat, constat, quoiFaire = '') => {
    controles.push({ nom, etat, constat, quoiFaire });
  };
  const tu = (nom, raison) => dire(nom, LIMITEUR_CONTROLES_.nonMesure, '', raison);

  // --- Le classeur et le formulaire ----------------------------------------

  let feuille = null;
  try {
    feuille = limiteurFeuilleDesReponses_();
    dire('Le classeur reçoit des réponses', LIMITEUR_CONTROLES_.bon,
      `Onglet « ${feuille.getName()} ».`);
  } catch (erreur) {
    const { constat, quoiFaire } = limiteurVerifTexte_(erreur);
    dire('Le classeur reçoit des réponses', LIMITEUR_CONTROLES_.bloquant,
      constat, quoiFaire);
  }

  let formulaire = null;
  if (!feuille) {
    tu('Le formulaire est joignable', 'Aucune feuille de réponses n’a été trouvée : '
      + 'il n’y a pas de formulaire à ouvrir.');
  } else {
    try {
      formulaire = limiteurOuvrirLeFormulaire_(feuille);
      dire('Le formulaire est joignable', LIMITEUR_CONTROLES_.bon,
        formulaire.isAcceptingResponses()
          ? 'Ouvert aux réponses.'
          : 'Joignable, mais il n’accepte pas de réponses en ce moment.',
        formulaire.isAcceptingResponses() ? '' : 'Si ce n’est pas voulu, rouvrez-le '
          + 'depuis le formulaire, ou lancez « Recompter » : l’outil le rouvrira '
          + 'lui-même s’il reste des places et que c’est lui qui l’avait fermé.');
    } catch (erreur) {
      const { constat, quoiFaire } = limiteurVerifTexte_(erreur);
      dire('Le formulaire est joignable', LIMITEUR_CONTROLES_.bloquant, constat, quoiFaire);
    }
  }

  const reglages = SocleErreurs.absorber('lecture des réglages', () => limiteurReglages_(), null);
  if (!reglages) {
    tu('Les réglages sont lisibles', 'L’onglet « Réglages » n’a pas pu être lu.');
  } else {
    dire('Les réglages sont lisibles', LIMITEUR_CONTROLES_.bon,
      `${Object.keys(reglages).length} réglages en place.`);
  }

  // --- La question pilotée --------------------------------------------------

  let element = null;
  let question = null;
  if (!formulaire || !reglages) {
    tu('La question des créneaux est pilotable',
      'Le formulaire n’a pas pu être ouvert : on ne sait rien de ses questions.');
    tu('Aucune option ne commande un saut de section',
      'La question n’a pas pu être identifiée.');
  } else {
    try {
      element = limiteurTrouverLaQuestion_(
        formulaire, reglages['Question des créneaux (titre exact)']);
      question = limiteurQuestionTypee_(element);
      dire('La question des créneaux est pilotable', LIMITEUR_CONTROLES_.bon,
        `« ${element.getTitle()} », ${question.getChoices().length} option(s).`);
    } catch (erreur) {
      const { constat, quoiFaire } = limiteurVerifTexte_(erreur);
      dire('La question des créneaux est pilotable', LIMITEUR_CONTROLES_.bloquant,
        constat, quoiFaire);
    }

    if (!question) {
      tu('Aucune option ne commande un saut de section',
        'La question n’a pas pu être identifiée.');
    } else {
      try {
        limiteurVerifierLaNavigation_(question, element.getTitle());
        dire('Aucune option ne commande un saut de section', LIMITEUR_CONTROLES_.bon,
          'Les options sont toutes neutres.');
      } catch (erreur) {
        const { constat, quoiFaire } = limiteurVerifTexte_(erreur);
        dire('Aucune option ne commande un saut de section',
          LIMITEUR_CONTROLES_.bloquant, constat, quoiFaire);
      }
    }
  }

  // --- Le référentiel -------------------------------------------------------

  const referentiel = SocleErreurs.absorber('lecture du référentiel',
    () => limiteurLireReferentiel_(reglages
      ? limiteurEntier_(reglages['Marge par défaut']) || 0 : 0),
    null);

  if (!referentiel) {
    tu('Chaque créneau a une capacité', 'L’onglet « Créneaux » n’a pas pu être lu.');
    tu('Aucune marge n’annule son créneau', 'L’onglet « Créneaux » n’a pas pu être lu.');
  } else {
    const sans = referentiel.creneaux.filter((un) => un.places === null);
    // Zéro créneau n'est pas « tous ont une capacité » : c'est un référentiel
    // vide, et l'annoncer bon serait la façon la plus sûre de ne pas le voir.
    const capacitesFaites = referentiel.creneaux.length > 0 && sans.length === 0;
    dire('Chaque créneau a une capacité',
      capacitesFaites ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.aVerifier,
      referentiel.creneaux.length === 0
        ? 'Aucun créneau au référentiel.'
        : `${referentiel.creneaux.length - sans.length} sur `
          + `${referentiel.creneaux.length} créneau(x) ont une capacité.`,
      referentiel.creneaux.length === 0
        ? 'Ouvrez le formulaire, ajoutez des options à la question des créneaux, '
          + 'puis lancez « Recompter » : elles seront reprises ici.'
        : (sans.length === 0 ? '' : `Renseignez la colonne « Places » pour : `
        + `${sans.map((un) => un.libelle).join(', ')}. Tant qu’elle est vide, `
        + 'ces créneaux ne seront jamais retirés du formulaire.'));

    // Une marge supérieure ou égale à la capacité rend le créneau complet dès
    // zéro inscription : il disparaît sans que personne n'ait pu s'y inscrire.
    const absurdes = referentiel.creneaux.filter(
      (un) => un.places !== null && un.marge >= un.places);
    dire('Aucune marge n’annule son créneau',
      absurdes.length === 0 ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.bloquant,
      absurdes.length === 0 ? 'Les marges laissent des places ouvertes.'
        : `${absurdes.length} créneau(x) ont une marge au moins égale à leur capacité.`,
      absurdes.length === 0 ? '' : `Abaissez la marge de : `
        + `${absurdes.map((un) => `${un.libelle} (marge ${un.marge}, `
          + `${un.places} places)`).join(', ')}. En l’état, ils sont complets dès `
        + 'zéro inscription et personne ne pourra jamais les choisir.');
  }

  // --- La concordance des libellés -----------------------------------------

  if (!question || !referentiel) {
    tu('Les libellés concordent',
      'Il faut la question du formulaire et le référentiel pour les comparer.');
  } else {
    const duFormulaire = limiteurLibellesDuFormulaire_(question);
    const auReferentiel = new Set(referentiel.creneaux.map((un) => un.cle));
    const aAdopter = [];
    duFormulaire.forEach((libelle, cle) => {
      if (!auReferentiel.has(cle)) aAdopter.push(libelle);
    });
    // Un créneau du référentiel que le formulaire ne propose pas n'est pas
    // forcément une faute : c'est l'état normal d'un créneau complet, que
    // l'outil a retiré et remettra. On ne le signale donc que s'il est ouvert.
    const jamaisProposes = referentiel.creneaux.filter((un) => (
      !duFormulaire.has(un.cle)
      && un.places !== null
      && un.etatLu !== LIMITEUR_ETATS_.complet
      && un.etatLu !== LIMITEUR_ETATS_.completParMarge
      && un.etatLu !== LIMITEUR_ETATS_.ferme));

    const soucis = aAdopter.length + jamaisProposes.length;
    dire('Les libellés concordent',
      soucis === 0 ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.aVerifier,
      soucis === 0 ? 'Le formulaire et le référentiel parlent des mêmes créneaux.'
        : `${aAdopter.length} option(s) inconnue(s) du référentiel, `
          + `${jamaisProposes.length} créneau(x) ouverts que le formulaire ne propose pas.`,
      soucis === 0 ? '' : [
        aAdopter.length === 0 ? '' : `Seront adoptés à la prochaine synchronisation, `
          + `sans capacité : ${aAdopter.join(', ')}.`,
        jamaisProposes.length === 0 ? '' : `Absents du formulaire alors qu’ils ont `
          + `des places : ${jamaisProposes.map((un) => un.libelle).join(', ')}. `
          + 'Un libellé a sans doute été modifié d’un seul côté.',
      ].filter((un) => un !== '').join(' '));
  }

  // --- Les réponses déjà reçues --------------------------------------------

  const colonne = (reglages && element)
    ? SocleTexte.normaliserEspaces(reglages['Colonne du créneau dans les réponses'])
      || element.getTitle()
    : null;

  let table = null;
  if (!feuille || !colonne || !referentiel) {
    tu('Chaque réponse tombe sur un créneau connu',
      'Il faut la feuille des réponses, la question et le référentiel pour les rapprocher.');
    tu('Les réponses sont dans leur ordre d’arrivée',
      'La feuille des réponses n’a pas pu être lue.');
  } else {
    const comptage = SocleErreurs.absorber('comptage des réponses',
      () => limiteurCompter_(referentiel.creneaux, { feuilleDesReponses: feuille, colonne }),
      null);

    if (!comptage) {
      tu('Chaque réponse tombe sur un créneau connu',
        `La colonne « ${colonne} » est introuvable dans la feuille des réponses.`);
      tu('Les réponses sont dans leur ordre d’arrivée',
        'Le comptage n’a pas pu avoir lieu.');
    } else {
      table = comptage.table;
      const inconnus = Object.keys(comptage.inconnus);
      dire('Chaque réponse tombe sur un créneau connu',
        inconnus.length === 0 ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.aVerifier,
        `${comptage.lignes} réponse(s) lue(s) sur la colonne « ${colonne} ».`,
        inconnus.length === 0 ? '' : `${inconnus.length} valeur(s) ne correspondent à `
          + `aucun créneau et ne sont donc comptées nulle part : `
          + `${inconnus.map((un) => `« ${un} » (${comptage.inconnus[un]})`).join(', ')}. `
          + 'Corrigez le libellé dans l’onglet « Créneaux », ou dans le formulaire.');

      // Le rang d'une personne vient du numéro de ligne. Trier la feuille
      // déplace donc la frontière entre les retenus et la liste d'attente,
      // sans que rien ne le signale.
      const desordre = limiteurVerifDesordre_(table);
      dire('Les réponses sont dans leur ordre d’arrivée',
        desordre.trie ? LIMITEUR_CONTROLES_.aVerifier
          : (desordre.mesure ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.nonMesure),
        desordre.constat, desordre.quoiFaire);
    }
  }

  // --- L'envoi et le déclencheur -------------------------------------------

  if (!reglages) {
    tu('Les adresses nécessaires sont collectées', 'Les réglages n’ont pas pu être lus.');
  } else if (!limiteurEstOui_(reglages['Envoyer une confirmation'])) {
    dire('Les adresses nécessaires sont collectées', LIMITEUR_CONTROLES_.bon,
      'La confirmation est désactivée ; seuls les dépassements sont annoncés.',
      'Un dépassement part toujours, même confirmation désactivée. Sans adresse '
      + 'collectée, il ne partira pas et le Journal le dira.');
  } else if (!table) {
    tu('Les adresses nécessaires sont collectées',
      'La feuille des réponses n’a pas pu être lue.');
  } else {
    const cible = SocleTexte.normaliserEspaces(reglages['Colonne de l’adresse e-mail']);
    const presente = cible !== '' && (cible in table.index);
    dire('Les adresses nécessaires sont collectées',
      presente ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.bloquant,
      presente ? `Colonne « ${cible} ».`
        : `La confirmation est activée, mais la colonne « ${cible} » n’existe pas.`,
      presente ? '' : 'Dans le formulaire, activez « Collecter les adresses e-mail », '
        + 'ou corrigez le réglage « Colonne de l’adresse e-mail » pour qu’il nomme '
        + 'une colonne existante.');
  }

  const declencheurs = SocleErreurs.absorber('lecture des déclencheurs',
    () => ScriptApp.getProjectTriggers()
      .filter((un) => un.getHandlerFunction() === LIMITEUR_DECLENCHEUR_).length,
    null);

  if (declencheurs === null) {
    tu('Le déclencheur est posé', 'Les déclencheurs du projet n’ont pas pu être lus.');
  } else {
    dire('Le déclencheur est posé',
      declencheurs === 1 ? LIMITEUR_CONTROLES_.bon
        : (declencheurs === 0 ? LIMITEUR_CONTROLES_.bloquant : LIMITEUR_CONTROLES_.aVerifier),
      `${declencheurs} déclencheur(s) sur « ${LIMITEUR_DECLENCHEUR_} ».`,
      declencheurs === 1 ? ''
        : (declencheurs === 0
          ? 'Rien ne se passera à la réception d’une réponse. Lancez « Installer ou '
            + 'mettre à jour » pour le poser.'
          : 'Chaque réponse sera traitée plusieurs fois, et autant de courriels '
            + 'partiront. Lancez « Installer ou mettre à jour » : il retire les siens '
            + 'avant d’en poser un.'));
  }

  const quota = SocleErreurs.absorber('lecture du quota d’envoi',
    () => MailApp.getRemainingDailyQuota(), null);
  if (quota === null) {
    tu('Il reste du quota d’envoi', 'Le quota n’a pas pu être lu.');
  } else {
    dire('Il reste du quota d’envoi',
      quota > 20 ? LIMITEUR_CONTROLES_.bon : LIMITEUR_CONTROLES_.aVerifier,
      `${quota} envoi(s) restants aujourd’hui.`,
      quota > 20 ? '' : 'Le quota vaut 100 par jour sur un compte grand public et '
        + '1 500 sur Workspace. Un dépassement non annoncé est le défaut le plus '
        + 'coûteux de cet outil : attendez demain pour ouvrir les inscriptions, ou '
        + 'utilisez un compte Workspace.');
  }

  const resume = { bon: 0, aVerifier: 0, bloquant: 0, nonMesure: 0 };
  controles.forEach(({ etat }) => {
    Object.keys(LIMITEUR_CONTROLES_).forEach((clef) => {
      if (LIMITEUR_CONTROLES_[clef] === etat) resume[clef] += 1;
    });
  });

  return { controles, resume };
};

/**
 * Les réponses sont-elles encore dans leur ordre d'arrivée ?
 *
 * La première colonne d'une feuille liée est l'horodatage, quel que soit son
 * nom — il change avec la langue du compte. On la lit donc par sa position, ce
 * qui est le seul cas de tout le projet où c'est justifié.
 *
 * Sheets rend une vraie `Date` : on normalise avant de comparer, sans quoi on
 * comparerait « Thu May 14 2026 » à « Tue May 12 2026 », c'est-à-dire des noms
 * de jours.
 */
const limiteurVerifDesordre_ = (table) => {
  // Zéro ou une réponse : l’ordre est trivialement bon. C’est mesuré, et non
  // « non mesuré » — la distinction porte sur ce qu’on a PU vérifier, jamais
  // sur la quantité trouvée. Les confondre ferait dire « je ne sais pas » à un
  // contrôle qui sait.
  if (table.lignes.length < 2) {
    return {
      mesure: true,
      trie: false,
      constat: `${table.lignes.length} réponse(s) : il n’y a pas d’ordre à vérifier.`,
      quoiFaire: '',
    };
  }
  const nom = table.entete[0];
  const horodatages = table.lignes.map((ligne) => SocleErreurs.absorber(
    'normalisation d’un horodatage',
    () => SocleDates.horodatage(ligne.cellules[0]), ''));

  if (horodatages.some((un) => un === '')) {
    return {
      mesure: false,
      trie: false,
      constat: `La colonne « ${nom} » ne contient pas que des dates.`,
      quoiFaire: 'Sans horodatage lisible, on ne peut pas dire si la feuille a été '
        + 'triée. Les rangs restent ceux de l’ordre des lignes.',
    };
  }

  const fautes = horodatages.filter((un, rang) => rang > 0 && un < horodatages[rang - 1]);
  return {
    mesure: true,
    trie: fautes.length > 0,
    constat: fautes.length === 0
      ? `${horodatages.length} réponse(s), horodatages croissants.`
      : `${fautes.length} réponse(s) arrivent avant celle qui les précède.`,
    quoiFaire: fautes.length === 0 ? '' : 'La feuille des réponses a été triée. Le '
      + 'rang de chaque personne vient du numéro de ligne : ce tri a donc déplacé la '
      + 'frontière entre les personnes retenues et celles en liste d’attente. '
      + 'Rétablissez l’ordre par horodatage croissant, et utilisez un filtre plutôt '
      + 'qu’un tri pour regarder les données autrement.',
  };
};

/** Écrit le rapport dans son onglet, qui n'appartient qu'au code. */
const limiteurEcrireLaVerification_ = (controles) => {
  limiteurExigerOngletANous_(LIMITEUR_ONGLET_VERIFICATION_, LIMITEUR_COLONNES_VERIFICATION_);
  const lignes = controles.map((un) => [un.nom, un.etat, un.constat, un.quoiFaire]);
  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_VERIFICATION_,
    LIMITEUR_COLONNES_VERIFICATION_, lignes);
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_VERIFICATION_);
  [280, 110, 320, 560].forEach((largeur, rang) => {
    feuille.setColumnWidth(rang + 1, largeur);
  });
  // ecrireTable passe par clear(), qui emporte les notes et les règles de
  // couleur avec le contenu : un onglet réécrit se retrouverait nu.
  limiteurHabiller_(LIMITEUR_ONGLET_VERIFICATION_);
  return { lignes: lignes.length };
};
