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
  SocleFeuilles.ecrireTable(LIMITEUR_ONGLET_LISTES_, bilan.entete, bilan.lignes);
  const { feuille } = SocleFeuilles.onglet(LIMITEUR_ONGLET_LISTES_);
  feuille.setColumnWidth(1, 180);
  feuille.setColumnWidth(2, 60);
  feuille.setColumnWidth(3, 130);
  feuille.setColumnWidth(4, 150);
  limiteurHabiller_(LIMITEUR_ONGLET_LISTES_);
  return { lignes: bilan.lignes.length };
};
