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

const CONTROLE_VERSION_ = '0.7.0';

/** Un cas : son nom, ce qu'on croyait, ce que Google répond. */
const controleCas_ = (nom, attendu, mesure) => {
  try {
    const obtenu = mesure();
    const accord = JSON.stringify(obtenu) === JSON.stringify(attendu);
    return { nom, attendu, obtenu, etat: accord ? 'CONFIRMÉ' : 'DÉMENTI' };
  } catch (erreur) {
    return { nom, attendu, obtenu: `exception : ${erreur.message}`, etat: 'DÉMENTI' };
  }
};

/** Met à la corbeille ce que le contrôle a créé, et ne se plaint pas si Drive refuse. */
const controleJeter_ = (identifiants) => {
  const restes = [];
  identifiants.forEach((id) => {
    try {
      DriveApp.getFileById(id).setTrashed(true);
    } catch (erreur) {
      restes.push(id);
    }
  });
  return restes;
};

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

  const page = formulaire.addPageBreakItem().setTitle('Seconde page');
  const question = formulaire.addMultipleChoiceItem().setTitle('Créneau');
  question.setChoices([
    question.createChoice('Avec saut', page),
    question.createChoice('Sans saut'),
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
  const feuille = limiteurFeuilleDesReponses_();
  const formulaire = limiteurOuvrirLeFormulaire_(feuille);
  const reglages = limiteurReglages_();
  const element = limiteurTrouverLaQuestion_(
    formulaire, reglages['Question des créneaux (titre exact)']);
  const question = limiteurQuestionTypee_(element);
  const choix = question.getChoices();
  if (choix.length === 0) return { possible: false, raison: 'aucune option à choisir' };

  const avant = SocleFeuilles.lireTable(LIMITEUR_ONGLET_JOURNAL_).lignes.length;
  const lignesAvant = SocleFeuilles.lireTable(feuille).lignes.length;

  const reponse = formulaire.createResponse();
  reponse.withItemResponse(question.createResponse(choix[0].getValue()));
  reponse.submit();

  Utilities.sleep(attenteMs);

  const lignesApres = SocleFeuilles.lireTable(feuille).lignes.length;
  const apres = SocleFeuilles.lireTable(LIMITEUR_ONGLET_JOURNAL_).lignes.length;

  return {
    possible: true,
    attenteMs,
    ligneEcrite: lignesApres > lignesAvant,
    journalAlimente: apres > avant,
    creneau: choix[0].getValue(),
  };
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

  const declencheur = SocleErreurs.absorber('contrôle du déclencheur',
    () => controleDeclencheur_(15 * 1000), { possible: false, raison: 'le contrôle a échoué' });

  // --- Rapport --------------------------------------------------------------

  const restes = controleJeter_(aJeter);
  const dementis = cas.filter((un) => un.etat === 'DÉMENTI');

  const lignes = [`Contrôle en conditions réelles — limiteur ${LIMITEUR_VERSION_}, `
    + `contrôle ${CONTROLE_VERSION_}`, ''];
  cas.forEach((un) => {
    lignes.push(`[${un.etat}] ${un.nom}`);
    if (un.etat === 'DÉMENTI') {
      lignes.push(`    attendu ${JSON.stringify(un.attendu)}, obtenu ${JSON.stringify(un.obtenu)}`);
    }
  });

  lignes.push('', 'Déclencheur de soumission :');
  if (!declencheur.possible) {
    lignes.push(`    non mesuré — ${declencheur.raison}`);
  } else {
    lignes.push(`    réponse soumise sur « ${declencheur.creneau} », attente `
      + `${declencheur.attenteMs / 1000} s`);
    lignes.push(`    ligne écrite dans la feuille : ${declencheur.ligneEcrite ? 'oui' : 'non'}`);
    lignes.push(`    Journal alimenté : ${declencheur.journalAlimente ? 'oui' : 'non'}`);
    lignes.push('    Indication et non preuve : un déclencheur lent ressemble à un');
    lignes.push('    déclencheur qui n’a pas vu la ligne.');
  }

  lignes.push('', `${cas.length - dementis.length} confirmé(s), ${dementis.length} démenti(s).`);
  if (restes.length > 0) {
    lignes.push('', `À jeter à la main (Drive a refusé) : ${restes.join(', ')}.`);
  }
  lignes.push('', 'L’onglet « Contrôle — bac » peut être supprimé.');

  const rapport = lignes.join('\n');
  console.log(rapport);
  SpreadsheetApp.getUi().alert('Contrôle en conditions réelles', rapport,
    SpreadsheetApp.getUi().ButtonSet.OK);
  return rapport;
}
