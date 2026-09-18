// Banc d'essai — se lance hors de Google :
//
//     node banc/test.js
//
// Les faux services refusent ce que les vrais refusent : une question à choix
// sans aucune option, une conversion de type impossible, une feuille qui n'est
// liée à aucun formulaire. Un simulateur complaisant validerait un code faux.
//
// Ce qu'il ne peut pas prouver, et qui se mesure dans Apps Script : que
// `setChoiceValues` perde vraiment la navigation par section, que le quota
// d'envoi soit celui qu'on croit, et que le déclencheur de soumission parte
// bien APRÈS l'écriture de la ligne.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.join(RACINE, 'apps-script');
const FICHIERS = ['SocleDates.gs', 'SocleTexte.gs', 'SocleFeuilles.gs', 'SocleErreurs.gs',
  'SocleExecution.gs', 'SocleCourriel.gs', 'Limiteur.gs', 'Formulaire.gs',
  'Synchronisation.gs', 'Installation.gs', 'Menu.gs'];

const SECTIONS_ATTENDUES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

let passes = 0;
const echecs = [];
const vues = [];
let courante = '';
const section = (t) => { courante = t; vues.push(t.charAt(0)); console.log(`\n— ${t}`); };
const verifier = (c, m) => {
  if (c) { passes += 1; return; }
  echecs.push(`${courante} · ${m}`);
  console.log(`  ÉCHEC : ${m}`);
};
const egal = (o, a, m) => verifier(JSON.stringify(o) === JSON.stringify(a),
  `${m} — attendu ${JSON.stringify(a)}, obtenu ${JSON.stringify(o)}`);
const leve = (f, motif, m) => {
  try { f(); verifier(false, `${m} — aucune exception levée`); } catch (e) {
    verifier(motif.test(String(e.message || e)), `${m} — message inattendu : ${e.message || e}`);
  }
};

// ---------------------------------------------------------------------------

const URL_FORMULAIRE = 'https://docs.google.com/forms/d/FORMULAIRE/edit';

