# Comptes et données

## Plusieurs comptes, un pseudo et un mot de passe

Chaque personne a son compte, et ne voit que sa propre progression. Le mot de
passe n'est jamais stocké : la base ne garde qu'une empreinte **scrypt** au
format PHC, qui transporte son propre sel et ses propres paramètres — les
durcir plus tard n'invalidera donc pas les comptes existants. Le hachage vient
de `nuxt-auth-utils`, donc sans dépendance supplémentaire.

Le pseudo est unique à la casse et aux accents près : « Chloé », « chloe » et
« CHLOE » désignent le même compte. Deux comptes qu'on ne distingue pas à l'œil
finissent par ressembler à un vol de compte.

## Les inscriptions passent par un code

`NUXT_CODE_INSCRIPTION` est exigé pour créer un compte. **Vide, les inscriptions
sont fermées** — c'est le défaut : le site n'est lié depuis nulle part mais vit
sur un domaine public, et une inscription libre invite les robots.

Changer le code coupe les inscriptions en cours sans toucher aux comptes déjà
créés.

## Ce que le serveur refuse de dire

Une connexion ratée répond toujours « Pseudo ou mot de passe incorrect », sans
distinguer les deux cas : dire « ce pseudo n'existe pas » donnerait la liste des
comptes à qui voudrait la constituer.

Le temps de réponse ne le dit pas non plus. Quand le pseudo est inconnu, le
serveur vérifie quand même le mot de passe contre une empreinte factice — un
scrypt valide dont personne ne connaît l'antécédent — pour que les deux chemins
coûtent la même chose. Mesuré : 31 ms sur un compte existant, 33 ms sur un
compte inexistant, une fois le serveur chaud.

Au-delà de huit tentatives par minute et par IP, la connexion répond 429. La
limite se compte sur l'IP de la connexion TCP, sauf derrière Caddy où
`X-Forwarded-For` est réécrit et donc digne de foi. Exposé en direct, cet
en-tête est contrôlé par le client : s'y fier laisserait contourner la limite en
changeant de valeur à chaque essai.

## L'isolation des données

Les quatre tables portent un `utilisateur_id`, et **aucune requête de données ne
s'écrit sans lui**. L'identifiant vient de la session scellée, jamais du corps de
la requête : sans quoi il suffirait d'écrire celui d'un autre pour lire sa
progression.

Deux conséquences moins évidentes, toutes deux vérifiées par
`scripts/verifier-comptes.mjs` :

- l'instantané de progression, qui élague les questions absentes, n'élague que
  dans le compte de son auteur ;
- un identifiant d'item de to-do deviné ne donne rien : l'appartenance est
  vérifiée en même temps que l'existence, et la réponse est un 404.

Une session scellée est autonome : elle reste valide après la disparition du
compte auquel elle renvoie, et une session émise par une version antérieure du
site n'a pas les mêmes champs. Les deux cas sont traités au même endroit — la
session est vidée et la réponse est un 401 qui invite à se reconnecter, plutôt
qu'une violation de clé étrangère ou une 500.

## Vérifier

```bash
pnpm dev
node scripts/verifier-comptes.mjs   # inscription, connexion, isolation
node scripts/verifier-api.mjs       # progression, QCM, to-do, export
```

Les deux demandent une base vierge et `NUXT_CODE_INSCRIPTION=code-de-classe`.
