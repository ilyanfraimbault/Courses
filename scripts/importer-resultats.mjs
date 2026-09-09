/**
 * Verse un export de résultats dans la base, en développement local.
 *
 *   node scripts/importer-resultats.mjs resultats-2026-09-09.json [--simulation]
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

const args = process.argv.slice(2)
const simulation = args.includes('--simulation')
const fichier = args.find(a => !a.startsWith('--'))

if (!fichier) {
  console.error('Usage : node scripts/importer-resultats.mjs <fichier.json> [--simulation]')
  process.exit(1)
}

const base = process.env.NUXT_BASE_FICHIER ?? '.data/cours.sqlite'
const db = ouvrirBase(base)

let rapport
try {
  rapport = importerResultats(db, JSON.parse(readFileSync(fichier, 'utf8')), { simulation })
} catch (erreur) {
  console.error('Import refusé :', erreur.message)
  process.exit(1)
}

console.log(simulation ? '— simulation, rien n\'a été écrit —' : `base : ${base}`)
console.log(`fiches      : ${rapport.fiches.ecrites} écrites sur ${rapport.fiches.vues} vues`)
console.log(`questions   : ${rapport.questions.inserees} insérées, `
  + `${rapport.questions.dejaPresentes} déjà présentes, sur ${rapport.questions.vues} vues`
  + (rapport.questions.ignorees ? `, ${rapport.questions.ignorees} illisibles` : ''))
console.log(`tentatives  : ${rapport.tentatives.inserees} insérées, `
  + `${rapport.tentatives.dejaPresentes} déjà présentes, sur ${rapport.tentatives.vues} vues`)
for (const a of rapport.avertissements.slice(0, 20)) console.log('  ⚠', a)
if (rapport.avertissements.length > 20) {
  console.log(`  … et ${rapport.avertissements.length - 20} autres`)
}
