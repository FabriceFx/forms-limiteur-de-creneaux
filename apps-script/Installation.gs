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
  SocleFeuilles.listeSurColonne(LIMITEUR_ONGLET_CRENEAUX_, 'État',
    Object.keys(LIMITEUR_ETATS_).map((clef) => LIMITEUR_ETATS_[clef]));
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
  const creneaux = limiteurPoserLOngletDesCreneaux_();
  const journal = limiteurPoserLOngletDuJournal_();
  const reglages = limiteurPoserLesReglages_();
  const aide = limiteurPoserLAide_();
  const retirees = SocleFeuilles.retirerFeuilleParDefaut();
  const declencheur = limiteurPoserLeDeclencheur_();

  // La première synchronisation adopte les créneaux déjà présents dans le
  // formulaire : l'utilisateur n'a plus qu'à renseigner les capacités.
  const bilan = limiteurSynchroniser_();

  return { creneaux, journal, reglages, aide, retirees, declencheur, bilan };
};
