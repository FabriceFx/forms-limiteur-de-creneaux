// Prépare le dossier à pousser dans un classeur d'essai — hors de Google :
//
//     node outils/preparer-essai.js
//
// Le dossier est **assemblé depuis la source**, jamais recopié à la main : un
// dossier d'essai qui porterait sa propre copie des modules finirait par
// éprouver autre chose que ce que le projet contient.
//
// Trois particularités, et elles sont voulues :
//
//   - **le dossier est engendré À CÔTÉ du dépôt**, jamais dedans. clasp remonte
//     les dossiers parents pour trouver un `.clasp.json` : depuis un dossier
//     imbriqué, `clasp create` refuse et `clasp push` repousse le projet du
//     parent en affichant des chemins en `../` ;
//   - **les fichiers sont à plat.** clasp transforme un sous-dossier en préfixe
//     de nom : `outils/Controle.gs` deviendrait le fichier `outils/Controle`
//     dans l'éditeur ;
//   - **le manifeste d'essai demande exactement les portées du produit.** Une
//     première version y ajoutait `drive.file` pour jeter les formulaires du
//     contrôle : `DriveApp` exige en réalité la portée `drive` entière, et
//     réclamer l'accès au Drive complet pour un outil d'essai serait hors de
//     proportion. Le contrôle rend les liens, vous jetez d'un clic.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'apps-script');
const SORTIE = path.join(RACINE, '..', 'limiteur-essai');
const version = fs.readFileSync(path.join(RACINE, 'VERSION'), 'utf8').trim();

// ---------------------------------------------------------------------------

