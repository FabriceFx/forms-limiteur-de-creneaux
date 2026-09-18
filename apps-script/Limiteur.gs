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

const LIMITEUR_VERSION_ = '0.7.2';

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
  ferme: 'Fermé à la main',
  sansCapacite: 'Sans capacité',
};

const LIMITEUR_VERDICTS_ = {
  acceptee: 'Acceptée',
  surreservation: 'Surréservation',
  horsReferentiel: 'Hors référentiel',
  sansCapacite: 'Sans capacité',
  echec: 'Échec',
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
    else if (pris + creneau.marge >= creneau.places) etat = LIMITEUR_ETATS_.complet;
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

/** Ajoute une ligne au journal, sans jamais en réécrire une ancienne. */
const limiteurJournaliser_ = (entree) => {
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_JOURNAL_);
  const ligne = LIMITEUR_COLONNES_JOURNAL_.map((nom) => (entree[nom] === undefined
    ? '' : entree[nom]));
  feuille.getRange(Math.max(feuille.getLastRow(), 1) + 1, 1, 1, ligne.length)
    .setValues([ligne]);
  return ligne;
};
