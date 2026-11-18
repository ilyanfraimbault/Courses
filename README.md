# Cours

Cahier de révisions : fiches de cours, exercices corrigés et QCM, un mode quiz
qui pioche dans toutes leurs questions, avec suivi de progression, to-do et
tableau de bord.

```bash
cp .env.example .env   # et remplir NUXT_CODE_INSCRIPTION / NUXT_SESSION_PASSWORD
pnpm install
pnpm dev
```

## Contribuer

Tu as les documents d'un cours qui manque ? Envoie les PDF à Claude Code dans
le dépôt avec « ajoute ce cours », réponds à ses questions : il ouvre la PR. Tout est
dans **[CONTRIBUTING.md](CONTRIBUTING.md)**. Seule la propriétaire du dépôt
fusionne.

## Documentation

**[.claude/CLAUDE.md](.claude/CLAUDE.md)** — le projet, ses invariants, la façon
d'y travailler. À lire en premier pour reprendre le travail.

- [.claude/pieges.md](.claude/pieges.md) — les pièges rencontrés, et ce qui les
  a démasqués. Presque aucun ne lève d'erreur.
- [.claude/etat.md](.claude/etat.md) — où en est le projet, ce qui reste, la
  dette, et les choix déjà tranchés.

Pour l'usage courant :

- [docs/contenu.md](docs/contenu.md) — la collection, le comptage des questions,
  l'import d'un ancien export, et pourquoi `remark-mdc` est épinglé.
- [docs/quiz.md](docs/quiz.md) — le mode quiz : d'où viennent ses 1379 questions,
  comment la file rejoue une place ratée, et ce qu'il n'écrit pas.
- [docs/comptes.md](docs/comptes.md) — comptes, mots de passe, isolation des
  données entre utilisateurs.
- [docs/deploiement.md](docs/deploiement.md) — conteneur, CI/CD, VPS, domaine,
  sauvegarde.
