// Éprouve le banc lui-même :
//
//     node banc/epreuve.js
//
// Chaque défaut réintroduit ici DOIT faire échouer `banc/test.js`. Un banc qui
// reste vert sur un défaut ne prouve rien — il dit seulement que le code fait
// ce que le code fait.
//
// Les défauts ne sont pas inventés : chacun correspond à une décision du projet
// qu'une « simplification » future pourrait défaire sans en voir le prix. Les
// deux derniers portent sur la documentation : elle est tenue par le banc au
// même titre que le code.
//
// Ajouter une règle au code, c'est ajouter son défaut ici.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const BAC = fs.mkdtempSync(path.join(os.tmpdir(), 'limiteur-epreuve-'));

const DEFAUTS = [
  ['on n’adopte plus les options ajoutées à la main', 'apps-script/Synchronisation.gs',
    'const adoption = limiteurAdopterLesNouveaux_(referentiel.creneaux, libellesDuFormulaire);',
    'const adoption = { ajoutes: [] };'],
  ['on ne relit pas le référentiel après adoption', 'apps-script/Synchronisation.gs',
    'if (adoption.ajoutes.length > 0) referentiel = limiteurLireReferentiel_(margeParDefaut);',
    ''],
  ['on ne refuse plus une question à navigation par section', 'apps-script/Formulaire.gs',
    '  if (navigants.length === 0) return;',
    '  if (navigants.length >= 0) return;'],
  ['on rouvre tout formulaire fermé, même par une personne', 'apps-script/Formulaire.gs',
    'if (resteDesPlaces && !ouvert && fermeParLOutil) {',
    'if (resteDesPlaces && !ouvert) {'],
  ['« Fermé à la main » n’est plus respecté', 'apps-script/Limiteur.gs',
    'if (creneau.etatLu === LIMITEUR_ETATS_.ferme) etat = LIMITEUR_ETATS_.ferme;\n    else if',
    'if (false) etat = LIMITEUR_ETATS_.ferme;\n    else if'],
  ['un créneau sans capacité est retiré comme les autres', 'apps-script/Limiteur.gs',
    'aAfficher: etat === LIMITEUR_ETATS_.ouvert || etat === LIMITEUR_ETATS_.sansCapacite,',
    'aAfficher: etat === LIMITEUR_ETATS_.ouvert,'],
  ['on réécrit les choix même quand rien n’a changé', 'apps-script/Formulaire.gs',
    '  if (identiques) return { pose: false };',
    '  if (false) return { pose: false };'],
  ['on ne vérifie plus les libellés à virgule', 'apps-script/Synchronisation.gs',
    '  limiteurVerifierLesLibelles_(referentiel.creneaux, multiple);',
    ''],
  ['la marge est appliquée au verdict, donc la place est perdue', 'apps-script/Synchronisation.gs',
    'else if (rang <= creneau.places) verdict = LIMITEUR_VERDICTS_.acceptee;',
    'else if (rang <= creneau.places - creneau.marge) verdict = LIMITEUR_VERDICTS_.acceptee;'],
  ['une cellule vide est prise pour un libellé inconnu', 'apps-script/Limiteur.gs',
    "if (texte !== '') inconnus[texte] = (inconnus[texte] || 0) + 1;",
    'inconnus[texte] = (inconnus[texte] || 0) + 1;'],
  ['le quota d’envoi n’est plus lu avant d’écrire', 'apps-script/Synchronisation.gs',
    '  if (MailApp.getRemainingDailyQuota() <= 0) {',
    '  if (false) {'],
  ['un formulaire est ouvert par identifiant, hors du classeur lié', 'apps-script/Formulaire.gs',
    'return FormApp.openByUrl(url);',
    'return FormApp.openById(String(url).split("/")[5]);'],
  ['la démonstration raconte le calcul au lieu de l’appeler',
    'apps-script/Demonstration.gs',
    'const evalues = limiteurEtatDesCreneaux_(creneaux, comptage.comptes);',
    'const evalues = creneaux.map((un) => ({ ...un,'
      + " pris: comptage.comptes[un.cle] || 0,"
      + " etat: 'Ouvert', aAfficher: true }));"],
  ['le retrait de l’exemple n’est plus borné à ses propres onglets',
    'apps-script/Demonstration.gs',
    'limiteurDemoOnglets_().forEach((nom) => {\n'
      + '    const feuille = classeur.getSheetByName(nom);\n'
      + '    if (!feuille) return;\n'
      + '    if (nom.indexOf(LIMITEUR_PREFIXE_DEMO_) !== 0) return;',
    'classeur.getSheets().map((f) => f.getName()).forEach((nom) => {\n'
      + '    const feuille = classeur.getSheetByName(nom);\n'
      + '    if (!feuille) return;'],
  ['le nombre d’assertions annoncé n’est plus celui du banc', 'README.md',
    '101 assertions, hors de Google', '74 assertions, hors de Google'],
  ['le README anglais annonce un autre nombre de défauts que le français',
    'README.md',
    '**seventeen deliberate defects**', '**thirteen deliberate defects**'],
  ['les colonnes calculées ne sont plus vérifiées contiguës', 'apps-script/Limiteur.gs',
    '  if (fin - debut !== 3) {',
    '  if (false) {'],
];

let tenus = 0;
const laisses = [];

DEFAUTS.forEach(([nom, fichier, avant, apres]) => {
  const bac = path.join(BAC, 'essai');
  fs.rmSync(bac, { recursive: true, force: true });
  fs.cpSync(RACINE, bac, { recursive: true });

  const cible = path.join(bac, fichier);
  const texte = fs.readFileSync(cible, 'utf8');
  // Un motif introuvable est un échec, pas un succès : le défaut n'aurait
  // jamais été appliqué, et l'épreuve se féliciterait dans le vide.
  if (!texte.includes(avant)) {
    laisses.push(`${nom} — motif introuvable dans ${fichier}, défaut jamais appliqué`);
    return;
  }
  fs.writeFileSync(cible, texte.replace(avant, apres));

  try {
    execFileSync('node', [path.join(bac, 'banc', 'test.js')], { stdio: 'pipe' });
    laisses.push(`${nom} — le banc est resté VERT`);
  } catch (e) {
    tenus += 1;
    console.log(`  attrapé : ${nom}`);
  }
});

fs.rmSync(BAC, { recursive: true, force: true });

console.log(`\n${tenus} défaut(s) sur ${DEFAUTS.length} attrapé(s) par le banc.`);
if (laisses.length) {
  console.log('\nLaissés passer :');
  laisses.forEach((l) => console.log(`  · ${l}`));
  process.exit(1);
}