const MANIFESTE = {
  timeZone: 'Europe/Paris',
  runtimeVersion: 'V8',
  exceptionLogging: 'STACKDRIVER',
  oauthScopes: [
    'https://www.googleapis.com/auth/spreadsheets.currentonly',
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.container.ui',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

const ESSAI = `/**
 * Montage du formulaire d'essai — n'existe que dans le dossier d'essai.
 *
 * \`clasp create --type sheets\` donne un classeur vide : il faut encore un
 * formulaire qui lui envoie ses réponses, sans quoi le limiteur n'a rien à
 * piloter et son installation refuse de partir.
 *
 * Cette fonction le crée, y pose trois créneaux et le lie au classeur courant.
 * À lancer depuis le menu d'exécution de l'éditeur — c'est pourquoi elle est
 * déclarée, comme le contrôle.
 */
function preparerLeFormulaireDEssai() {
  const classeur = SpreadsheetApp.getActive();
  const formulaire = FormApp.create(\`Essai du limiteur — \${classeur.getName()}\`);

  formulaire.setTitle('Visites — essai du limiteur')
    .setDescription('Formulaire d’essai. Les inscriptions ne valent rien.');

  formulaire.addListItem()
    .setTitle('Créneau souhaité')
    .setChoiceValues(['Mardi 14 h', 'Jeudi 9 h', 'Vendredi 16 h'])
    .setRequired(true);

  formulaire.addTextItem().setTitle('Votre nom');

  // La collecte des adresses a changé de méthode au fil des versions de l'API.
  // On essaie, et on DIT si ça n'a pas pris plutôt que de le supposer : une
  // confirmation activée sans adresse collectée n'envoie rien, en silence.
  let adresses = 'activée';
  try {
    formulaire.setCollectEmail(true);
  } catch (erreur) {
    adresses = \`À ACTIVER À LA MAIN (setCollectEmail a échoué : \${erreur.message})\`;
  }

  formulaire.setDestination(FormApp.DestinationType.SPREADSHEET, classeur.getId());

  const lignes = [
    'Formulaire d’essai créé et lié à ce classeur.',
    '',
    \`Le remplir : \${formulaire.getPublishedUrl()}\`,
    \`Le modifier : \${formulaire.getEditUrl()}\`,
    '',
    \`Collecte des adresses : \${adresses}\`,
    '',
    'Rechargez le classeur — un onglet de réponses est apparu — puis lancez',
    '« installerLeLimiteur » depuis le menu d’exécution, ou le menu « Créneaux »',
    'une fois la page rechargée.',
  ];
  const rapport = lignes.join('\\n');
  console.log(rapport);
  SpreadsheetApp.getUi().alert('Essai du limiteur', rapport,
    SpreadsheetApp.getUi().ButtonSet.OK);
  return rapport;
}
`;

const CLASPIGNORE = `**/**
!appsscript.json
!*.gs
`;

const LISEZMOI = `# Classeur d'essai — limiteur de créneaux ${version}

Ce dossier est **engendré**. Ne rien y modifier : la source est
\`limiteur-de-creneaux/\`, et

\`\`\`bash
node outils/preparer-essai.js
\`\`\`

le réécrit. Seuls \`.clasp.json\` et \`appsscript.json\` y survivent, parce qu'ils
appartiennent à clasp.

## Première fois

\`\`\`bash
cd ../limiteur-essai
clasp create --type sheets --title "Essai du limiteur de créneaux"
clasp push
\`\`\`

\`clasp create\` pose le fuseau par défaut du compte Google, qui n'est pas
toujours \`Europe/Paris\` — le contrôle le vérifie et le dit. Six heures d'écart
suffisent à ranger une date normalisée la veille.

\`clasp push\` doit annoncer une vingtaine de fichiers. S'il n'annonce rien, ou
si l'éditeur reste vide, rien n'est arrivé dans Google et la suite ne peut pas
marcher.

Puis, dans l'éditeur Apps Script du classeur créé — \`clasp open-container\` l'ouvre :

1. **Cliquez d'abord sur \`Essai.gs\`** dans la liste de fichiers, à gauche. Le
   sélecteur de fonction, en haut de l'éditeur, ne propose **que les fonctions
   du fichier affiché** : depuis \`Limiteur.gs\`, \`preparerLeFormulaireDEssai\`
   reste introuvable, et rien ne dit pourquoi.
2. Lancez **\`preparerLeFormulaireDEssai\`** — il crée un formulaire à trois
   créneaux et le lie au classeur. Vérifiez dans son rapport que la collecte des
   adresses a bien été activée.
3. Rechargez le classeur. Le menu **Créneaux** apparaît.
4. **Créneaux > Installer ou mettre à jour**, puis renseignez la colonne
   « Places » de l'onglet « Créneaux ».
5. Ouvrez **\`Controle.gs\`**, puis lancez **\`controlerEnConditionsReelles\`** —
   il éprouve ce que le banc ne peut pas voir.

Ces deux fonctions sont dans le **sélecteur de fonction de l'éditeur**, pas dans
le menu du classeur : elles n'appartiennent pas au produit, et y ajouter une entrée
aurait demandé de modifier \`Menu.gs\`, donc d'éprouver autre chose que ce qui
est livré.

## Ce que le contrôle cherche

Trois hypothèses portent du code de refus depuis la première version et n'ont
jamais été vérifiées ailleurs que dans la documentation de Google :

- **\`setChoiceValues\` efface la navigation par section.** Si c'est faux, le
  refus de piloter une telle question est inutilement strict ;
- **une question à choix refuse une liste vide**, d'où la fermeture du
  formulaire plutôt qu'une question vidée ;
- **le déclencheur part après l'écriture de la ligne**, d'où \`forSpreadsheet\`
  plutôt que \`forForm\`. Ce dernier point reste une **indication et non une
  preuve** : un déclencheur lent ressemble à un déclencheur qui n'a pas vu la
  ligne.

Le contrôle n'envoie aucun courriel. Il ne supprime pas les formulaires qu'il
crée — \`DriveApp\` exige la portée \`drive\` entière, hors de proportion pour un
essai — mais il en donne les liens en fin de rapport.

**Lancez \`preparerLeFormulaireDEssai\` avant le contrôle.** Sans formulaire lié,
le classeur ne reçoit aucune réponse et le contrôle du déclencheur ne peut pas
avoir lieu ; il le dira, en toutes lettres.

## Après l'essai

Le classeur et son formulaire peuvent être jetés. Ce dossier n'est versionné
nulle part — seul \`limiteur-de-creneaux/outils/preparer-essai.js\` est suivi
par git.

Ce qui aura été démenti se reporte dans le banc : un faux service qui valide un
code faux est pire qu'un faux service absent.
`;

// ---------------------------------------------------------------------------

// Ce qui appartient à clasp survit à la régénération.
//
// Payé une fois dans le socle : effacer le dossier entier emporte le
// `.clasp.json` écrit par `clasp create`, donc le lien vers le classeur. Le
// classeur reste dans Drive, mais plus rien ne le désigne. Pour le retrouver :
// ouvrir le classeur, Extensions > Apps Script, copier l'identifiant de l'URL.
const APPARTIENT_A_CLASP = ['.clasp.json'];
const conserves = {};
APPARTIENT_A_CLASP.forEach((nom) => {
  const complet = path.join(SORTIE, nom);
  if (fs.existsSync(complet)) conserves[nom] = fs.readFileSync(complet, 'utf8');
});

fs.rmSync(SORTIE, { recursive: true, force: true });
fs.mkdirSync(SORTIE, { recursive: true });
Object.keys(conserves).forEach((nom) => {
  fs.writeFileSync(path.join(SORTIE, nom), conserves[nom], 'utf8');
});

const source = [];
const poses = [];

fs.readdirSync(SOURCE).filter((nom) => nom.endsWith('.gs')).sort().forEach((nom) => {
  const contenu = fs.readFileSync(path.join(SOURCE, nom), 'utf8');
  fs.writeFileSync(path.join(SORTIE, nom), contenu, 'utf8');
  source.push(contenu);
  poses.push(nom);
});

['Controle.gs'].forEach((nom) => {
  const contenu = fs.readFileSync(path.join(__dirname, nom), 'utf8');
  fs.writeFileSync(path.join(SORTIE, nom), contenu, 'utf8');
  source.push(contenu);
  poses.push(nom);
});

fs.writeFileSync(path.join(SORTIE, 'Essai.gs'), ESSAI, 'utf8');
source.push(ESSAI);
poses.push('Essai.gs');

fs.writeFileSync(path.join(SORTIE, 'appsscript.json'),
  `${JSON.stringify(MANIFESTE, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(SORTIE, '.claspignore'), CLASPIGNORE, 'utf8');
fs.writeFileSync(path.join(SORTIE, 'LISEZMOI.md'), LISEZMOI, 'utf8');

// ---- le dossier se vérifie avant d'être livré ------------------------------

const ennuis = [];

try {
  const dansLOrdre = poses.slice().sort()
    .map((nom) => fs.readFileSync(path.join(SORTIE, nom), 'utf8'))
    .join('\n');
  // eslint-disable-next-line no-new
  new vm.Script(dansLOrdre, { filename: 'essai.gs' });
} catch (erreur) {
  ennuis.push(`syntaxe du projet concaténé : ${erreur.message}`);
}

// Deux fichiers déclarant le même nom global empêchent le projet ENTIER de se
// charger : toutes ses fonctions deviennent introuvables d'un coup. Le risque
// est réel ici, puisqu'on ajoute deux fichiers à un projet qui en a déjà douze.
const vus = {};
poses.forEach((nom) => {
  const texte = fs.readFileSync(path.join(SORTIE, nom), 'utf8');
  [...texte.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].forEach((m) => {
    if (vus[m[1]] && vus[m[1]] !== nom) {
      ennuis.push(`nom global « ${m[1]} » déclaré dans ${vus[m[1]]} et ${nom}`);
    }
    vus[m[1]] = nom;
  });
});

// Un second `onOpen` suffirait, et c'est l'erreur qu'on ferait en ajoutant une
// entrée de menu d'essai.
const onOpens = poses.filter((nom) => /^function\s+onOpen\b/m.test(
  fs.readFileSync(path.join(SORTIE, nom), 'utf8')));
if (onOpens.length !== 1) {
  ennuis.push(`onOpen déclaré ${onOpens.length} fois (${onOpens.join(', ') || 'aucune'})`);
}

// ---- rapport ---------------------------------------------------------------

console.log(`Dossier d'essai engendré : ${SORTIE}`);
console.log(`  ${poses.length} fichiers .gs, manifeste, .claspignore, LISEZMOI.md`);
if (Object.keys(conserves).length > 0) {
  console.log(`  conservé : ${Object.keys(conserves).join(', ')}`);
}

if (ennuis.length > 0) {
  console.log('\nÀ corriger avant de pousser :');
  ennuis.forEach((un) => console.log(`  · ${un}`));
  process.exit(1);
}

console.log('\nRien à signaler. Ensuite :');
console.log(`  cd ${path.relative(process.cwd(), SORTIE) || SORTIE}`);
console.log(conserves['.clasp.json']
  ? '  clasp push'
  : '  clasp create --type sheets --title "Essai du limiteur de créneaux" && clasp push');
console.log('  clasp open-container');
console.log('\nPuis, dans l’éditeur : ouvrez Essai.gs AVANT de chercher');
console.log('« preparerLeFormulaireDEssai » — le sélecteur de fonction ne montre');
console.log('que les fonctions du fichier affiché.');
