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
  'Synchronisation.gs', 'Demonstration.gs', 'Installation.gs', 'Verification.gs',
  'Listes.gs', 'Apparence.gs', 'Menu.gs'];

// 'K' en dernier : sa vérification du total se compte elle-même, et ne peut
// donc pas être suivie d'autres assertions.
const SECTIONS_ATTENDUES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'L', 'M', 'N', 'O', 'P', 'Q', 'K'];

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

  // Un onglet protégé par un administrateur : le vrai service laisse lire et
  // refuse d'écrire, avec ce message. Modifiable après coup, pour qu'une
  // installation puisse réussir avant que la panne ne survienne.
  const panne = { onglet: options.ongletEnPanne || null };

  const feuilles = {};
  class FausseFeuille {
    constructor(nom, urlFormulaire) {
      this.nom = nom;
      this.cellules = [];
      this.validations = {};
      this.notes = {};
      this.regles = [];
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
        getColumn: () => c,
        getRow: () => l,
        getNumColumns: () => w,
        getNumRows: () => h,
        setNote(texte) {
          for (let i = 0; i < h; i += 1) f.notes[`${l + i}:${c}`] = texte;
          return this;
        },
        getNote: () => f.notes[`${l}:${c}`] || '',
        setValues(v) {
          if (panne.onglet === f.nom) {
            throw new Error('You are trying to edit a protected cell or object. '
              + 'Please contact the spreadsheet owner to remove protection if you '
              + 'need to edit.');
          }
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
        // Le vrai rend `null` là où aucune règle n'a été posée : un faux qui
        // rendrait toujours un objet validerait un code qui ne s'en méfie pas.
        getDataValidation: () => f.validations[`${l}:${c}`] || null,
        clearContent() {
          for (let i = 0; i < h; i += 1) f.cellules[l + i - 1] = [];
          return this;
        },
      };
    }
    clear() { this.cellules = []; this.notes = {}; this.regles = []; return this; }
    getConditionalFormatRules() { return this.regles.slice(); }
    setConditionalFormatRules(regles) { this.regles = regles.slice(); return this; }
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
      newConditionalFormatRule: () => {
        const regle = { valeur: null, fond: null, texte: null, plages: [] };
        const bati = {
          whenTextEqualTo(v) { regle.valeur = v; return bati; },
          setBackground(c) { regle.fond = c; return bati; },
          setFontColor(c) { regle.texte = c; return bati; },
          setRanges(p) { regle.plages = p; return bati; },
          build() {
            // Le vrai service refuse une règle sans plage, avec ce message.
            if (regle.plages.length === 0) {
              throw new Error('The conditional format rule must contain at least one range.');
            }
            return {
              getRanges: () => regle.plages,
              valeur: regle.valeur,
              fond: regle.fond,
              texte: regle.texte,
            };
          },
        };
        return bati;
      },
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
          build: () => ({
            ...regle,
            // Le vrai rend [valeurs, afficherLaListe] pour une liste de valeurs.
            getCriteriaValues: () => [regle.valeurs, true],
          }),
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
    sandbox, classeur, feuilles, appels, formulaire, elements, horloge, quota, panne,
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

  // Apps Script charge les fichiers dans l'ordre de l'éditeur, **alphabétique
  // par défaut**. Une constante globale évaluée au chargement et qui en
  // référence une autre, déclarée dans un fichier venant après, fait échouer le
  // projet ENTIER : toutes ses fonctions deviennent introuvables d'un coup, y
  // compris celles qui n'ont rien à voir. Le banc, lui, charge dans un ordre
  // choisi — il ne verrait donc jamais le défaut.
  {
    const bac = {
      JSON, Math, Number, String, Object, Array, Boolean, RegExp, Error, Intl,
      Map, Set, Date, console: { log: () => {}, warn: () => {}, error: () => {} },
    };
    bac.globalThis = bac;
    vm.createContext(bac);
    let echec = '';
    try {
      sources.slice().sort().forEach((nom) => vm.runInContext(
        fs.readFileSync(path.join(DOSSIER, nom), 'utf8'), bac, { filename: nom }));
    } catch (erreur) {
      echec = String(erreur.message || erreur);
    }
    egal(echec, '', 'le projet se charge dans l’ordre alphabétique — une table '
      + 'constante qui nomme une constante déclarée plus loin doit devenir une '
      + 'fonction, évaluée à l’appel');
  }


  // `controleCas_` est la seule partie de `outils/Controle.gs` qui se teste hors
  // de Google — et c'est précisément celle qui s'est trompée au premier essai
  // réel, en rapportant « DÉMENTI » pour une mesure qui n'avait pas eu lieu.
  {
    const bac = {
      JSON, Math, Number, String, Object, Array, Boolean, RegExp, Error,
      console: { log: () => {}, warn: () => {}, error: () => {} },
    };
    bac.globalThis = bac;
    vm.createContext(bac);
    vm.runInContext(
      fs.readFileSync(path.join(RACINE, 'outils', 'Controle.gs'), 'utf8'), bac,
      { filename: 'Controle.gs' });

    // Une `const` de portée globale n'est pas une propriété de l'objet global :
    // on la relit par son nom, jamais par `globalThis[…]`.
    const cas = vm.runInContext('controleCas_', bac);

    egal(cas('x', true, () => true).etat, 'CONFIRMÉ',
      'une mesure conforme à l’attente est confirmée');
    egal(cas('x', true, () => false).etat, 'DÉMENTI',
      'une mesure qui contredit l’attente la dément');
    egal(cas('x', true, () => { throw new Error('boum'); }).etat, 'NON MESURÉ',
      'une mesure qui lève n’est PAS un démenti : elle n’a pas eu lieu, et le '
      + 'dire est le seul rapport honnête — la confondre avec un démenti a fait '
      + 'croire une fois que Google avait répondu quand il avait refusé');
  }

  // Une soumission doit ATTENDRE le verrou, jamais rendre la main aussitôt :
  // sans cela elle ne reçoit aucun verdict, et personne ne sait qu'une personne
  // dépassait la capacité. Le faux verrou du banc ne peut pas éprouver cette
  // règle — nul autre ne tourne pour le libérer, donc toute attente échoue de
  // la même façon. Elle se tient donc sur le source, faute de mieux.
  {
    const sync = fs.readFileSync(path.join(DOSSIER, 'Synchronisation.gs'), 'utf8');
    verifier(/tryLock\(LIMITEUR_ATTENTE_VERROU_MS_\)/.test(sync),
      'le déclencheur attend le verrou pendant un délai nommé, et non tryLock(0)');
    const attente = /const LIMITEUR_ATTENTE_VERROU_MS_ = (\d+) \* 1000;/
      .exec(fs.readFileSync(path.join(DOSSIER, 'Limiteur.gs'), 'utf8'));
    verifier(attente && Number(attente[1]) >= 10 && Number(attente[1]) <= 300,
      `le délai d’attente vaut ${attente ? attente[1] : '?'} s — entre dix secondes `
      + 'et cinq minutes, bien sous le plafond de six minutes par exécution');
  }

  // `outils/Controle.gs` ne tourne que dans Google : aucun test ne le charge,
  // et sa syntaxe seule est vérifiée par le préparateur. Mais il appelle des
  // fonctions internes du produit, et en renommer une le casserait sans que
  // rien ne le dise — jusqu'à l'essai réel, c'est-à-dire au pire moment.
  {
    const controle = fs.readFileSync(path.join(RACINE, 'outils', 'Controle.gs'), 'utf8');
    const siennes = new Set([...controle.matchAll(
      /^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));

    const declarees = new Set();
    sources.forEach((nom) => {
      [...fs.readFileSync(path.join(DOSSIER, nom), 'utf8')
        .matchAll(/^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)]
        .forEach((m) => declarees.add(m[1]));
    });

    const citees = [...new Set([...controle.matchAll(
      /\b(limiteur[A-Z][A-Za-z0-9_$]*|LIMITEUR_[A-Z0-9_]+|Socle[A-Z][A-Za-z0-9_$]*)/g)]
      .map((m) => m[1]))];
    const introuvables = citees.filter((nom) => !declarees.has(nom) && !siennes.has(nom));
    egal(introuvables, [],
      'chaque nom du produit que cite outils/Controle.gs est déclaré dans '
      + 'apps-script/ — sinon le contrôle en conditions réelles échouerait sur un '
      + 'nom mort, le jour même où l’on compte sur lui');
  }

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

  // `distribution/limiteur-de-creneaux.gs` est le fichier que les gens collent
  // dans leur éditeur. Il est engendré, donc il dérive dès qu'on touche aux
  // sources sans relancer l'assembleur — et **une distribution périmée est pire
  // qu'une distribution absente** : elle a l'air d'être à jour, et livre du code
  // d'avant-hier à quelqu'un qui n'a aucun moyen de s'en apercevoir.
  {
    const chemin = path.join(RACINE, 'distribution', 'limiteur-de-creneaux.gs');
    if (!fs.existsSync(chemin)) {
      verifier(false, 'distribution/limiteur-de-creneaux.gs existe — lancez '
        + 'node outils/assembler.js');
    } else {
      const livre = fs.readFileSync(chemin, 'utf8');

      const perimes = sources.filter((nom) => !livre.includes(
        fs.readFileSync(path.join(DOSSIER, nom), 'utf8').trimEnd()));
      egal(perimes, [], 'chaque fichier source figure intégralement dans la '
        + 'distribution — relancez node outils/assembler.js après toute '
        + 'modification');

      const annoncee = /^\/\/ Limiteur de créneaux pour Google Forms — version (\S+)$/m
        .exec(livre);
      egal(annoncee && annoncee[1], declaree,
        'et elle annonce la version courante : un numéro faux sur le fichier '
        + 'qu’on distribue est le seul moyen de ne pas savoir ce qui tourne');

      verifier(/installerLeLimiteur/.test(livre.slice(0, 2000)),
        'son en-tête dit quoi faire dès les premières lignes — personne ne lit '
        + '4 000 lignes pour trouver par où commencer');
    }
  }


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

  // Un classeur installé par une version antérieure : sa liste déroulante ignore
  // les états que la version courante sait écrire. Sans rattrapage, le tableau
  // affiche « Non valide » sur des valeurs que le code vient d'y mettre — et
  // rien ne dit qu'il suffirait de réinstaller.
  {
    const vieux = prepare_({ capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 5]] });
    vieux.lire(`(() => {
      const f = SpreadsheetApp.getActive().getSheetByName(LIMITEUR_ONGLET_CRENEAUX_);
      const regle = SpreadsheetApp.newDataValidation()
        .requireValueInList(['Ouvert', 'Complet'], true).build();
      f.getRange(2, 6, 10, 1).setDataValidation(regle);
    })()`);

    const bilan = vieux.lire('limiteurSynchroniser_()');
    egal(bilan.validation.repose, true,
      'une synchronisation repose la liste des états quand elle a vieilli');

    const posee = vieux.feuilles['Créneaux'].validations['2:6'].valeurs;
    verifier(posee.indexOf('Complet par la marge') >= 0,
      'et la liste accepte désormais tous les états que le code sait écrire — un '
      + 'code qui écrit ce que le classeur déclare invalide se contredit, et mine '
      + 'la confiance qu’on met dans le reste');

    // En régime permanent, on ne réécrit pas : la lecture suffit à le savoir.
    egal(vieux.lire('limiteurSynchroniser_()').validation.repose, false,
      'la synchronisation suivante ne la repose pas : elle est déjà juste');
  }

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
  egal([mardi.Pris, mardi.Restant, mardi['État']], [4, 1, 'Complet par la marge'],
    'quatre pris sur cinq avec une marge de 1 : le créneau est retiré alors qu’il '
    + 'reste une place — c’est le but, et l’état le DIT. « Restant 1 » à côté de '
    + '« Complet » se lirait comme une contradiction, et enverrait chercher un '
    + 'défaut de calcul qui n’existe pas');
  verifier(!c.elements[0].choix.some((x) => x.valeur === 'Mardi 14 h'),
    'et il ne figure plus dans le formulaire');

  const pleine = prepare_({
    reponses: [
      ['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:11', 'b@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 2, 1], ['Jeudi 9 h', 5]],
  });
  egal(lignesDe(pleine, 'Créneaux')[0]['État'], 'Complet',
    'un créneau dont toutes les places sont prises dit « Complet », marge ou non : '
    + 'sans quoi la distinction n’apprendrait rien');

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

section('L. La démonstration montre ce que l’outil fait vraiment');
{
  const DEMO = 'Démo — déroulé';
  const AFFICHE = 'Le formulaire proposerait';
  const DECIDE = 'Ce que l’outil décide';

  const c = prepare_({
    elements: [{
      type: 'LIST',
      titre: 'Créneau souhaité',
      choix: ['Mardi 14 h', 'Jeudi 9 h', 'Vendredi 16 h'],
    }],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3], ['Vendredi 16 h', 2]],
  });

  const avant = Object.keys(c.feuilles).slice();
  const choixAvant = c.elements[0].choix.map((x) => x.valeur);
  const revisionsAvant = c.elements[0].revisions;

  const joue = c.lire('limiteurJouerLaDemonstration_()');
  const etapes = lignesDe(c, DEMO);

  // Vérifié ici, et pas plus bas : les synchronisations de contrôle qui suivent
  // modifient le formulaire à bon droit, et masqueraient une démonstration qui
  // y aurait touché.
  egal(c.elements[0].choix.map((x) => x.valeur), choixAvant,
    'la démonstration ne touche pas au formulaire — elle peut donc se lancer sur '
    + 'une campagne en cours');
  egal(c.elements[0].revisions, revisionsAvant,
    'elle n’en produit même aucune révision');
  egal(joue.etapes, 6, 'la démonstration déroule six étapes');
  egal(etapes.length, 6, 'et les écrit toutes dans son onglet');

  egal(etapes[1][AFFICHE], 'Jeudi 9 h · Vendredi 16 h',
    'étape 2 — les deux places du mardi sont prises, le mardi n’est plus proposé');

  verifier(/Surréservation/.test(etapes[2][DECIDE]),
    'étape 3 — Chloé avait la page ouverte : sa réponse est acceptée par Google, '
    + 'et l’outil la classe en liste d’attente au lieu de la perdre');
  verifier(/rang 3 pour 2 places/.test(etapes[2][DECIDE]),
    'en disant le rang qui l’explique');

  // Le point le plus difficile à croire sans le voir : personne n'agit, et
  // pourtant Chloé change de sort. C'est le décalage des numéros de ligne.
  verifier(/Chloé : Acceptée/.test(etapes[3][DECIDE]),
    'étape 4 — Alice se décommande et Chloé prend sa place sans rien faire');
  verifier(/rang 2 /.test(etapes[3][DECIDE]),
    'son rang est passé de 3 à 2 : le rang suit l’ordre des lignes');
  egal(etapes[3][AFFICHE], 'Jeudi 9 h · Vendredi 16 h',
    'et le mardi reste complet, ses deux places étant toujours prises');

  // L'option revient à sa place, pas à la fin : c'est le référentiel qui a
  // gardé l'ordre, le formulaire l'avait oublié en même temps que le libellé.
  egal(etapes[4][AFFICHE], 'Mardi 14 h · Jeudi 9 h · Vendredi 16 h',
    'étape 5 — une seconde annulation fait revenir le mardi, en tête de liste');

  verifier(/le formulaire se ferme/.test(etapes[5][AFFICHE]),
    'étape 6 — plus une place : une question à choix ne peut pas rester vide, '
    + 'donc c’est le formulaire qui se ferme');

  // La promesse qui justifie tout le module : la démonstration passe par le
  // vrai code. On la vérifie en faisant tourner la VRAIE synchronisation sur
  // les mêmes données, et en comparant ce qu'elle affiche.
  poserReponses_(c, ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'], [
    ['2026-09-18 09:05', 'alice@exemple.org', 'Mardi 14 h'],
    ['2026-09-18 09:07', 'bruno@exemple.org', 'Mardi 14 h'],
  ]);
  const reel = c.lire('limiteurSynchroniser_()');
  egal(reel.affiches.join(' · '), etapes[1][AFFICHE],
    'la vraie synchronisation, sur les mêmes données, propose exactement ce que '
    + 'l’étape 2 annonce — une démonstration qui recopierait la logique serait '
    + 'juste le jour où on l’écrit et fausse à la modification suivante');

  poserReponses_(c, ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'], [
    ['2026-09-18 09:12', 'chloe@exemple.org', 'Mardi 14 h'],
    ['2026-09-18 09:20', 'diane@exemple.org', 'Mardi 14 h'],
    ['2026-09-18 09:24', 'emile@exemple.org', 'Jeudi 9 h'],
    ['2026-09-18 09:31', 'farid@exemple.org', 'Jeudi 9 h'],
    ['2026-09-18 09:38', 'gaelle@exemple.org', 'Jeudi 9 h'],
    ['2026-09-18 09:44', 'hugo@exemple.org', 'Vendredi 16 h'],
    ['2026-09-18 09:51', 'ines@exemple.org', 'Vendredi 16 h'],
  ]);
  const complet = c.lire('limiteurSynchroniser_()');
  egal(complet.affiches, [],
    'et sur les sept inscriptions de l’étape 6, elle ne propose plus rien');
  egal(c.formulaire.accepte, false, 'le vrai formulaire se ferme, comme annoncé');

  // Une démonstration qui abîmerait une campagne en cours serait pire qu'absente.
  const apres = Object.keys(c.feuilles);
  egal(apres.filter((n) => !avant.includes(n)).sort(),
    ['Démo — créneaux', 'Démo — déroulé', 'Démo — réponses'],
    'elle n’ajoute que ses trois onglets préfixés');
  const retrait = c.lire('limiteurRetirerLaDemonstration_()');
  egal(retrait.retires.length, 3, 'le retrait efface les trois onglets');
  egal(Object.keys(c.feuilles).sort(), avant.sort(),
    'et rien d’autre : le classeur retrouve exactement ses onglets d’avant');
  egal(c.lire('limiteurRetirerLaDemonstration_()').retires, [],
    'le relancer sur un classeur sans exemple ne fait rien, et ne lève pas');
}

