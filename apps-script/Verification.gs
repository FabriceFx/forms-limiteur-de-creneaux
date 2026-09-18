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