const monter = (options = {}) => {
  const horloge = { ms: Date.parse('2026-09-18T09:00:00+02:00') };
  class FauxDate extends Date {
    constructor(...a) { if (a.length === 0) super(horloge.ms); else super(...a); }
    static now() { return horloge.ms; }
  }

  const feuilles = {};
  class FausseFeuille {
    constructor(nom, urlFormulaire) {
      this.nom = nom;
      this.cellules = [];
      this.validations = {};
      this.urlFormulaire = urlFormulaire || null;
    }
    getName() { return this.nom; }
    // Le vrai rend `null` sur une feuille qui ne reçoit aucune réponse : c'est
    // exactement ce dont le code se sert pour la trouver sans dépendre du nom.
    getFormUrl() { return this.urlFormulaire; }
    getLastRow() { return this.cellules.length; }
    getMaxRows() { return Math.max(this.cellules.length, 1000); }
    getLastColumn() { return this.cellules.reduce((m, r) => Math.max(m, r ? r.length : 0), 0); }
    getRange(l, c, h = 1, w = 1) {
      if (![l, c, h, w].every((n) => Number.isInteger(n) && n >= 1)) {
        throw new Error('The number of rows or columns in the range must be at least 1.');
      }
      const f = this;
      return {
        setValues(v) {
          if (v.length !== h) throw new Error('The number of rows in the data does not match.');
          v.forEach((r, i) => {
            const cible = l + i - 1;
            f.cellules[cible] = f.cellules[cible] || [];
            r.forEach((x, j) => { f.cellules[cible][c + j - 1] = x; });
          });
          return this;
        },
        getValues() {
          const out = [];
          for (let i = 0; i < h; i += 1) {
            const r = f.cellules[l + i - 1] || [];
            const ligne = [];
            for (let j = 0; j < w; j += 1) {
              ligne.push(r[c + j - 1] === undefined ? '' : r[c + j - 1]);
            }
            out.push(ligne);
          }
          return out;
        },
        setValue(x) { return this.setValues([[x]]); },
        getValue() { return this.getValues()[0][0]; },
        setFontWeight() { return this; },
        setDataValidation(regle) {
          for (let i = 0; i < h; i += 1) f.validations[`${l + i}:${c}`] = regle;
          return this;
        },
        clearContent() {
          for (let i = 0; i < h; i += 1) f.cellules[l + i - 1] = [];
          return this;
        },
      };
    }
    clear() { this.cellules = []; return this; }
    setFrozenRows() { return this; }
    setColumnWidth() { return this; }
    activate() { return this; }
  }

  const NOM_REPONSES = options.nomFeuilleReponses || 'Réponses au formulaire 1';
  feuilles[NOM_REPONSES] = new FausseFeuille(NOM_REPONSES,
    options.feuilleDeliee ? null : URL_FORMULAIRE);
  if (options.deuxiemeFormulaire) {
    feuilles['Réponses 2'] = new FausseFeuille('Réponses 2',
      'https://docs.google.com/forms/d/AUTRE/edit');
  }

  const classeur = {
    getSheetByName: (n) => feuilles[n] || null,
    insertSheet(n) { feuilles[n] = new FausseFeuille(n); return feuilles[n]; },
    getSheets: () => Object.keys(feuilles).map((n) => feuilles[n]),
    deleteSheet(f) {
      if (Object.keys(feuilles).length <= 1) {
        throw new Error('You can\'t remove all the sheets in a document.');
      }
      delete feuilles[f.getName()];
    },
  };

  // --- Le formulaire -------------------------------------------------------

  const TYPES = {
    LIST: 'LIST',
    MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
    CHECKBOX: 'CHECKBOX',
    GRID: 'GRID',
    CHECKBOX_GRID: 'CHECKBOX_GRID',
    TEXT: 'TEXT',
  };

  const elements = (options.elements || [
    { type: TYPES.LIST, titre: 'Créneau souhaité', choix: ['Mardi 14 h', 'Jeudi 9 h'] },
  ]).map((brut) => ({
    type: brut.type,
    titre: brut.titre,
    choix: (brut.choix || []).map((c) => (typeof c === 'string'
      ? { valeur: c, navigation: null }
      : { valeur: c.valeur, navigation: c.navigation })),
    autre: !!brut.autre,
    revisions: 0,
  }));

  class FausseQuestion {
    constructor(element) { this.element = element; }
    getChoices() {
      return this.element.choix.map((c) => ({
        getValue: () => c.valeur,
        getPageNavigationType: () => c.navigation,
      }));
    }
    setChoiceValues(valeurs) {
      // Le vrai service refuse une question à choix sans aucune option. Un faux
      // complaisant laisserait croire qu'on peut « tout retirer », alors que le
      // code doit fermer le formulaire à la place.
      if (!Array.isArray(valeurs) || valeurs.length === 0) {
        throw new Error('The parameters ([]) don\'t match the method signature '
          + 'for FormApp.ListItem.setChoiceValues.');
      }
      valeurs.forEach((v) => {
        if (typeof v !== 'string' || v === '') {
          throw new Error('The parameters (String[]) don\'t match the method '
            + 'signature for FormApp.ListItem.setChoiceValues.');
        }
      });
      // Reposer les choix perd la navigation par section : c'est précisément le
      // dégât que le code doit refuser de causer.
      this.element.choix = valeurs.map((v) => ({ valeur: v, navigation: null }));
      this.element.revisions += 1;
      return this;
    }
  }

  const questionPour = (element) => {
    const question = new FausseQuestion(element);
    // `hasOtherOption` n'existe que sur les questions à choix multiple et à
    // cases. Le code teste la présence de la méthode : le faux doit donc ne pas
    // l'offrir ailleurs, sinon cette branche n'est jamais éprouvée.
    if (element.type === TYPES.MULTIPLE_CHOICE || element.type === TYPES.CHECKBOX) {
      question.hasOtherOption = () => element.autre;
      question.showOtherOption = (x) => { element.autre = x; return question; };
    }
    return question;
  };

  const convertir = (element, attendu, nom) => {
    if (element.type !== attendu) {
      throw new Error(`Cannot convert Item to ${nom}.`);
    }
    return questionPour(element);
  };

  const items = elements.map((element) => ({
    getType: () => element.type,
    getTitle: () => element.titre,
    asListItem: () => convertir(element, TYPES.LIST, 'ListItem'),
    asMultipleChoiceItem: () => convertir(element, TYPES.MULTIPLE_CHOICE, 'MultipleChoiceItem'),
    asCheckboxItem: () => convertir(element, TYPES.CHECKBOX, 'CheckboxItem'),
  }));

  const formulaire = {
    accepte: options.formulaireOuvert !== false,
    messageFerme: '',
    getItems: () => items,
    isAcceptingResponses() { return this.accepte; },
    setAcceptingResponses(x) { this.accepte = x; return this; },
    setCustomClosedFormMessage(t) { this.messageFerme = t; return this; },
  };

  // --- Les autres services -------------------------------------------------

  const appels = { courriels: [], declencheurs: [], alertes: [] };
  const proprietes = {};
  const proprietesDocument = {};
  const magasin = (c) => ({
    getProperty: (k) => (k in c ? c[k] : null),
    setProperty(k, v) {
      if (String(v).length > 9216) throw new Error('Argument too large: value');
      c[k] = String(v); return this;
    },
    deleteProperty(k) { delete c[k]; return this; },
    getKeys: () => Object.keys(c),
  });

  const quota = { restant: options.quota === undefined ? 100 : options.quota };

  const sandbox = {
    FormApp: {
      ItemType: TYPES,
      openByUrl: (url) => {
        if (url !== URL_FORMULAIRE) {
          throw new Error(`Unable to open the form at ${url}. `
            + 'Check the URL, or your permission to edit it.');
        }
        return formulaire;
      },
    },
    Session: {
      getScriptTimeZone: () => 'Europe/Paris',
      getActiveUser: () => ({ getEmail: () => 'moi@exemple.org' }),
      getEffectiveUser: () => ({ getEmail: () => 'moi@exemple.org' }),
    },
    MailApp: {
      getRemainingDailyQuota: () => quota.restant,
      sendEmail(message) {
        if (!message || !String(message.to || '').trim()) {
          throw new Error('Failed to send email: no recipient');
        }
        if (quota.restant <= 0) {
          throw new Error('Service invoked too many times for one day: email.');
        }
        quota.restant -= 1;
        appels.courriels.push(message);
      },
    },
    SpreadsheetApp: {
      getActive: () => classeur,
      flush: () => {},
      getUi: () => ({
        ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
        Button: { OK: 'OK', CANCEL: 'CANCEL' },
        alert(titre, message) { appels.alertes.push({ titre, message }); return 'OK'; },
        createMenu: () => {
          const menu = {
            addItem(libelle, cible) {
              appels.menu = appels.menu || [];
              appels.menu.push({ libelle, cible });
              return menu;
            },
            addSeparator: () => menu,
            addToUi: () => {},
          };
          return menu;
        },
      }),
      newDataValidation: () => {
        const regle = { valeurs: null, bloquant: null, min: null, max: null, aide: '' };
        const bati = {
          requireValueInList(v) {
            if (!Array.isArray(v) || v.length === 0) {
              throw new Error('The parameters (null) don\'t match requireValueInList.');
            }
            regle.valeurs = v; return bati;
          },
          requireNumberBetween(a, b) { regle.min = a; regle.max = b; return bati; },
          setAllowInvalid(x) { regle.bloquant = x === false; return bati; },
          setHelpText(t) { regle.aide = t; return bati; },
          build: () => regle,
        };
        return bati;
      },
    },
    PropertiesService: {
      getScriptProperties: () => magasin(proprietes),
      // Projet LIÉ à un classeur : le magasin « document » existe. Dans un
      // projet autonome il rendrait `null`, et `options.documentAbsent` le joue.
      getDocumentProperties: () => (options.documentAbsent ? null : magasin(proprietesDocument)),
      getUserProperties: () => magasin({}),
    },
    LockService: (() => {
      const etat = { pris: !!options.verrouDejaPris };
      const verrou = {
        tryLock: () => { if (etat.pris) return false; etat.pris = true; return true; },
        releaseLock: () => { etat.pris = false; },
      };
      return {
        getDocumentLock: () => (options.verrouDocumentAbsent ? null : verrou),
        getScriptLock: () => verrou,
      };
    })(),
    ScriptApp: {
      getProjectTriggers: () => appels.declencheurs.map((d) => ({
        getHandlerFunction: () => d.fonction,
      })),
      newTrigger(fonction) {
        const pose = { fonction, cible: null };
        const bati = {
          onFormSubmit: () => bati,
          create: () => { appels.declencheurs.push(pose); return pose; },
        };
        return {
          forSpreadsheet: (ss) => {
            // Le vrai refuse un classeur absent, au moment de la création.
            if (!ss) throw new Error('The parameters (null) don\'t match forSpreadsheet.');
            pose.cible = 'classeur';
            return bati;
          },
          timeBased: () => ({ after: () => bati, create: bati.create }),
        };
      },
      deleteTrigger: (d) => {
        const i = appels.declencheurs.findIndex((x) => x.fonction === d.getHandlerFunction());
        if (i >= 0) appels.declencheurs.splice(i, 1);
      },
    },
    Utilities: {
      formatDate(d, z, f) {
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
          throw new Error("The parameters (null,String,String) don't match the method signature.");
        }
        const p = {};
        new Intl.DateTimeFormat('en-CA', {
          timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }).formatToParts(d).forEach((x) => { p[x.type] = x.value; });
        return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
          .replace('HH', p.hour === '24' ? '00' : p.hour).replace('mm', p.minute)
          .replace('ss', p.second);
      },
      sleep: () => {},
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date: FauxDate,
    JSON, Math, Number, String, Object, Array, Boolean, RegExp, Error, Intl, Map, Set,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  FICHIERS.forEach((n) => vm.runInContext(
    fs.readFileSync(path.join(DOSSIER, n), 'utf8'), sandbox, { filename: n }));

  return {
    sandbox, classeur, feuilles, appels, formulaire, elements, horloge, quota,
    nomReponses: NOM_REPONSES,
    lire: (e) => vm.runInContext(e, sandbox),
  };
};

/** Les lignes d'un onglet, en objets indexés par l'en-tête. */
const lignesDe = (contexte, onglet) => {
  const f = contexte.feuilles[onglet];
  if (!f) return [];
  const h = f.getLastRow();
  const w = f.getLastColumn();
  if (h < 2) return [];
  const v = f.getRange(1, 1, h, w).getValues();
  const entete = v[0].map(String);
  return v.slice(1).map((c) => {
    const o = {};
    entete.forEach((n, i) => { o[n] = c[i]; });
    return o;
  });
};

/** Pose l'en-tête puis les réponses, comme le fait un formulaire lié. */
const poserReponses_ = (contexte, entete, lignes) => {
  const f = contexte.feuilles[contexte.nomReponses];
  f.getRange(1, 1, 1, entete.length).setValues([entete]);
  if (lignes.length > 0) {
    f.getRange(2, 1, lignes.length, entete.length).setValues(lignes);
  }
};

/** Écrit une capacité dans l'onglet des créneaux, par son libellé. */
const capacite_ = (contexte, libelle, places, marge) => {
  contexte.lire(`(() => {
    const table = SocleFeuilles.lireTable(LIMITEUR_ONGLET_CRENEAUX_);
    const ligne = table.lignes.find((l) => l['Créneau'] === ${JSON.stringify(libelle)});
    if (!ligne) throw new Error('Créneau absent du référentiel : ${libelle}');
    table.feuille.getRange(ligne.numero, table.index['Places'] + 1).setValue(${places});
    ${marge === undefined ? '' : `table.feuille
      .getRange(ligne.numero, table.index['Marge'] + 1).setValue(${marge});`}
  })()`);
};

/** Un classeur installé, avec des réponses et des capacités. */
const prepare_ = (options = {}) => {
  const contexte = monter(options);
  poserReponses_(contexte,
    options.entete || ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'],
    options.reponses || []);
  contexte.lire('limiteurInstaller_()');
  (options.capacites || []).forEach(([libelle, places, marge]) => {
    capacite_(contexte, libelle, places, marge);
  });
  if (options.capacites) contexte.lire('limiteurSynchroniser_()');
  return contexte;
};

// ---------------------------------------------------------------------------

section('A. Intégrité du projet');
{
  const sources = fs.readdirSync(DOSSIER).filter((n) => n.endsWith('.gs'));
  egal(sources.slice().sort(), FICHIERS.slice().sort(),
    'le banc charge exactement les fichiers du projet — un fichier ajouté et jamais '
    + 'chargé ne serait testé par rien');

  // Deux constantes globales de même nom entre deux fichiers empêchent le
  // projet ENTIER de se charger : toutes ses fonctions deviennent introuvables
  // d'un coup, y compris celles qui n'ont rien à voir.
  const vus = {};
  const collisions = [];
  sources.forEach((nom) => {
    const texte = fs.readFileSync(path.join(DOSSIER, nom), 'utf8');
    [...texte.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)]
      .forEach((m) => {
        if (vus[m[1]] && vus[m[1]] !== nom) collisions.push(`${m[1]} (${vus[m[1]]} et ${nom})`);
        vus[m[1]] = nom;
      });
  });
  egal(collisions, [], 'aucun nom global déclaré dans deux fichiers');

  const declaree = fs.readFileSync(path.join(RACINE, 'VERSION'), 'utf8').trim();
  const dansLeCode = /const LIMITEUR_VERSION_ = '([^']+)'/.exec(
    fs.readFileSync(path.join(DOSSIER, 'Limiteur.gs'), 'utf8'))[1];
  egal(dansLeCode, declaree, 'la version du code vaut le fichier VERSION — une version '
    + 'affichée et fausse est pire que pas de version, puisqu’un déploiement sert une '
    + 'copie figée du code');

  // La séparation public / privé se lit dans la FORME : seules les `function`
  // déclarées apparaissent au menu d'exécution de l'éditeur.
  const propres = FICHIERS.filter((n) => !n.startsWith('Socle'));
  propres.filter((n) => n !== 'Menu.gs').forEach((nom) => {
    const texte = fs.readFileSync(path.join(DOSSIER, nom), 'utf8');
    const declarees = [...texte.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    egal(declarees, [], `${nom} ne déclare aucune \`function\` : tout l’interne est en `
      + 'const fléchée, invisible du menu d’exécution');
  });

  const menu = fs.readFileSync(path.join(DOSSIER, 'Menu.gs'), 'utf8');
  const appelees = [...menu.matchAll(/addItem\('[^']*', '([^']+)'\)/g)].map((m) => m[1]);
  const declarees = [...menu.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  egal(appelees.filter((n) => !declarees.includes(n)), [],
    'chaque entrée de menu vise une fonction déclarée dans le même fichier');
  ['onOpen', 'surSoumissionDuFormulaire'].forEach((nom) => {
    verifier(declarees.includes(nom), `${nom} est une function déclarée — un déclencheur `
      + 'la résout par son nom global, et une const fléchée y est introuvable');
  });

  // Une date d'horodatage tronquée à la main se compare sur le nom du jour :
  // « Thu May 14 2026 » trie avant « Tue », silencieusement.
  const tout = propres.map((n) => fs.readFileSync(path.join(DOSSIER, n), 'utf8')).join('\n');
  egal((tout.match(/String\([^)]*\)\.slice\(0,\s*10\)/g) || []), [],
    'aucun découpage de chaîne sur un horodatage : la normalisation passe par SocleDates');

  // Tout refus doit dire quoi faire ensuite. `SocleErreurs.erreur` l'impose au
  // moment de l'appel ; ce contrôle-ci le voit à la lecture, donc avant.
  const erreurs = [...tout.matchAll(/SocleErreurs\.erreur\(\{([\s\S]*?)\}\)/g)];
  verifier(erreurs.length >= 8, `le projet construit ${erreurs.length} refus explicites`);
  egal(erreurs.filter((m) => !/quoiFaire:/.test(m[1])).length, 0,
    'chaque refus porte un « quoiFaire » — un message qui ne dit pas quoi faire '
    + 'laisse son lecteur improviser');

  // La portée `forms` est large : Google n'en propose pas de version restreinte
  // au seul formulaire lié. La compensation annoncée dans le README doit donc
  // être vérifiable, et c'est ici qu'elle se vérifie — le projet n'ouvre qu'un
  // formulaire, celui que désigne la feuille des réponses.
  egal((tout.match(/FormApp\.(?:openById|create)\b/g) || []), [],
    'aucun formulaire ouvert par identifiant ni créé : la seule ouverture passe par '
    + 'openByUrl sur l’URL rendue par getFormUrl()');
  egal((tout.match(/FormApp\.open\w+/g) || []), ['FormApp.openByUrl'],
    'et il n’y en a qu’une seule dans tout le projet');

  // `globalThis[nom]` ne trouve jamais une `const` de portée globale.
  egal((tout.match(/globalThis\[/g) || []), [],
    'aucune résolution par globalThis[…] : une const globale n’est pas une propriété '
    + 'de l’objet global');
}

section('B. Le référentiel fait foi, le formulaire n’en est que le reflet');
{
  const c = prepare_();
  const creneaux = lignesDe(c, 'Créneaux');
  egal(creneaux.map((l) => l['Créneau']), ['Mardi 14 h', 'Jeudi 9 h'],
    'l’installation reprend les options déjà présentes dans le formulaire');
  egal(creneaux.map((l) => l['État']), ['Sans capacité', 'Sans capacité'],
    'sans capacité renseignée, aucun créneau n’est réputé ouvert : le code ne '
    + 'devine pas un nombre de places que personne n’a décidé');
  egal(c.elements[0].choix.map((x) => x.valeur), ['Mardi 14 h', 'Jeudi 9 h'],
    'et il ne retire rien tant que rien n’est décidé');

  capacite_(c, 'Mardi 14 h', 2);
  capacite_(c, 'Jeudi 9 h', 3);
  c.lire('limiteurSynchroniser_()');
  egal(lignesDe(c, 'Créneaux').map((l) => l['État']), ['Ouvert', 'Ouvert'],
    'une capacité renseignée ouvre le créneau');

  // Une option ajoutée à la main dans le formulaire doit survivre à la
  // synchronisation suivante : on repose exactement ce que dit le référentiel,
  // donc il faut l'y avoir adoptée d'abord.
  c.elements[0].choix.push({ valeur: 'Vendredi 16 h', navigation: null });
  const bilan = c.lire('limiteurSynchroniser_()');
  egal(bilan.adoptes, ['Vendredi 16 h'],
    'une option ajoutée à la main est adoptée au référentiel, jamais effacée');
  verifier(c.elements[0].choix.some((x) => x.valeur === 'Vendredi 16 h'),
    'et elle est toujours proposée dans le formulaire après la synchronisation');

  const avant = c.elements[0].revisions;
  c.lire('limiteurSynchroniser_()');
  egal(c.elements[0].revisions, avant,
    'une synchronisation qui ne change rien n’écrit rien — chaque écriture est une '
    + 'révision du formulaire, et une par soumission en produirait des centaines');
}

section('C. Le comptage, et le rang qui le rend contestable');
{
  const c = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Jeudi 9 h'],
      ['2026-09-18 09:12', 'c@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 5], ['Jeudi 9 h', 5]],
  });
  const creneaux = lignesDe(c, 'Créneaux');
  egal(creneaux.map((l) => [l['Créneau'], l.Pris, l.Restant]),
    [['Mardi 14 h', 2, 3], ['Jeudi 9 h', 1, 4]],
    'les réponses sont comptées par créneau, et le restant se lit sans calcul');

  const bilan = c.lire('limiteurSynchroniser_()');
  const verdicts = c.lire('limiteurJugerLaLigne_(4, limiteurSynchroniser_())');
  egal(verdicts.map((v) => [v.creneau.libelle, v.rang]), [['Mardi 14 h', 2]],
    'la ligne 4 est la 2ᵉ personne du mardi : le rang vient de l’ordre des lignes, '
    + 'donc recompter plus tard redonne le même résultat');
  egal(bilan.comptage.lignes, 3, 'et le bilan dit sur combien de réponses il a compté');
}

section('D. Le verdict, rendu à la réception');
{
  const c = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 2]],
  });
  egal(c.lire('limiteurJugerLaLigne_(2, limiteurSynchroniser_())').map((v) => v.verdict),
    ['Acceptée'], 'la première inscription est acceptée');
  egal(c.lire('limiteurJugerLaLigne_(3, limiteurSynchroniser_())').map((v) => v.verdict),
    ['Acceptée'], 'la deuxième aussi : elle prend la dernière place');

  // La troisième arrive alors que le formulaire ne propose plus le mardi : c'est
  // la page restée ouverte dans un navigateur. Google l'accepte, personne ne
  // peut l'en empêcher — mais le verdict, lui, ne se laisse pas tromper.
  c.feuilles[c.nomReponses].getRange(4, 1, 1, 3)
    .setValues([['2026-09-18 09:13', 'c@exemple.org', 'Mardi 14 h']]);
  const r = c.lire('limiteurTraiterLaSoumission_(4)');
  egal(r.verdicts.map((v) => [v.rang, v.verdict]), [[3, 'Surréservation']],
    'la troisième est comptée, nommée « Surréservation », et non perdue');

  const journal = lignesDe(c, 'Journal');
  egal(journal[journal.length - 1].Verdict, 'Surréservation',
    'le journal en garde la trace, avec le rang qui l’explique');
  egal(journal[journal.length - 1].Rang, 3, 'et le rang obtenu');
}