section('M. Le déclencheur ne meurt pas, et ne meurt pas en silence');
{
  const ECHOUE = 'Ce qui a échoué';

  /** Un classeur installé où le formulaire vient de devenir impilotable. */
  const casse_ = (options = {}) => {
    const c = prepare_({
      capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 2]],
      ...options,
    });
    // Quelqu'un ajoute un saut de section à une option : la synchronisation
    // refuse désormais d'y toucher, et tout ce qui l'appelle lève.
    c.elements[0].choix[0].navigation = 'GO_TO_PAGE';
    c.feuilles[c.nomReponses].getRange(2, 1, 1, 3)
      .setValues([['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h']]);
    return c;
  };

  const c = casse_();
  leve(() => c.lire('limiteurSynchroniser_()'), /saut de section/,
    'la synchronisation lève bien : c’est la situation qu’on veut survivre');

  // Sans filet, l'exécution s'arrêtait là — et avec elle le limiteur.
  let leveEncore = false;
  try {
    c.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  } catch (erreur) { leveEncore = true; }
  verifier(!leveEncore,
    'le déclencheur, lui, ne lève plus : sans cela Google l’arrête et les créneaux '
    + 'complets restent affichés, soumission après soumission');

  const derniere = lignesDe(c, 'Journal').pop();
  egal(derniere.Verdict, 'Échec', 'l’échec est consigné au Journal');
  verifier(/saut de section/.test(String(derniere[ECHOUE])),
    'avec ce qui ne va pas');
  verifier(/Retirez la navigation/.test(String(derniere[ECHOUE])),
    'et surtout quoi faire — le refus portait déjà son remède, on le transmet');
  egal(derniere.Ligne, 2, 'et la ligne concernée');

  // Personne ne lit un journal qu'il ne sait pas devoir ouvrir.
  const d = casse_();
  d.lire("SocleFeuilles.ecrireReglage('Réglages', 'Destinataire des alertes', 'chef@exemple.org')");
  d.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  const alerte = d.appels.courriels.find((m) => m.to === 'chef@exemple.org');
  verifier(!!alerte, 'et quelqu’un est prévenu');
  verifier(/Retirez la navigation/.test(alerte.body),
    'le message dit quoi faire, pas seulement que ça a raté');
  verifier(/plus retirés du formulaire|saut de section/.test(alerte.body),
    'et de quoi il retourne');

  // Même cause, même clé : on agrège par cause et non par victime. Une campagne
  // dont chaque soumission échoue pour la même raison produit une alerte.
  d.appels.courriels.length = 0;
  d.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  egal(d.appels.courriels.length, 0,
    'la même cause ne repart pas : trois cents soumissions en échec font une '
    + 'alerte, pas trois cents');

  // Sans réglage, le déclencheur s'exécute sous l'identité de qui l'a posé :
  // c'est cette personne qu'il faut prévenir, sans quoi l'échec reste muet.
  const e = casse_();
  e.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  egal(e.appels.courriels.length, 1, 'sans destinataire réglé, l’alerte part quand même');
  egal(e.appels.courriels[0].to, 'moi@exemple.org',
    'à la personne qui a posé le déclencheur, faute de quoi rien ne serait dit');

  // Une erreur qui ne vient pas de nous ne porte pas de remède : il faut lui en
  // donner un, sinon le message laisse son lecteur devant un constat.
  const f = prepare_({ capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 2]] });
  f.feuilles[f.nomReponses].getRange(1, 3).setValue('Intitulé changé à la main');
  f.feuilles[f.nomReponses].getRange(2, 1, 1, 3)
    .setValues([['2026-09-18 09:10', 'a@exemple.org', 'Mardi 14 h']]);
  f.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  const brute = lignesDe(f, 'Journal').pop();
  egal(brute.Verdict, 'Échec', 'une erreur inattendue est consignée comme les autres');
  verifier(/Recompter et mettre à jour/.test(String(brute[ECHOUE])),
    'avec un remède par défaut, puisqu’elle n’en portait pas');

  // Le filet ne doit pas devenir lui-même la cause d'un échec.
  const g = casse_();
  g.panne.onglet = 'Journal';
  let leveSurJournal = false;
  try {
    g.lire('surSoumissionDuFormulaire({ range: { getRow: () => 2 } })');
  } catch (erreur) { leveSurJournal = true; }
  verifier(!leveSurJournal,
    'un Journal protégé n’empêche pas le filet de tenir : il aurait remplacé '
    + 'l’erreur d’origine par une autre, moins parlante');
  egal(g.appels.courriels.length, 1,
    'et l’alerte part quand même — c’est elle qui reste quand le Journal ne '
    + 'peut plus rien garder');

  // Une soumission qui n'obtient pas le verrou ne reçoit JAMAIS de verdict : ni
  // ligne au Journal, ni courriel. Le comptage se rattrapera tout seul — il lit
  // la feuille — mais une personne en dépassement croirait avoir une place.
  // Payé en conditions réelles le 18 septembre 2026, sur la ligne 10.
  const h = prepare_({ capacites: [['Mardi 14 h', 2]] });
  h.lire("SocleFeuilles.ecrireReglage('Réglages', 'Destinataire des alertes', 'chef@exemple.org')");
  h.lire('LockService.getDocumentLock().tryLock(0)');
  const occupe = h.lire('limiteurSousFilet_(2)');
  egal([occupe.fait, !!occupe.abandon], [false, true],
    'un verrou qui ne se libère pas fait abandonner la soumission');

  const abandonnee = lignesDe(h, 'Journal').pop();
  egal(abandonnee.Verdict, 'Non traitée',
    'et l’abandon est consigné plutôt que passé sous silence : le comptage se '
    + 'rattrape au recomptage suivant, le verdict est perdu pour de bon');
  egal(abandonnee.Ligne, 2, 'avec la ligne concernée, pour la retrouver');
  verifier(/prévenez-la vous-même/.test(String(abandonnee['Ce qui a échoué'])),
    'et ce qu’il reste à faire à la main');
  verifier(h.appels.courriels.some((m) => m.to === 'chef@exemple.org'),
    'l’exploitant est prévenu : c’est lui qui devra rattraper');
}

