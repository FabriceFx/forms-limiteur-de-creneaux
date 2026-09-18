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