section('E. La marge ferme avant la dernière place, sans la perdre');
{
  const c = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:12', 'c@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:13', 'd@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 5, 1], ['Jeudi 9 h', 5]],
  });
  const mardi = lignesDe(c, 'Créneaux')[0];
  egal([mardi.Pris, mardi.Restant, mardi['État']], [4, 1, 'Complet'],
    'quatre pris sur cinq avec une marge de 1 : le créneau est retiré alors qu’il '
    + 'reste une place — c’est le but');
  verifier(!c.elements[0].choix.some((x) => x.valeur === 'Mardi 14 h'),
    'et il ne figure plus dans le formulaire');

  // Refuser la place que la marge réserve la perdrait pour tout le monde.
  c.feuilles[c.nomReponses].getRange(6, 1, 1, 3)
    .setValues([['2026-09-18 09:14', 'e@exemple.org', 'Mardi 14 h']]);
  egal(c.lire('limiteurJugerLaLigne_(6, limiteurSynchroniser_())').map((v) => v.verdict),
    ['Acceptée'],
    'une cinquième inscription reste acceptée : la marge retire l’option, elle ne '
    + 'supprime pas la place');
}

section('F. Tout complet ferme le formulaire ; une place libérée le rouvre');
{
  const c = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Jeudi 9 h'],
    ],
    capacites: [['Mardi 14 h', 1], ['Jeudi 9 h', 1]],
  });
  // Google refuse une question à choix sans aucune option : quand tout est
  // complet, il n'y a pas d'autre issue que de fermer le formulaire.
  egal(c.formulaire.accepte, false,
    'tous les créneaux complets : le formulaire est fermé, faute de pouvoir vider '
    + 'la question');
  verifier(/complets/.test(c.formulaire.messageFerme),
    'avec un message qui dit pourquoi, plutôt que la page blanche de Google');

  // Une personne se décommande : on supprime sa ligne, et la place revient.
  c.feuilles[c.nomReponses].getRange(2, 1, 1, 3).clearContent();
  c.feuilles[c.nomReponses].cellules.splice(1, 1);
  const bilan = c.lire('limiteurSynchroniser_()');
  egal(c.formulaire.accepte, true,
    'la ligne supprimée rend la place, et le formulaire se rouvre tout seul');
  egal(bilan.ouverture.raison, 'une place s’est libérée',
    'et l’outil dit pourquoi il a rouvert');
  egal(c.elements[0].choix.map((x) => x.valeur), ['Mardi 14 h'],
    'l’option revient à sa place — le référentiel a gardé la liste et son ordre, '
    + 'que le formulaire seul aurait perdus');
}