section('N. Le diagnostic dit ce qu’il sait, et avoue ce qu’il ignore');
{
  const etatDe = (bilan, nom) => {
    const trouve = bilan.controles.find((un) => un.nom === nom);
    return trouve ? trouve.etat : `(contrôle « ${nom} » absent)`;
  };
  const texteDe = (bilan, nom) => {
    const trouve = bilan.controles.find((un) => un.nom === nom);
    return trouve ? `${trouve.constat} ${trouve.quoiFaire}` : '';
  };

  const sain_ = (options = {}) => prepare_({
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
    ...options,
  });

  const c = sain_();
  const bilan = c.lire('limiteurVerifierLInstallation_()');
  egal([bilan.resume.bloquant, bilan.resume.nonMesure], [0, 0],
    'une installation saine ne présente ni blocage ni point non mesuré');
  verifier(bilan.controles.length >= 10,
    `${bilan.controles.length} contrôles passés`);

  // Le diagnostic se lance sur une campagne en cours : il ne doit rien changer.
  const revisions = c.elements[0].revisions;
  const choix = c.elements[0].choix.map((x) => x.valeur);
  c.lire('limiteurVerifierLInstallation_()');
  egal(c.elements[0].revisions, revisions, 'le diagnostic ne touche pas au formulaire');
  egal(c.elements[0].choix.map((x) => x.valeur), choix, 'ni à ses options');

  c.lire('limiteurEcrireLaVerification_(limiteurVerifierLInstallation_().controles)');
  egal(lignesDe(c, 'Vérification').length, bilan.controles.length,
    'le rapport est écrit dans son onglet, un contrôle par ligne');

  // ── Le point qui justifie tout le module ────────────────────────────────
  // Formulaire injoignable : on ne sait plus rien de sa question, de sa
  // navigation ni de ses libellés. Les annoncer bons serait le mensonge le plus
  // coûteux qui soit — celui qui rassure.
  const perdu = sain_();
  perdu.feuilles[perdu.nomReponses].urlFormulaire =
    'https://docs.google.com/forms/d/DISPARU/edit';
  const aveugle = perdu.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(aveugle, 'Le formulaire est joignable'), 'Bloquant',
    'un formulaire injoignable bloque');
  ['La question des créneaux est pilotable', 'Aucune option ne commande un saut de section',
    'Les libellés concordent', 'Chaque réponse tombe sur un créneau connu',
  ].forEach((nom) => {
    egal(etatDe(aveugle, nom), 'Non mesuré',
      `« ${nom} » dit « Non mesuré » plutôt que « Bon » : rien ne permettait de le vérifier`);
  });
  verifier(aveugle.resume.bon < bilan.resume.bon,
    'et le compte de « Bon » baisse — un rapport à moitié aveugle ne doit pas '
    + 'ressembler à un rapport rassurant');

  // ── Ce qui se découvrait jusqu'ici devant un vrai répondant ─────────────
  const sansPlaces = prepare_({ capacites: [['Mardi 14 h', 2]] });
  const b1 = sansPlaces.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b1, 'Chaque créneau a une capacité'), 'À vérifier',
    'un créneau sans capacité est signalé');
  verifier(/Jeudi 9 h/.test(texteDe(b1, 'Chaque créneau a une capacité')),
    'et nommé, avec ce qu’il faut faire');

  // Une marge au moins égale à la capacité rend le créneau complet dès zéro
  // inscription : il disparaît sans que personne n'ait pu le choisir.
  const absurde = prepare_({ capacites: [['Mardi 14 h', 2, 2], ['Jeudi 9 h', 3]] });
  const b2 = absurde.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b2, 'Aucune marge n’annule son créneau'), 'Bloquant',
    'une marge égale à la capacité bloque : personne ne pourrait jamais choisir '
    + 'ce créneau');
  verifier(/Abaissez la marge/.test(texteDe(b2, 'Aucune marge n’annule son créneau')),
    'et le message dit quoi faire');

  const navigue = sain_();
  navigue.elements[0].choix[0].navigation = 'GO_TO_PAGE';
  egal(etatDe(navigue.lire('limiteurVerifierLInstallation_()'),
    'Aucune option ne commande un saut de section'), 'Bloquant',
    'un saut de section bloque, avant qu’une soumission ne le découvre');

  const sansDeclencheur = sain_();
  sansDeclencheur.appels.declencheurs.length = 0;
  egal(etatDe(sansDeclencheur.lire('limiteurVerifierLInstallation_()'),
    'Le déclencheur est posé'), 'Bloquant',
    'aucun déclencheur : rien ne se passerait à la réception d’une réponse');

  const enDouble = sain_();
  enDouble.appels.declencheurs.push({ fonction: 'surSoumissionDuFormulaire' });
  const b3 = enDouble.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b3, 'Le déclencheur est posé'), 'À vérifier',
    'deux déclencheurs : chaque réponse serait traitée deux fois');
  verifier(/plusieurs fois/.test(texteDe(b3, 'Le déclencheur est posé')),
    'et le message dit ce que cela coûte');

  // Confirmation activée sans adresse collectée : le cas se découvrait au
  // premier envoi, c'est-à-dire jamais, puisque rien ne partait.
  const sansAdresse = prepare_({
    entete: ['Horodatage', 'Créneau souhaité'],
    reponses: [['2026-09-18 09:10', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  sansAdresse.lire("SocleFeuilles.ecrireReglage('Réglages', 'Envoyer une confirmation', 'Oui')");
  egal(etatDe(sansAdresse.lire('limiteurVerifierLInstallation_()'),
    'Les adresses nécessaires sont collectées'), 'Bloquant',
    'confirmation activée sans colonne d’adresse : rien ne partirait');

  const inconnu = prepare_({
    reponses: [['2026-09-18 09:10', 'a@exemple.org', 'Lundi 8 h']],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  const b4 = inconnu.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b4, 'Chaque réponse tombe sur un créneau connu'), 'À vérifier',
    'une réponse comptée nulle part est signalée');
  verifier(/Lundi 8 h/.test(texteDe(b4, 'Chaque réponse tombe sur un créneau connu')),
    'avec la valeur en cause');

  // Le rang vient du numéro de ligne : trier la feuille déplace la frontière
  // entre les retenus et la liste d'attente, sans que rien ne le signale.
  const trie = prepare_({
    reponses: [
      ['2026-09-18 10:00', 'tard@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:00', 'tot@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  const b5 = trie.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b5, 'Les réponses sont dans leur ordre d’arrivée'), 'À vérifier',
    'une feuille triée est détectée sur les horodatages');
  verifier(/liste d’attente/.test(texteDe(b5, 'Les réponses sont dans leur ordre d’arrivée')),
    'et le message dit ce que le tri a déplacé');

  // « Non mesuré » dit qu'on n'a PAS PU vérifier, jamais qu'on n'a rien trouvé.
  // Les deux cas se ressemblent et doivent se distinguer, sinon le rapport dit
  // « je ne sais pas » là où il sait, et on cesse de lire la colonne.
  egal(etatDe(bilan, 'Les réponses sont dans leur ordre d’arrivée'), 'Bon',
    'sans aucune réponse, l’ordre est « Bon » : il n’y avait rien à redire, ce '
    + 'qui n’est pas la même chose que n’avoir pas pu regarder');

  const sansDates = prepare_({
    reponses: [['—', 'a@exemple.org', 'Mardi 14 h'], ['—', 'b@exemple.org', 'Jeudi 9 h']],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  const b6 = sansDates.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b6, 'Les réponses sont dans leur ordre d’arrivée'), 'Non mesuré',
    'une colonne d’horodatage illisible, elle, donne « Non mesuré » : on n’a pas '
    + 'pu regarder, et le dire est le seul rapport honnête');

  // Zéro créneau n'est pas « tous ont une capacité ». Le dire « Bon » serait la
  // façon la plus sûre de ne jamais voir qu'il n'y a rien à piloter.
  const vide = monter({
    elements: [{ type: 'LIST', titre: 'Créneau souhaité', choix: [] }],
  });
  vide.lire('limiteurInstaller_()');
  const b7 = vide.lire('limiteurVerifierLInstallation_()');
  egal(etatDe(b7, 'Chaque créneau a une capacité'), 'À vérifier',
    'un référentiel vide est signalé, et non annoncé bon faute de manquant');
  verifier(/ajoutez des options/.test(texteDe(b7, 'Chaque créneau a une capacité')),
    'avec ce qu’il faut faire pour le remplir');

  const quotaBas = sain_({ quota: 3 });
  egal(etatDe(quotaBas.lire('limiteurVerifierLInstallation_()'), 'Il reste du quota d’envoi'),
    'À vérifier', 'un quota d’envoi presque épuisé est signalé avant d’ouvrir '
    + 'les inscriptions, pas au premier dépassement non annoncé');
}

section('O. Les listes qu’on emporte le jour de la visite');
{
  const listes_ = (c) => {
    const bilan = c.lire('limiteurEtablirLesListes_()');
    c.lire('limiteurEcrireLesListes_(limiteurEtablirLesListes_())');
    return bilan;
  };

  const c = prepare_({
    entete: ['Horodatage', 'Adresse e-mail', 'Nom', 'Créneau souhaité'],
    reponses: [
      ['2026-09-18 09:05', 'a@exemple.org', 'Alice', 'Mardi 14 h'],
      ['2026-09-18 09:07', 'b@exemple.org', 'Bruno', 'Mardi 14 h'],
      ['2026-09-18 09:12', 'c@exemple.org', 'Chloé', 'Mardi 14 h'],
      ['2026-09-18 09:20', 'd@exemple.org', 'Diane', 'Jeudi 9 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  const bilan = listes_(c);
  const lignes = lignesDe(c, 'Listes');

  egal(bilan.resume.retenues, 3, 'trois personnes retenues : deux le mardi, une le jeudi');
  egal(bilan.resume.attentes, 1, 'et une en liste d’attente');

  // L'ordre du référentiel, puis le rang : c'est l'ordre dans lequel on appelle
  // les gens, pas celui des horodatages tous créneaux mêlés.
  egal(lignes.map((une) => [une['Créneau'], une.Rang, une.Statut]), [
    ['Mardi 14 h', 1, 'Retenue'],
    ['Mardi 14 h', 2, 'Retenue'],
    ['Mardi 14 h', 3, 'Liste d’attente'],
    ['Jeudi 9 h', 1, 'Retenue'],
  ], 'les listes sont ordonnées par créneau puis par rang, et disent le statut');

  // Sans savoir quelles questions le formulaire pose, on reprend tout sauf ce
  // qui a déjà sa place : deviner laquelle porte l'identité en perdrait une.
  egal(bilan.reprises, ['Adresse e-mail', 'Nom'],
    'toutes les colonnes de réponse sont reprises, hors horodatage et créneau');
  egal(lignes[0].Nom, 'Alice', 'et leur contenu suit la personne');
  egal(lignes[0]['Inscrite le'], '2026-09-18 09:05:00',
    'avec son heure d’inscription, au format qui se trie comme du texte');
  egal(lignes[0].Ligne, 2, 'et le numéro de ligne, pour la retrouver dans les réponses');

  c.lire("SocleFeuilles.ecrireReglage('Réglages', "
    + "'Colonnes à reprendre dans les listes', 'Nom')");
  egal(listes_(c).reprises, ['Nom'], 'le réglage permet de restreindre les colonnes');

  // ── Ce qui ne doit jamais disparaître ───────────────────────────────────
  const orphelin = prepare_({
    entete: ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'],
    reponses: [
      ['2026-09-18 09:05', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:30', 'perdu@exemple.org', 'Lundi 8 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  const b2 = listes_(orphelin);
  const l2 = lignesDe(orphelin, 'Listes');
  egal(b2.resume.horsReferentiel, 1, 'une réponse au créneau inconnu est comptée à part');
  const perdue = l2.find((une) => une['Adresse e-mail'] === 'perdu@exemple.org');
  verifier(!!perdue,
    'et elle figure quand même dans les listes : quelqu’un d’inscrit qui '
    + 'n’apparaîtrait nulle part ne se découvrirait que le jour J, devant lui');
  egal([perdue['Créneau'], perdue.Statut], ['Lundi 8 h', 'Hors référentiel'],
    'avec sa valeur brute et un statut qui dit pourquoi');

  // Un créneau absent des listes se lirait « je ne sais pas s'il existe ».
  const jeudi = l2.find((une) => une['Créneau'] === 'Jeudi 9 h');
  egal([jeudi.Statut, jeudi.Rang], ['Aucune inscription', ''],
    'un créneau sans inscription figure quand même, et le dit');

  // Une capacité non renseignée ne permet pas de dire si la personne est retenue.
  const flou = prepare_({
    entete: ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'],
    reponses: [['2026-09-18 09:05', 'a@exemple.org', 'Jeudi 9 h']],
    capacites: [['Mardi 14 h', 2]],
  });
  listes_(flou);
  egal(lignesDe(flou, 'Listes').find((une) => une['Créneau'] === 'Jeudi 9 h').Statut,
    'Capacité non définie',
    'sans capacité, on ne dit pas « Retenue » : on ne le sait pas');

  // Les listes se lisent, elles ne pilotent pas.
  const revisions = c.elements[0].revisions;
  const choix = c.elements[0].choix.map((x) => x.valeur);
  listes_(c);
  egal(c.elements[0].revisions, revisions, 'établir les listes ne touche pas au formulaire');
  egal(c.elements[0].choix.map((x) => x.valeur), choix, 'ni à ses options');

  // Le jour de la visite, le formulaire peut avoir été supprimé : les listes
  // doivent rester établissables tant que le réglage nomme la colonne.
  const sansFormulaire = prepare_({
    entete: ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'],
    reponses: [['2026-09-18 09:05', 'a@exemple.org', 'Mardi 14 h']],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });
  sansFormulaire.lire("SocleFeuilles.ecrireReglage('Réglages', "
    + "'Colonne du créneau dans les réponses', 'Créneau souhaité')");
  sansFormulaire.feuilles[sansFormulaire.nomReponses].urlFormulaire =
    'https://docs.google.com/forms/d/DISPARU/edit';
  egal(sansFormulaire.lire('limiteurEtablirLesListes_()').resume.retenues, 1,
    'le formulaire disparu n’empêche pas d’établir les listes, le réglage suffisant '
    + 'à savoir quelle colonne lire');
}

section('P. Les couleurs disent la même chose partout, et les colonnes s’expliquent');
{
  const reglesDe = (c, onglet) => (c.feuilles[onglet] ? c.feuilles[onglet].regles : []);
  const teinteDe = (c, onglet, valeur) => {
    const trouve = reglesDe(c, onglet).find((une) => une.valeur === valeur);
    return trouve ? [trouve.fond, trouve.texte] : null;
  };
  const noteDe = (c, onglet, colonne) => {
    const f = c.feuilles[onglet];
    if (!f) return '';
    const entete = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0].map(String);
    const rang = entete.indexOf(colonne);
    return rang === -1 ? '' : (f.notes[`1:${rang + 1}`] || '');
  };

  const c = prepare_({
    entete: ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'],
    reponses: [
      ['2026-09-18 09:05', 'a@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:07', 'b@exemple.org', 'Mardi 14 h'],
      ['2026-09-18 09:30', 'perdu@exemple.org', 'Lundi 8 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 3]],
  });

  egal(reglesDe(c, 'Créneaux').length, 5,
    'cinq règles sur l’onglet « Créneaux » : une par état possible');
  verifier(!!teinteDe(c, 'Créneaux', 'Ouvert'), '« Ouvert » est coloré');

  // « Complet » n'est pas un problème, c'est le fonctionnement normal. Le
  // peindre en orange le ferait traiter comme une anomalie.
  egal(teinteDe(c, 'Créneaux', 'Complet par la marge'), teinteDe(c, 'Créneaux', 'Complet'),
    'un créneau fermé par la marge porte la teinte de ce qui est complet : le mot '
    + 'les distingue, la couleur dit qu’il n’y a rien à faire ni dans un cas ni '
    + 'dans l’autre');
  egal(teinteDe(c, 'Créneaux', 'Complet'), teinteDe(c, 'Créneaux', 'Fermé à la main'),
    '« Complet » porte la teinte de ce qui est fini, comme « Fermé à la main » : '
    + 'il n’y a plus rien à y faire, ce n’est pas une anomalie');
  verifier(JSON.stringify(teinteDe(c, 'Créneaux', 'Complet'))
    !== JSON.stringify(teinteDe(c, 'Créneaux', 'Sans capacité')),
    'et « Sans capacité », qui attend une décision, ne lui ressemble pas');

  c.lire('limiteurEcrireLesListes_(limiteurEtablirLesListes_())');
  c.lire('limiteurEcrireLaVerification_(limiteurVerifierLInstallation_().controles)');

  // Un rouge qui voudrait dire deux choses selon l'onglet se lit moins vite
  // qu'une absence de couleur : il faut d'abord se rappeler où l'on est.
  egal(teinteDe(c, 'Listes', 'Hors référentiel'), teinteDe(c, 'Journal', 'Hors référentiel'),
    '« Hors référentiel » porte la même teinte aux Listes et au Journal');
  egal(teinteDe(c, 'Listes', 'Retenue'), teinteDe(c, 'Créneaux', 'Ouvert'),
    'et ce qui va bien porte partout la teinte de ce qui va bien');
  egal(teinteDe(c, 'Vérification', 'Non mesuré'),
    teinteDe(c, 'Listes', 'Capacité non définie'),
    '« Non mesuré » et « Capacité non définie » partagent la teinte de ce qu’on '
    + 'ignore — ni un demi-bon, ni une anomalie');
  verifier(JSON.stringify(teinteDe(c, 'Vérification', 'Non mesuré'))
    !== JSON.stringify(teinteDe(c, 'Vérification', 'À vérifier')),
    'qui ne se confond pas avec ce qu’il y a à traiter');

  // L'onglet « Aide » explique l'outil ; la note explique la colonne qu'on a
  // sous le curseur.
  verifier(/réglage « Marge par défaut »/.test(noteDe(c, 'Créneaux', 'Marge')),
    'la note de « Marge » dit ce que fait une cellule vide');
  verifier(/non décidé/.test(noteDe(c, 'Créneaux', 'Places')),
    'celle de « Places » dit que vide ne veut pas dire zéro');
  verifier(/ne défait jamais/.test(noteDe(c, 'Créneaux', 'État')),
    'celle d’« État » dit ce que le code ne touchera pas');
  verifier(/PAS PU/.test(noteDe(c, 'Vérification', 'État')),
    'et celle du diagnostic rappelle que « Non mesuré » n’est pas « Bon »');
  verifier(/comptée nulle part/.test(noteDe(c, 'Listes', 'Statut')),
    'celle des listes dit ce qu’est une inscription hors référentiel');

  // `clear()` emporte notes et règles avec le contenu : un onglet réécrit se
  // retrouverait nu, et rien ne le signalerait.
  c.lire('limiteurEcrireLesListes_(limiteurEtablirLesListes_())');
  verifier(!!teinteDe(c, 'Listes', 'Retenue'),
    'réécrire les listes repose leurs couleurs');
  verifier(/ordre d’arrivée/.test(noteDe(c, 'Listes', 'Rang')),
    'et leurs notes');

  // Rhabiller deux fois ne doit pas empiler les règles.
  const avant = reglesDe(c, 'Créneaux').length;
  c.lire('limiteurHabillerTout_()');
  c.lire('limiteurHabillerTout_()');
  egal(reglesDe(c, 'Créneaux').length, avant,
    'rhabiller ne double pas les règles : on retire les nôtres avant de les reposer');

  // Une règle posée par l'utilisateur sur une autre colonne lui appartient.
  c.lire(`(() => {
    const f = SpreadsheetApp.getActive().getSheetByName(LIMITEUR_ONGLET_CRENEAUX_);
    const mienne = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('à moi').setBackground('#000000')
      .setRanges([f.getRange(2, 1, 10, 1)]).build();
    f.setConditionalFormatRules([...f.getConditionalFormatRules(), mienne]);
  })()`);
  c.lire('limiteurHabillerTout_()');
  verifier(reglesDe(c, 'Créneaux').some((une) => une.valeur === 'à moi'),
    'une règle posée sur une autre colonne survit à l’habillage');

  // L'habillage ne doit jamais empêcher l'outil de fonctionner.
  const casse = prepare_({ capacites: [['Mardi 14 h', 2]] });
  casse.panne.onglet = 'Créneaux';
  let leveSurHabillage = false;
  try { casse.lire('limiteurHabillerTout_()'); } catch (erreur) { leveSurHabillage = true; }
  verifier(!leveSurHabillage,
    'un onglet protégé ne fait pas échouer l’habillage : l’apparence ne doit pas '
    + 'empêcher un outil de fonctionner');
}

section('Q. Se greffer sur un classeur qui vit déjà');
{
  // Trois onglets sont réécrits en entier parce qu'ils appartiennent au code.
  // Sur un classeur métier qui en porterait un du même nom, ce serait une perte
  // de travail, et elle serait silencieuse.
  const occupe = monter();
  poserReponses_(occupe, ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'], []);
  occupe.lire(`(() => {
    const f = SpreadsheetApp.getActive().insertSheet('Aide');
    f.getRange(1, 1, 2, 2).setValues([
      ['Procédure', 'Responsable'],
      ['Ouverture des locaux', 'Accueil'],
    ]);
  })()`);

  leve(() => occupe.lire('limiteurInstaller_()'), /existe déjà dans ce classeur/,
    'un onglet « Aide » qui ne vient pas du limiteur fait refuser l’installation');
  verifier(/Renommez l’onglet existant/.test(
    (() => {
      try { occupe.lire('limiteurInstaller_()'); return ''; }
      catch (e) { return e.message; }
    })()),
    'et le message dit quoi faire, sans décider à la place de personne');

  egal(occupe.feuilles.Aide.getRange(2, 1).getValue(), 'Ouverture des locaux',
    'le contenu de l’onglet est intact : on refuse AVANT d’écrire quoi que ce soit');
  egal(occupe.classeur.getSheetByName('Créneaux'), null,
    'et rien n’a été installé — un classeur à moitié installé est pire qu’un '
    + 'classeur pas installé, parce qu’on ne sait plus où l’on en est');

  // Le même onglet, mais vide : il n'appartient à personne.
  const vide = monter();
  poserReponses_(vide, ['Horodatage', 'Adresse e-mail', 'Créneau souhaité'], []);
  vide.lire("SpreadsheetApp.getActive().insertSheet('Aide')");
  vide.lire('limiteurInstaller_()');
  verifier(!!vide.classeur.getSheetByName('Créneaux'),
    'un onglet homonyme mais vide ne bloque rien : il n’appartient à personne');

  // Un formulaire qui vit déjà porte des réponses antérieures à l'installation.
  const ancien = prepare_({
    reponses: [
      ['2026-09-10 08:00', 'ancien1@exemple.org', 'Mardi 14 h'],
      ['2026-09-10 08:05', 'ancien2@exemple.org', 'Mardi 14 h'],
      ['2026-09-10 08:10', 'ancien3@exemple.org', 'Mardi 14 h'],
    ],
    capacites: [['Mardi 14 h', 2], ['Jeudi 9 h', 5]],
  });
  egal(lignesDe(ancien, 'Créneaux')[0].Pris, 3,
    'les réponses reçues avant l’installation sont comptées : le comptage lit la '
    + 'feuille, pas le Journal');
  verifier(!ancien.elements[0].choix.some((x) => x.valeur === 'Mardi 14 h'),
    'un créneau déjà dépassé disparaît donc dès l’installation, sans prévenir '
    + 'personne — c’est à savoir avant de se greffer sur une campagne en cours');

  egal(lignesDe(ancien, 'Journal').length, 0,
    'mais elles n’ont AUCUN verdict : le déclencheur n’existait pas quand elles '
    + 'sont arrivées, et rien ne peut le rattraper après coup');

  // C'est l'onglet « Listes » qui rattrape, et lui seul.
  ancien.lire('limiteurEcrireLesListes_(limiteurEtablirLesListes_())');
  const listes = lignesDe(ancien, 'Listes');
  egal(listes.filter((une) => une.Statut === 'Liste d’attente').length, 1,
    'les listes, elles, rangent la troisième en liste d’attente : c’est le seul '
    + 'moyen de savoir qui dépasse parmi les inscrits d’avant');
  egal(listes.find((une) => une.Statut === 'Liste d’attente')['Adresse e-mail'],
    'ancien3@exemple.org', 'et de savoir qui prévenir à la main');
}

section('K. La documentation dit ce que le banc fait vraiment');
{
  // Ces chiffres vivent à quatre endroits — les deux versions du README, le
  // CHANGELOG, et le banc lui-même — et rien ne les tenait ensemble. Un état
  // dupliqué dérive à la première retouche : ajouter une assertion rendait
  // trois textes faux, en silence. Un banc qui ment sur sa propre couverture
  // ne vaut pas mieux qu'une version affichée et fausse.
  const NOMBRES_ = {
    fr: ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
      'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
      'dix-sept', 'dix-huit', 'dix-neuf', 'vingt', 'vingt et un', 'vingt-deux',
      'vingt-trois', 'vingt-quatre', 'vingt-cinq', 'vingt-six', 'vingt-sept',
      'vingt-huit', 'vingt-neuf', 'trente', 'trente et un', 'trente-deux',
      'trente-trois', 'trente-quatre', 'trente-cinq', 'trente-six',
      'trente-sept', 'trente-huit', 'trente-neuf', 'quarante'],
    en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
      'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one',
      'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six',
      'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one',
      'thirty-two', 'thirty-three', 'thirty-four', 'thirty-five', 'thirty-six',
      'thirty-seven', 'thirty-eight', 'thirty-nine', 'forty'],
  };
  const mot = (n, langue) => {
    if (n >= NOMBRES_[langue].length) {
      throw new Error(`Le banc ne sait écrire que jusqu'à quarante en « ${langue} », `
        + `et l'épreuve porte ${n} défauts. Étendez NOMBRES_ dans banc/test.js, `
        + 'ou écrivez le nombre en chiffres dans la documentation.');
    }
    return NOMBRES_[langue][n];
  };

  // Les blancs sont réduits avant toute recherche : un texte Markdown coupe
  // ses lignes à quatre-vingts colonnes, et un contrôle qui casserait selon
  // l'endroit où tombe la coupure enverrait chercher un défaut inexistant.
  const aplatir = (texte) => texte.replace(/\s+/g, ' ');

  const readme = aplatir(fs.readFileSync(path.join(RACINE, 'README.md'), 'utf8'));
  // Le CHANGELOG garde des chiffres historiques : une entrée ancienne décrit
  // ce qu'était cette version-là, et la « corriger » serait la falsifier. Seule
  // l'entrée la plus récente parle de l'état courant, et c'est la seule qu'on
  // tient — Keep a Changelog range la plus récente en premier.
  const changelogEntier = fs.readFileSync(path.join(RACINE, 'CHANGELOG.md'), 'utf8');
  const changelog = aplatir(`## ${changelogEntier.split(/^## /m)[1] || ''}`);
  const epreuve = fs.readFileSync(path.join(__dirname, 'epreuve.js'), 'utf8');

  // Le nombre de défauts se lit dans l'épreuve sans avoir à l'exécuter : elle
  // recopie le projet treize fois, le banc doit rester instantané.
  const defauts = (epreuve.match(/^ {2}\['/gm) || []).length;
  verifier(defauts >= 10, `banc/epreuve.js porte ${defauts} défauts — en dessous de `
    + 'dix, c’est la lecture du compte qui est cassée, pas le fichier');
  verifier(readme.includes(`**${mot(defauts, 'fr')} défauts réels**`),
    `le README français annonce « ${mot(defauts, 'fr')} défauts réels », autant que `
    + 'banc/epreuve.js en porte');
  verifier(readme.includes(`**${mot(defauts, 'en')} deliberate defects**`),
    `le README anglais annonce « ${mot(defauts, 'en')} deliberate defects » — une `
    + 'documentation bilingue dérive toujours d’un seul côté d’abord');
  verifier(changelog.includes(`${mot(defauts, 'fr')} défauts`),
    `le CHANGELOG annonce ${mot(defauts, 'fr')} défauts`);

  const annonces = [...`${readme}\n${changelog}`.matchAll(/(\d+) assertions/g)]
    .map((m) => Number(m[1]));
  verifier(annonces.length >= 3,
    `le nombre d’assertions est annoncé ${annonces.length} fois — on en attend au `
    + 'moins trois (README français, README anglais, CHANGELOG), et une mention '
    + 'supprimée serait un contrôle perdu sans que rien ne le dise');
  egal([...new Set(annonces)], [annonces[0]],
    'toutes les mentions donnent le même nombre');

  // Le total ne peut pas être connu avant d'avoir fini de compter : cette
  // assertion-ci se compte donc elle-même, et c'est le seul point fixe
  // possible. Elle doit rester la dernière du banc.
  //
  // On la saute quand autre chose a déjà échoué : le total serait alors plus
  // bas pour une raison qui n'a rien à voir, et le message enverrait corriger
  // la documentation au lieu du défaut.
  if (echecs.length > 0) {
    console.log('  (total non vérifié : corrigez d’abord les échecs ci-dessus, '
      + 'un banc en échec n’a pas de total significatif)');
  } else {
    const total = passes + 1;
    verifier(annonces[0] === total,
      `la documentation annonce ${annonces[0]} assertions et le banc en passe ${total} `
      + '— reportez le bon nombre dans les deux README et le CHANGELOG');
  }
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
