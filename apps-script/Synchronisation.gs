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