section('G. Aucune décision humaine n’est défaite');
{
  const c = prepare_({ capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 2]] });

  // « Fermé à la main » dans la colonne État : le code ne rouvre jamais.
  c.lire(`(() => {
    const table = SocleFeuilles.lireTable(LIMITEUR_ONGLET_CRENEAUX_);
    const ligne = table.lignes.find((l) => l['Créneau'] === 'Mardi 14 h');
    table.feuille.getRange(ligne.numero, table.index['État'] + 1)
      .setValue(LIMITEUR_ETATS_.ferme);
  })()`);
  c.lire('limiteurSynchroniser_()');
  egal(lignesDe(c, 'Créneaux')[0]['État'], 'Fermé à la main',
    'un créneau fermé à la main le reste, même s’il a des places libres');
  egal(c.elements[0].choix.map((x) => x.valeur), ['Jeudi 9 h'],
    'et il disparaît du formulaire');

  // Un formulaire fermé par une personne ne se rouvre pas : elle avait une
  // raison, et le code ne la connaît pas.
  const d = prepare_({ capacites: [['Mardi 14 h', 2]], formulaireOuvert: false });
  egal(d.formulaire.accepte, false,
    'un formulaire fermé à la main reste fermé, bien qu’il reste des places');
  egal(d.lire('limiteurSynchroniser_()').ouverture.raison,
    'formulaire fermé à la main, laissé tel quel',
    'et l’outil le dit, au lieu de laisser croire à une panne');

  // La capacité vide n'est pas une capacité de zéro.
  const e = prepare_({ capacites: [['Mardi 14 h', 2]] });
  egal(lignesDe(e, 'Créneaux')[1]['État'], 'Sans capacité',
    'un créneau sans capacité est nommé comme tel');
  verifier(e.elements[0].choix.some((x) => x.valeur === 'Jeudi 9 h'),
    'et reste proposé : retirer l’option punirait l’oubli d’une capacité');
}

