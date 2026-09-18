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
  ['le déclencheur n’a plus de filet', 'apps-script/Menu.gs',
    'const resultat = limiteurSousFilet_(ligne);',
    'const resultat = { fait: true, valeur: limiteurTraiterLaSoumission_(ligne) };'],
  ['sans destinataire réglé, l’échec ne prévient plus personne',
    'apps-script/Synchronisation.gs',
    'return SocleErreurs.absorber(\'lecture de l’utilisateur effectif\','
      + '\n    () => Session.getEffectiveUser().getEmail(), \'\');',
    'return \'\';'],
  ['l’échec consigné ne dit plus quoi faire', 'apps-script/Synchronisation.gs',
    "    'Ce qui a échoué': `${quoi} ${quoiFaire}`,",
    "    'Ce qui a échoué': quoi,"],
  ['un verrou occupé est traité comme un échec', 'apps-script/Synchronisation.gs',
    'if (!sous.pris) return { fait: false, occupe: true, message: sous.message };',
    'if (!sous.pris) throw new Error(sous.message);'],
  ['un contrôle qui n’a pas pu s’exécuter est annoncé bon',
    'apps-script/Verification.gs',
    'const tu = (nom, raison) => dire(nom, LIMITEUR_CONTROLES_.nonMesure, \'\', raison);',
    'const tu = (nom, raison) => dire(nom, LIMITEUR_CONTROLES_.bon, \'\', raison);'],
  ['une marge égale à la capacité n’est plus détectée',
    'apps-script/Verification.gs',
    '(un) => un.places !== null && un.marge >= un.places);',
    '(un) => un.places !== null && un.marge > un.places);'],
  ['le tri de la feuille des réponses n’est plus détecté',
    'apps-script/Verification.gs',
    'const fautes = horodatages.filter((un, rang) => rang > 0 && un < horodatages[rang - 1]);',
    'const fautes = [];'],
  ['un référentiel vide est annoncé bon', 'apps-script/Verification.gs',
    'const capacitesFaites = referentiel.creneaux.length > 0 && sans.length === 0;',
    'const capacitesFaites = sans.length === 0;'],
  ['une inscription au créneau inconnu disparaît des listes',
    'apps-script/Listes.gs',
    'orphelines.forEach((ligne) => {',
    'const jamais = () => orphelines.forEach((ligne) => {'],
  ['un créneau sans inscription disparaît des listes', 'apps-script/Listes.gs',
    'lignes.push([creneau.libelle, \'\', LIMITEUR_STATUTS_.aucune, \'\','
      + '\n        ...reprises.map(() => \'\'), \'\']);',
    ''],
  ['une capacité non définie est annoncée « Retenue »', 'apps-script/Listes.gs',
    'if (creneau.places === null) return LIMITEUR_STATUTS_.sansCapacite;',
    'if (false) return LIMITEUR_STATUTS_.sansCapacite;'],
  ['les listes ouvrent le formulaire alors que le réglage suffisait',
    'apps-script/Listes.gs',
    "  if (duReglage !== '') return duReglage;",
    '  if (false) return duReglage;'],
  ['une constante globale nomme une constante déclarée plus loin',
    'apps-script/Apparence.gs',
    'const LIMITEUR_TEINTES_ = {',
    'const LIMITEUR_ORDRE_CASSE_ = LIMITEUR_ONGLET_LISTES_;\n\n'
      + 'const LIMITEUR_TEINTES_ = {'],
  ['un onglet réécrit n’est plus rhabillé', 'apps-script/Listes.gs',
    '  limiteurHabiller_(LIMITEUR_ONGLET_LISTES_);',
    ''],
  ['l’habillage écrase les règles des autres colonnes',
    'apps-script/Apparence.gs',
    '.some((une) => une.getColumn() === position));',
    '.some(() => true));'],
  ['« Complet » est peint comme une anomalie', 'apps-script/Apparence.gs',
    "      Complet: 'fini',",
    "      Complet: 'aTraiter',"],
  ['le contrôle en conditions réelles cite un nom mort',
    'outils/Controle.gs',
    'const feuille = limiteurFeuilleDesReponses_();',
    'const feuille = limiteurFeuilleDesReponsesDuFormulaire_();'],
  ['une exception est prise pour un démenti', 'outils/Controle.gs',
    "      etat: 'NON MESURÉ',",
    "      etat: 'DÉMENTI',"],
  ['le nombre d’assertions annoncé n’est plus celui du banc', 'README.md',
    '190 assertions, hors de Google', '74 assertions, hors de Google'],
  ['le README anglais annonce un autre nombre de défauts que le français',
    'README.md',
    '**thirty-five deliberate defects**', '**thirteen deliberate defects**'],
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
