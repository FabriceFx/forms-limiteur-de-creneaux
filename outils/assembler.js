// Assemble le fichier unique à coller dans Apps Script :
//
//     node outils/assembler.js
//
// Quinze fichiers à créer un par un dans l'éditeur, personne ne le fait. Un
// seul copier-coller, tout le monde le fait. C'est le seul obstacle qui séparait
// cet outil de quelqu'un qui veut simplement s'en servir.
//
// **L'ordre alphabétique est celui qui compte**, et ce n'est pas un hasard :
// c'est celui dans lequel l'éditeur Apps Script charge les fichiers. Le banc
// vérifie déjà que le projet s'y charge — contrôle posé pour un tout autre
// piège, et qui se trouve être exactement ce qui rend cette concaténation sûre.
//
// Le fichier engendré n'est pas versionné à la main : `banc/test.js` vérifie
// qu'il correspond aux sources, parce qu'une distribution périmée est pire
// qu'une distribution absente — elle a l'air d'être à jour.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'apps-script');
const SORTIE = path.join(RACINE, 'distribution');
const FICHIER = 'limiteur-de-creneaux.gs';

const version = fs.readFileSync(path.join(RACINE, 'VERSION'), 'utf8').trim();

const noms = fs.readdirSync(SOURCE).filter((nom) => nom.endsWith('.gs')).sort();
const morceaux = noms.map((nom) => {
  const contenu = fs.readFileSync(path.join(SOURCE, nom), 'utf8');
  return `// ===========================================================================\n`
    + `// ${nom}\n`
    + `// ===========================================================================\n\n`
    + `${contenu.trimEnd()}\n`;
});

const entete = `// Limiteur de créneaux pour Google Forms — version ${version}
//
// Retire d'un formulaire les créneaux dont toutes les places sont prises, et les
// remet quand une place se libère.
//
// ── Quoi faire de ce fichier ───────────────────────────────────────────────
//
//   1. Ouvrez le CLASSEUR qui reçoit les réponses de votre formulaire.
//      (Dans le formulaire : onglet « Réponses », puis « Afficher dans Sheets ».)
//   2. Menu « Extensions » > « Apps Script ».
//   3. Effacez ce que contient l'éditeur, collez TOUT ce fichier, enregistrez.
//   4. En haut de l'éditeur, choisissez la fonction « installerLeLimiteur »
//      et lancez-la. Acceptez les autorisations demandées.
//   5. Revenez au classeur et rechargez la page : un menu « Créneaux » apparaît.
//   6. Dans l'onglet « Créneaux », renseignez la colonne « Places ».
//   7. Menu « Créneaux » > « Vérifier mon installation ».
//
// Le guide complet — et ce qui change si votre formulaire reçoit DÉJÀ des
// réponses — est dans DEMARRAGE.md.
//
// ── Ce que vous devez savoir avant de vous en servir ───────────────────────
//
// Retirer un créneau du formulaire n'empêche pas une inscription de trop : la
// page déjà ouverte dans le navigateur de quelqu'un affiche encore l'ancienne
// liste, et Google accepte sa réponse. L'outil le détecte à la réception, le
// note dans l'onglet « Journal » et prévient la personne qu'elle est en liste
// d'attente. Le menu « Créneaux » > « Voir un exemple » le montre en six étapes.
//
// ── Ce fichier est ENGENDRÉ ────────────────────────────────────────────────
//
// Ne le modifiez pas : il est assemblé depuis ${noms.length} fichiers sources par
// \`node outils/assembler.js\`, et toute retouche serait perdue à la prochaine
// génération. Pour modifier l'outil, travaillez dans \`apps-script/\`.
//
// Sous licence Elastic License 2.0 — Fabrice Faucheux (https://faucheux.bzh)

`;

const assemble = entete + morceaux.join('\n');

// ---- le fichier se vérifie avant d'être livré ------------------------------

const ennuis = [];
try {
  // eslint-disable-next-line no-new
  new vm.Script(assemble, { filename: FICHIER });
} catch (erreur) {
  ennuis.push(`syntaxe du fichier assemblé : ${erreur.message}`);
}

const vus = {};
noms.forEach((nom) => {
  const texte = fs.readFileSync(path.join(SOURCE, nom), 'utf8');
  [...texte.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].forEach((m) => {
    if (vus[m[1]] && vus[m[1]] !== nom) {
      ennuis.push(`nom global « ${m[1]} » déclaré dans ${vus[m[1]]} et ${nom}`);
    }
    vus[m[1]] = nom;
  });
});

if (ennuis.length > 0) {
  console.log('À corriger avant de livrer :');
  ennuis.forEach((un) => console.log(`  · ${un}`));
  process.exit(1);
}

fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(path.join(SORTIE, FICHIER), assemble, 'utf8');

const lignes = assemble.split('\n').length;
console.log(`distribution/${FICHIER} — version ${version}`);
console.log(`  ${noms.length} fichiers assemblés, ${lignes} lignes, `
  + `${Math.round(assemble.length / 1024)} Ko`);
console.log('\nUn seul copier-coller pour qui veut s’en servir.');