section('H. Les refus, et ce qu’ils disent de faire');
{
  leve(() => monter({
    elements: [{ type: 'GRID', titre: 'Créneaux' }],
  }).lire('limiteurSynchroniser_()'), /aucune question à choix/,
    'une grille seule : le formulaire est déclaré sans question pilotable');

  const grille = monter({
    elements: [
      { type: 'GRID', titre: 'Vos créneaux' },
      { type: 'LIST', titre: 'Autre chose', choix: ['a'] },
    ],
  });
  grille.lire('limiteurInstaller_()');
  grille.lire("SocleFeuilles.ecrireReglage('Réglages', "
    + "'Question des créneaux (titre exact)', 'Vos créneaux')");
  leve(() => grille.lire('limiteurSynchroniser_()'),
    /grille.*ne sait pas piloter les grilles/,
    'une grille nommée explicitement est refusée en disant de la remplacer par '
    + 'une liste, plutôt que d’échouer sur une conversion de type');

  // `setChoiceValues` écrase la destination portée par chaque choix : reposer
  // la liste casserait la navigation, et personne ne s'en apercevrait avant
  // les premiers répondants égarés.
  const navigation = monter({
    elements: [{
      type: 'MULTIPLE_CHOICE',
      titre: 'Créneau souhaité',
      choix: [{ valeur: 'Mardi 14 h', navigation: 'GO_TO_PAGE' },
        { valeur: 'Jeudi 9 h', navigation: null }],
    }],
  });
  leve(() => navigation.lire('limiteurInstaller_()'), /saut de section/,
    'une question dont un choix commande un saut de section est refusée, avant '
    + 'd’avoir rien cassé');
  egal(navigation.elements[0].choix[0].navigation, 'GO_TO_PAGE',
    'et la navigation est intacte : le refus a bien eu lieu avant l’écriture');

  // Google sépare les choix multiples par « , » : un libellé qui en contient
  // une se compterait de travers, en silence.
  const virgule = monter({
    elements: [{
      type: 'CHECKBOX',
      titre: 'Créneaux souhaités',
      choix: ['Mardi 14 h, salle A', 'Jeudi 9 h'],
    }],
  });
  leve(() => virgule.lire('limiteurInstaller_()'), /contiennent une virgule/,
    'un libellé à virgule dans une question à cases est refusé : mieux vaut un '
    + 'refus visible qu’un comptage faux');

  const deux = monter({
    elements: [
      { type: 'LIST', titre: 'Créneau souhaité', choix: ['a'] },
      { type: 'LIST', titre: 'Votre service', choix: ['b'] },
    ],
  });
  leve(() => deux.lire('limiteurSynchroniser_()'), /2 questions à choix/,
    'deux questions à choix et aucun réglage : on refuse de deviner laquelle '
    + 'porte les créneaux, et on liste les titres');

  leve(() => monter({ feuilleDeliee: true }).lire('limiteurSynchroniser_()'),
    /Aucune feuille de ce classeur/,
    'un classeur qui ne reçoit aucune réponse est refusé en disant comment le lier');

  leve(() => monter({ deuxiemeFormulaire: true }).lire('limiteurSynchroniser_()'),
    /2 formulaires/,
    'deux formulaires dans un même classeur : on refuse plutôt que d’en piloter '
    + 'un au hasard');

  // Le verrou n'empêche pas la surréservation — la réponse est déjà écrite —
  // mais il empêche deux comptages simultanés d'écrire des états contradictoires.
  const pris = monter({ verrouDejaPris: true });
  const resultat = pris.lire('SocleExecution.sousVerrou(() => 1)');
  egal(resultat.pris, false, 'une exécution déjà en cours ne se double pas');
  verifier(/Attendez/.test(resultat.message), 'et le message dit quoi faire');
}

