/**
 * Contrôle en conditions réelles — n'existe que dans le dossier d'essai.
 * Introduit en v0.7.
 *
 * Il éprouve **ce que le banc ne peut pas voir**. Les faux services de
 * `banc/test.js` reproduisent ce que je crois savoir de Google ; ce fichier
 * demande à Google s'il avait raison.
 *
 * Trois hypothèses portent du code de refus depuis la première version et n'ont
 * jamais été vérifiées ailleurs que dans la documentation :
 *
 *   - `setChoiceValues` efface la navigation par section — c'est là-dessus que
 *     repose le refus de piloter une telle question ;
 *   - une question à choix ne peut pas rester sans option — c'est pourquoi on
 *     ferme le formulaire plutôt que de vider la liste ;
 *   - le déclencheur de soumission part **après** l'écriture de la ligne — d'où
 *     `forSpreadsheet` plutôt que `forForm`.
 *
 * Le contrôle ne laisse rien derrière lui : les formulaires qu'il crée partent
 * à la corbeille, et il n'envoie aucun courriel.
 */

const CONTROLE_VERSION_ = '0.7.2';

/**
 * Un cas : son nom, ce qu'on croyait, ce que Google répond.
 *
 * **Trois états, et la distinction est tout l'intérêt.** Une exception n'est pas
 * un démenti : c'est une mesure qui n'a pas eu lieu. La première version les
 * confondait, et a rapporté « DÉMENTI » pour l'hypothèse la plus importante du
 * projet alors qu'elle n'avait rien mesuré — la faute même que le diagnostic du
 * produit refuse depuis la 0.4.0, retournée contre son auteur.
 */
const controleCas_ = (nom, attendu, mesure) => {
  try {
    const obtenu = mesure();
    const accord = JSON.stringify(obtenu) === JSON.stringify(attendu);
    return { nom, attendu, obtenu, etat: accord ? 'CONFIRMÉ' : 'DÉMENTI' };
  } catch (erreur) {
    return {
      nom,
      attendu,
      obtenu: String(erreur.message || erreur),
      etat: 'NON MESURÉ',
    };
  }
};

/**
 * Les liens des formulaires créés, pour que vous les jetiez d'un clic.
 *
 * **Le contrôle ne les supprime pas lui-même.** `DriveApp` exige la portée
 * `drive` entière — `drive.file` ne lui suffit pas, ce qu'un premier essai a
 * appris en se faisant refuser quatre suppressions. Réclamer l'accès au Drive
 * complet pour un outil d'essai serait hors de proportion avec le service rendu :
 * quatre liens et un clic coûtent moins cher qu'une portée de trop.
 */
const controleLiens_ = (identifiants) => identifiants
  .map((id) => `https://docs.google.com/forms/d/${id}/edit`);

/**
 * L'hypothèse qui porte le plus de code : reposer les choix efface-t-il la
 * destination portée par chacun ?
 *
 * Si Google la conservait, le refus de `limiteurVerifierLaNavigation_` serait
 * inutilement strict et empêcherait un usage légitime. S'il l'efface — ce que
 * la documentation laisse entendre —, le refus est la seule protection.
 */
const controleNavigation_ = (aJeter) => {
  const formulaire = FormApp.create('Limiteur — contrôle navigation');
  aJeter.push(formulaire.getId());

  // La question AVANT le saut de page : posée après, elle se trouverait sur la
  // seconde page et naviguerait vers elle-même. Google répond « Invalid data
  // updating form. », et la première version du contrôle a pris ce refus pour
  // une réponse à la question posée.
  if (!FormApp.PageNavigationType || !FormApp.PageNavigationType.CONTINUE) {
    throw new Error('FormApp.PageNavigationType.CONTINUE n’existe pas dans cette '
      + 'version de l’API : le contrôle ne peut pas construire une question à '
      + 'navigation valide.');
  }

  const question = formulaire.addMultipleChoiceItem().setTitle('Créneau');
  const page = formulaire.addPageBreakItem().setTitle('Seconde page');
  // Chaque choix doit porter une destination, pas seulement celui qui saute :
  // un seul choix navigant dans une question qui en compte deux donne « Invalid
  // data updating form. ». Le premier essai réel a payé cette règle deux fois,
  // après l'ordre des éléments.
  question.setChoices([
    question.createChoice('Avec saut', page),
    question.createChoice('Sans saut', FormApp.PageNavigationType.CONTINUE),
  ]);

  const avant = question.getChoices()
    .map((un) => String(un.getPageNavigationType() || 'aucune'));

  question.setChoiceValues(['Avec saut', 'Sans saut']);
  const apres = FormApp.openById(formulaire.getId()).getItems()
    .filter((un) => un.getType() === FormApp.ItemType.MULTIPLE_CHOICE)[0]
    .asMultipleChoiceItem()
    .getChoices()
    .map((un) => String(un.getPageNavigationType() || 'aucune'));

  return { avant, apres, perdue: apres.every((un) => un === 'aucune') };
};

