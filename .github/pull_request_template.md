<!--
Import d'un cours : remplir chaque section. Une PR de code : garder « Code hors
de content/ » et décrire le pourquoi en prose. Voir CONTRIBUTING.md.
-->

## Code hors de `content/`

<!-- « Aucun. » ou la liste des fichiers touchés (composant, script…) et pourquoi
aucun composant existant ne convenait. Une fusion déploie en production. -->

Aucun.

## Ce que la PR apporte

- Matière : <!-- nom, et `content/cours/<annee>/<matiere>/` ; nouvelle ou existante -->
- Chapitre(s) : <!-- `N.slug/` -->
- Documents reçus : <!-- cours.pdf, td.pdf, corrigé… et ce qui manquait -->

| Fiche | `type` | Sections | Questions | Dont au quiz |
|---|---|---|---|---|
| `…/cours` | cours | | | |

Ajouté au cours du prof : <!-- entraînement, révisions, QCM… ou « rien » -->

**Ajout au total du site :** +N questions, dont +M au quiz.
<!-- Contributeur : ne pas modifier les totaux de CLAUDE.md, docs/contenu.md ni
BANQUE ; la propriétaire les recalcule à la fusion. -->

## Vérifié au calcul

N questions à choix vérifiées sur M.
Non vérifiables au calcul (raisonnement, lecture de figure) : <!-- liste -->

Écarts avec le corrigé du professeur : <!-- « aucun » ou la liste, et ce qui a été tranché -->

## Contrôles

- [ ] `pnpm verif:contenu /cours/<annee>/<matiere> --rendu` : **Aucune erreur**
- [ ] `pnpm lint && pnpm typecheck && pnpm build`
- [ ] Fiches ouvertes dans le navigateur : formules, Indice / Solution / Cours, une question corrigée
- [ ] Aucun titre de bloc ni label déjà publié renommé
- [ ] Aucun PDF du prof dans les commits

<details><summary>Sortie de <code>verifier-contenu</code></summary>

```
```

</details>
