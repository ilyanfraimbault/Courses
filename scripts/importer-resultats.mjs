/**
 * Verse un export de résultats dans la base, en développement local.
 *
 *   node scripts/importer-resultats.mjs resultats.json --pseudo ilyan [--simulation]
 *
 * En production, on passe par la zone de dépôt de la page « mes résultats » :
 * l'image d'exécution ne contient que `.output`, pas ce fichier.
 *
 * L'import est une fusion et il est rejouable : le relancer sur le même fichier
 * n'insère rien.
 */
import { readFileSync } from 'node:fs'
import { ouvrirBase } from '../server/utils/db.ts'
import { importerResultats } from '../server/utils/import-resultats.ts'
import { replierPseudo } from '../server/utils/comptes.ts'

const args = process.argv.slice(2)
const simulation = args.includes('--simulation')
const iPseudo = args.indexOf('--pseudo')
const pseudo = iPseudo >= 0 ? args[iPseudo + 1] : null
const fichier = args.filter((a, i) => !a.startsWith('--') && i !== iPseudo + 1)[0]

if (!fichier || !pseudo) {
  console.error('Usage : node scripts/importer-resultats.mjs <fichier.json> --pseudo <pseudo> [--simulation]')
  process.exit(1)
}

const base = process.env.NUXT_BASE_FICHIER ?? '.data/cours.sqlite'
const db = ouvrirBase(base)

// Les données appartiennent à quelqu'un : on refuse d'importer dans le vide
// plutôt que de créer un compte à la volée, qui n'aurait pas de mot de passe.
const compte = db
  .prepare('SELECT id, pseudo FROM utilisateur WHERE pseudo_replie = ?')
  .get(replierPseudo(pseudo))

if (!compte) {
  console.error(`Aucun compte « ${pseudo} ». Crée-le sur /inscription, puis relance.`)
  process.exit(1)
}

let rapport
try {
  rapport = importerResultats(db, compte.id, JSON.parse(readFileSync(fichier, 'utf8')), { simulation })
} catch (erreur) {
  console.error('Import refusé :', erreur.message)
  process.exit(1)
}

console.log(simulation ? '— simulation, rien n\'a été écrit —' : `base : ${base}`)
console.log(`compte      : ${compte.pseudo}`)
console.log(`fiches      : ${rapport.fiches.ecrites} écrites sur ${rapport.fiches.vues} vues`)
console.log(`questions   : ${rapport.questions.inserees} insérées, `
  + `${rapport.questions.dejaPresentes} déjà présentes, sur ${rapport.questions.vues} vues`
  + (rapport.questions.ignorees ? `, ${rapport.questions.ignorees} illisibles` : ''))
console.log(`tentatives  : ${rapport.tentatives.inserees} insérées, `
  + `${rapport.tentatives.dejaPresentes} déjà présentes, sur ${rapport.tentatives.vues} vues`)
console.log(`to-do       : ${rapport.todo.inserees} insérées, `
  + `${rapport.todo.dejaPresentes} déjà présentes, sur ${rapport.todo.vues} vues`)
for (const a of rapport.avertissements.slice(0, 20)) console.log('  ⚠', a)
if (rapport.avertissements.length > 20) {
  console.log(`  … et ${rapport.avertissements.length - 20} autres`)
}
