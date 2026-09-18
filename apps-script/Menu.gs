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
    .addSeparator()
    .addItem('Voir un exemple', 'voirUnExemple')
    .addItem('Retirer l’exemple', 'retirerLExemple')
    .addSeparator()
    .addItem('Installer ou mettre à jour', 'installerLeLimiteur')
    .addItem('À propos', 'aProposDuLimiteur')
    .addToUi();
}

/** Cible du déclencheur installable de soumission. */
function surSoumissionDuFormulaire(e) {
  const ligne = (e && e.range) ? e.range.getRow() : null;
  const resultat = SocleExecution.sousVerrou(() => limiteurTraiterLaSoumission_(ligne));

  if (!resultat.pris) {
    // Une autre soumission tient le verrou. La sienne recomptera tout, y
    // compris cette ligne-ci : il n'y a rien à reprendre, et réessayer ne
    // ferait qu'empiler des exécutions sur un travail déjà fait.
    console.log(`Soumission ligne ${ligne} : ${resultat.message}`);
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

/** Le résumé d'une synchronisation, en quelques lignes. */
const limiteurResumer_ = (bilan) => {
  const complets = bilan.creneaux.filter((c) => c.etat === LIMITEUR_ETATS_.complet);
  const sansCapacite = bilan.creneaux.filter(
    (c) => c.etat === LIMITEUR_ETATS_.sansCapacite);
  const inconnus = Object.keys(bilan.inconnus);

  const lignes = [
    `${bilan.comptage.lignes} réponse(s) recomptée(s) sur la colonne « ${bilan.colonne} ».`,
    `${bilan.affiches.length} créneau(x) proposé(s), ${complets.length} complet(s).`,
  ];

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