/**
 * Le déclencheur part-il après l'écriture de la ligne ?
 *
 * Soumet une réponse par l'API, attend, puis regarde si le Journal en porte la
 * trace. **C'est une indication, pas une preuve** : un déclencheur lent
 * ressemble à un déclencheur qui n'a pas vu la ligne. Le résultat dit combien
 * de temps on a attendu, pour qu'on puisse en juger.
 */
const controleDeclencheur_ = (attenteMs) => {
  // L'étape est nommée avant chaque appel : « Invalid data updating form. » ne
  // dit pas d'où il vient, et un message sans lieu envoie chercher partout.
  const suivi = { etape: 'lecture de la feuille des réponses' };
  try {
    const feuille = limiteurFeuilleDesReponses_();

    suivi.etape = 'ouverture du formulaire';
    const formulaire = limiteurOuvrirLeFormulaire_(feuille);

    suivi.etape = 'lecture des réglages';
    const reglages = limiteurReglages_();

    suivi.etape = 'identification de la question des créneaux';
    const element = limiteurTrouverLaQuestion_(
      formulaire, reglages['Question des créneaux (titre exact)']);
    const question = limiteurQuestionTypee_(element);

    suivi.etape = 'lecture des options';
    const choix = question.getChoices();
    if (choix.length === 0) {
      return { possible: false, raison: 'le formulaire ne propose plus aucune option' };
    }

    // Un formulaire qui collecte les adresses refuse les réponses construites
    // par l'API : elles n'ont aucune adresse à produire. Le dire AVANT de
    // tenter, plutôt que de rapporter une exception qu'on ne saurait pas lire.
    suivi.etape = 'vérification de la collecte des adresses';
    const collecte = typeof formulaire.collectsEmail === 'function'
      && formulaire.collectsEmail();

    suivi.etape = 'comptage avant soumission';
    const avant = SocleFeuilles.lireTable(LIMITEUR_ONGLET_JOURNAL_).lignes.length;
    const lignesAvant = SocleFeuilles.lireTable(feuille).lignes.length;

    suivi.etape = 'construction de la réponse';
    const reponse = formulaire.createResponse();
    reponse.withItemResponse(question.createResponse(choix[0].getValue()));

    suivi.etape = 'soumission de la réponse';
    reponse.submit();

    suivi.etape = 'attente puis relecture';
    Utilities.sleep(attenteMs);
    const lignesApres = SocleFeuilles.lireTable(feuille).lignes.length;
    const apres = SocleFeuilles.lireTable(LIMITEUR_ONGLET_JOURNAL_).lignes.length;

    return {
      possible: true,
      attenteMs,
      collecte,
      ligneEcrite: lignesApres > lignesAvant,
      journalAlimente: apres > avant,
      creneau: choix[0].getValue(),
    };
  } catch (erreur) {
    return {
      possible: false,
      etape: suivi.etape,
      raison: `${erreur.message || erreur} — à l'étape « ${suivi.etape} »`,
    };
  }
};

/**
 * Point d'entrée : à lancer depuis le menu d'exécution de l'éditeur.
 *
 * Déclaré, donc visible au menu — c'est le seul de ce fichier.
 */