section('I. Rien ne disparaît en silence');
{
  const c = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Lundi 8 h'],
      ['2026-09-18 09:12', 'c@exemple.org', ''],
    ],
    capacites: [['Mardi 14 h', 5], ['Jeudi 9 h', 5]],
  });
  const bilan = c.lire('limiteurSynchroniser_()');
  egal(bilan.inconnus, { 'Lundi 8 h': 1 },
    'une réponse qui ne correspond à aucun créneau connu est signalée : elle vient '
    + 'presque toujours d’un libellé modifié d’un seul côté, donc d’un comptage '
    + 'incomplet qu’il faut voir');
  verifier(/Lundi 8 h/.test(c.lire(`limiteurResumer_(limiteurSynchroniser_())`)),
    'et le résumé affiché à l’utilisateur la nomme');

  // Une cellule vide n'est pas un libellé inconnu : c'est une question sans
  // réponse, et les confondre enverrait chercher une faute qui n'existe pas.
  verifier(!('' in bilan.inconnus), 'une réponse sans créneau n’est pas un libellé inconnu');

  const r = c.lire('limiteurTraiterLaSoumission_(4)');
  egal(r.verdicts.length, 0, 'une réponse sans créneau ne produit aucun verdict');
  egal(lignesDe(c, 'Journal').pop().Verdict, 'Sans créneau',
    'mais le journal en garde la trace, plutôt que de la passer sous silence');

  // Une colonne calculée déplacée à la main écraserait sa voisine.
  const d = prepare_({ capacites: [['Mardi 14 h', 1]] });
  d.feuilles['Créneaux'].getRange(1, 7).setValue('Note ajoutée à la main');
  d.feuilles['Créneaux'].getRange(1, 9).setValue('Dernier comptage');
  leve(() => d.lire('limiteurSynchroniser_()'), /ne se suivent plus/,
    'les colonnes calculées séparées à la main : on refuse d’écrire plutôt que '
    + 'd’écraser une colonne voisine');
}

