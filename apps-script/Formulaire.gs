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