function controlerEnConditionsReelles() {
  const aJeter = [];
  const cas = [];

  // --- Ce que le faux classeur simule, et que le vrai doit confirmer --------

  cas.push(controleCas_(
    'Une chaîne ISO écrite en cellule ressort en objet Date',
    true,
    () => {
      const { feuille } = SocleFeuilles.onglet('Contrôle — bac');
      feuille.getRange(1, 1).setValue('2026-09-18');
      SpreadsheetApp.flush();
      return feuille.getRange(1, 1).getValue() instanceof Date;
    }));

  cas.push(controleCas_(
    'Le fuseau du script vaut celui du classeur',
    true,
    () => Session.getScriptTimeZone() === SpreadsheetApp.getActive().getSpreadsheetTimeZone()));

  cas.push(controleCas_(
    'getFormUrl() rend null sur une feuille non liée',
    true,
    () => SocleFeuilles.onglet('Contrôle — bac').feuille.getFormUrl() === null));

  // --- Les trois hypothèses qui portent du code de refus -------------------

  cas.push(controleCas_(
    'FormApp.PageNavigationType porte CONTINUE, GO_TO_PAGE, RESTART, SUBMIT',
    true,
    () => ['CONTINUE', 'GO_TO_PAGE', 'RESTART', 'SUBMIT']
      .every((nom) => FormApp.PageNavigationType[nom] !== undefined)));

  cas.push(controleCas_(
    'setChoiceValues efface la navigation par section',
    true,
    () => controleNavigation_(aJeter).perdue));

  cas.push(controleCas_(
    'Une question à choix refuse une liste d’options vide',
    true,
    () => {
      const formulaire = FormApp.create('Limiteur — contrôle liste vide');
      aJeter.push(formulaire.getId());
      const question = formulaire.addListItem().setTitle('Créneau');
      question.setChoiceValues(['A']);
      try {
        question.setChoiceValues([]);
        return false;
      } catch (erreur) {
        return true;
      }
    }));

  cas.push(controleCas_(
    'asListItem() sur un autre type lève',
    true,
    () => {
      const formulaire = FormApp.create('Limiteur — contrôle conversion');
      aJeter.push(formulaire.getId());
      formulaire.addCheckboxItem().setTitle('Cases');
      const element = formulaire.getItems()[0];
      try {
        element.asListItem();
        return false;
      } catch (erreur) {
        return true;
      }
    }));

  cas.push(controleCas_(
    'hasOtherOption n’existe pas sur une question de type liste',
    true,
    () => {
      const formulaire = FormApp.create('Limiteur — contrôle autre option');
      aJeter.push(formulaire.getId());
      const liste = formulaire.addListItem().setTitle('Liste');
      const multiple = formulaire.addMultipleChoiceItem().setTitle('Multiple');
      return typeof liste.hasOtherOption !== 'function'
        && typeof multiple.hasOtherOption === 'function';
    }));

  // --- Les énumérations, qui se vérifient et ne se citent pas de mémoire ----

  cas.push(controleCas_(
    'FormApp.ItemType porte LIST, MULTIPLE_CHOICE, CHECKBOX, GRID, CHECKBOX_GRID',
    true,
    () => ['LIST', 'MULTIPLE_CHOICE', 'CHECKBOX', 'GRID', 'CHECKBOX_GRID']
      .every((nom) => FormApp.ItemType[nom] !== undefined)));

  cas.push(controleCas_(
    'Le quota d’envoi du jour (100 grand public, 1 500 Workspace)',
    'un nombre',
    () => (typeof MailApp.getRemainingDailyQuota() === 'number' ? 'un nombre' : 'autre chose')));

  // --- Le déclencheur, qui demande une vraie soumission --------------------

  // Pas d'`absorber` ici : il compte l'échec mais en perd la cause, et « le
  // contrôle a échoué » n'apprend rien à qui le lit.
  let declencheur;
  try {
    declencheur = controleDeclencheur_(15 * 1000);
  } catch (erreur) {
    declencheur = { possible: false, raison: String(erreur.message || erreur) };
  }

  // --- Rapport --------------------------------------------------------------

  const liens = controleLiens_(aJeter);
  const dementis = cas.filter((un) => un.etat === 'DÉMENTI');
  const nonMesures = cas.filter((un) => un.etat === 'NON MESURÉ');

  const lignes = [`Contrôle en conditions réelles — limiteur ${LIMITEUR_VERSION_}, `
    + `contrôle ${CONTROLE_VERSION_}`, ''];
  cas.forEach((un) => {
    lignes.push(`[${un.etat}] ${un.nom}`);
    if (un.etat === 'DÉMENTI') {
      lignes.push(`    attendu ${JSON.stringify(un.attendu)}, `
        + `obtenu ${JSON.stringify(un.obtenu)}`);
    }
    if (un.etat === 'NON MESURÉ') {
      lignes.push(`    rien n’a été mesuré — ${un.obtenu}`);
    }
  });

  lignes.push('', 'Déclencheur de soumission :');
  if (!declencheur.possible) {
    lignes.push(`    non mesuré — ${declencheur.raison}`);
    if (declencheur.etape === 'soumission de la réponse') {
      lignes.push('    Un formulaire qui collecte les adresses refuse les réponses');
      lignes.push('    construites par l’API. Remplissez-en une à la main, puis');
      lignes.push('    regardez si l’onglet « Journal » s’est alimenté : c’est la');
      lignes.push('    même mesure, faite par le bon chemin.');
    }
  } else {
    lignes.push(`    réponse soumise sur « ${declencheur.creneau} », attente `
      + `${declencheur.attenteMs / 1000} s`);
    lignes.push(`    collecte des adresses : ${declencheur.collecte ? 'oui' : 'non'}`);
    lignes.push(`    ligne écrite dans la feuille : ${declencheur.ligneEcrite ? 'oui' : 'non'}`);
    lignes.push(`    Journal alimenté : ${declencheur.journalAlimente ? 'oui' : 'non'}`);
    lignes.push('    Indication et non preuve : un déclencheur lent ressemble à un');
    lignes.push('    déclencheur qui n’a pas vu la ligne.');
  }

  lignes.push('', `${cas.length - dementis.length - nonMesures.length} confirmé(s), `
    + `${dementis.length} démenti(s), ${nonMesures.length} non mesuré(s).`);
  if (nonMesures.length > 0) {
    lignes.push('Un point non mesuré n’est ni confirmé ni démenti : on ne sait rien.');
  }
  if (liens.length > 0) {
    lignes.push('', `${liens.length} formulaire(s) créés par ce contrôle, à jeter :`);
    liens.forEach((un) => lignes.push(`    ${un}`));
  }
  lignes.push('', 'L’onglet « Contrôle — bac » peut être supprimé.');

  const rapport = lignes.join('\n');
  console.log(rapport);
  SpreadsheetApp.getUi().alert('Contrôle en conditions réelles', rapport,
    SpreadsheetApp.getUi().ButtonSet.OK);
  return rapport;
}