section('J. Ce qui part par courriel, et ce qui n’en part pas');
{
  const c = prepare_({
    reponses: [['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 1], ['Jeudi 9 h', 5]],
  });
  egal(c.appels.courriels.length, 0,
    'aucune confirmation par défaut : un outil qui écrit sans qu’on le lui demande '
    + 'se fait filtrer, et le filtre emportera aussi les alertes');

  c.lire("SocleFeuilles.ecrireReglage('Réglages', 'Envoyer une confirmation', 'Oui')");
  c.feuilles[c.nomReponses].getRange(3, 1, 1, 3)
    .setValues([['2026-09-18 09:20', 'b@exemple.org', 'Jeudi 9 h']]);
  c.lire('limiteurTraiterLaSoumission_(3)');
  egal(c.appels.courriels.length, 1, 'réglage à « Oui » : la confirmation part');
  egal(c.appels.courriels[0].to, 'b@exemple.org', 'à l’adresse portée par la réponse');
  verifier(/1ʳᵉ personne inscrite/.test(c.appels.courriels[0].body),
    'et elle dit le rang obtenu : un chiffre s’accompagne de ce qui le produit');
  verifier(!/\[Info\]/.test(c.appels.courriels[0].subject),
    'sans marqueur technique : ce qu’un répondant lit n’est pas ce qu’un '
    + 'administrateur lit');

  // Le dépassement se dit toujours : laisser quelqu'un croire qu'il a une place
  // qu'il n'a pas est le seul défaut vraiment coûteux de ce montage.
  const d = prepare_({
    reponses: [['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 1], ['Jeudi 9 h', 5]],
  });
  d.lire("SocleFeuilles.ecrireReglage('Réglages', 'Destinataire des alertes', 'chef@exemple.org')");
  d.feuilles[d.nomReponses].getRange(3, 1, 1, 3)
    .setValues([['2026-09-18 09:21', 'z@exemple.org', 'Mardi 14 h']]);
  d.lire('limiteurTraiterLaSoumission_(3)');
  const pourLeRepondant = d.appels.courriels.find((m) => m.to === 'z@exemple.org');
  verifier(!!pourLeRepondant,
    'le dépassement est annoncé au répondant même si la confirmation est désactivée');
  verifier(/liste d’attente/.test(pourLeRepondant.body),
    'en disant ce qu’il en est, sans jargon');
  const pourLeChef = d.appels.courriels.find((m) => m.to === 'chef@exemple.org');
  verifier(!!pourLeChef, 'et l’exploitant est prévenu');
  verifier(/\[Erreur\]/.test(pourLeChef.subject),
    'celui-là porte le marqueur du socle, qui agrège par cause : une campagne qui '
    + 'déborde produit une alerte, pas trois cents');

  // Lire le quota avant plutôt qu'échouer à mi-parcours : 100 envois par jour
  // sur un compte grand public contre 1 500 sur Workspace.
  const e = prepare_({
    quota: 0,
    reponses: [['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 1], ['Jeudi 9 h', 5]],
  });
  e.feuilles[e.nomReponses].getRange(3, 1, 1, 3)
    .setValues([['2026-09-18 09:22', 'y@exemple.org', 'Mardi 14 h']]);
  e.lire('limiteurTraiterLaSoumission_(3)');
  egal(e.appels.courriels.length, 0, 'quota épuisé : rien ne part');
  verifier(/quota/.test(String(lignesDe(e, 'Journal').pop().Courriel)),
    'et le journal dit pourquoi, au lieu de laisser croire que le message est parti');

  const f = prepare_({
    entete: ['Horodatage', 'Créneau souhaité'],
    reponses: [['2026-09-18 09:10', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 1], ['Jeudi 9 h', 5]],
  });
  f.feuilles[f.nomReponses].getRange(3, 1, 1, 2)
    .setValues([['2026-09-18 09:23', 'Mardi 14 h']]);
  f.lire('limiteurTraiterLaSoumission_(3)');
  egal(f.appels.courriels.length, 0, 'un formulaire qui ne collecte pas les adresses '
    + 'n’envoie rien — et ne casse pas pour autant');
  verifier(/sans adresse/.test(String(lignesDe(f, 'Journal').pop().Courriel)),
    'le journal nomme la cause, pour qu’on sache qu’il faut collecter les adresses');
}

// ---------------------------------------------------------------------------

// Un `return` au niveau du module sortirait du fichier sans rien dire, et la
// section suivante ne serait jamais jouée — banc vert à l'appui. La liste
// attendue est donc vérifiée : ajouter une section impose de l'y ajouter.
const manquantes = SECTIONS_ATTENDUES.filter((lettre) => !vues.includes(lettre));
if (manquantes.length > 0) {
  echecs.push(`Sections jamais jouées : ${manquantes.join(', ')}`);
  console.log(`\nÉCHEC : sections jamais jouées — ${manquantes.join(', ')}`);
}

console.log(`\n${passes} assertion(s) passée(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  console.log('\nÉchecs :');
  echecs.forEach((e) => console.log(`  · ${e}`));
  process.exit(1);
}
