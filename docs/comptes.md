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

## Lire sans compte, répondre avec

Les fiches se lisent sans session : leur HTML est le même pour tous, et c'est
ce qui le rend cacheable. **Répondre** en demande une, parce qu'une réponse sans
compte n'irait nulle part. La demande vient au moment du geste — cliquer une
proposition, « Vérifier » une table ou une commande, « Corriger » un QCM, se
noter après la solution — et non à l'arrivée sur la page.

La connexion s'ouvre alors en fenêtre par-dessus la fiche (`useConnexion`),
et le geste interrompu est rejoué une fois connecté : on ne perd ni l'endroit
où l'on était, ni le clic. Les lectures faites au montage, qui avaient échoué
en 401, se refont d'elles-mêmes (`quandConnecte`) ; tant que celle de la fiche
n'a pas abouti, la garde de `provideProgression` retient l'écriture, comme
toujours.

La page `/connexion` reste pour ce qu'aucune fenêtre ne couvre : arriver par
une adresse réservée sans session, quand il n'y a pas de page en dessous.

## L'administration

`NUXT_ADMINISTRATEURS` nomme les comptes qui administrent, par pseudo, séparés
par des virgules. Le pseudo est replié comme à l'unicité, et relu **en base**
depuis l'identifiant de session à chaque requête : retirer quelqu'un de la
liste vaut dès la requête suivante, sans attendre l'expiration de sa session.
Vide, personne n'administre.

Les routes `/api/admin/*` sont les seules à lire au delà du compte connecté ;
leur première ligne est `exigerAdministrateur(event)`, qui répond 401 sans
session et 403 hors de la liste. Le drapeau `admin` que voit le navigateur est
posé à chaque lecture de la session (`server/plugins/session-administration.ts`)
et ne fait qu'afficher l'entrée de menu.

L'administration voit des **comptes** — questions trouvées par matière, fautes
en dette, séances de quiz, copies, contrôles, to-do, dernière activité — et
jamais le détail des réponses de personne.

Un piège à connaître : le rôle suit un pseudo. Un pseudo listé qui n'a pas
encore de compte peut être pris par le premier venu muni du code
d'inscription. Ne lister qu'un pseudo déjà créé.

## Vérifier

```bash
pnpm dev
node scripts/verifier-comptes.mjs   # inscription, connexion, isolation
node scripts/verifier-api.mjs       # progression, QCM, to-do, export
```

Les deux demandent une base vierge et `NUXT_CODE_INSCRIPTION=code-de-classe`.
