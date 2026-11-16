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

## L'accès se demande, ou s'obtient par invitation

Créer un compte ne donne accès à rien. Un compte a un **accès** (`acces` en
base) parmi trois : `aucun` à la création, `demande` une fois la demande
envoyée, `accorde` quand l'administration l'a acceptée. Seul le dernier ouvre
les données : `idUtilisateur`, par où passe toute route de données, répond 403
aux deux autres — sans vider la session, dont le compte a besoin pour
demander. La seule route qui l'accepte sans accès est `POST /api/acces/demande`,
qui passe par `compteConnecte`.

L'accès est relu en base à chaque requête, comme le rôle d'administrateur :
l'accorder vaut à la requête suivante, sans reconnexion. Une page ouverte
pendant l'attente relit d'elle-même la fiche (`quandConnecte` suit l'accès, plus
la seule connexion), et un geste interrompu par la fenêtre de demande est
rejoué si l'accès vient pendant qu'elle est ouverte.

**Le code d'invitation** (`NUXT_CODE_INSCRIPTION`) court-circuite la demande :
un compte créé avec lui a accès d'emblée — le donner, c'est déjà accepter. Un
code faux est refusé plutôt que pris pour une demande, sans quoi on se croirait
inscrit. Vide, aucun code n'est bon et toute inscription passe par une demande.

**Refuser supprime le compte.** Il n'a jamais rien pu écrire, il n'y a rien à
perdre, et son pseudo redevient libre. La route de décision
(`POST /api/admin/acces`) ne touche qu'un compte sans accès : elle ne retire
l'accès à personne et ne supprime aucun compte qui a des données — la règle est
dans sa clause `WHERE`.

Le site vit sur un domaine public, et une inscription sans code invite les
robots. Ils n'obtiennent qu'un compte qui ne peut rien faire ; pour qu'ils ne
noient pas les vraies demandes, l'inscription sans code s'arrête à **50 comptes
sans accès** (503), en plus de la limite par IP.

La colonne `acces` vaut `aucun` par défaut, le sens sûr : une insertion qui
l'oublierait ne donnerait accès à rien. La migration a accordé l'accès aux
comptes qui existaient avant elle — ils avaient tous été créés avec le code.

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
d'invitation. Sans le code, il n'obtiendrait qu'un compte sans accès, et
`estAdministrateur` exige l'accès : il n'administrerait rien tant que
personne ne l'a accepté. Ne lister qu'un pseudo déjà créé quand même.

L'administration voit en tête de `/admin` les comptes sans accès, la demande
d'abord, avec le mot que l'élève y a laissé, et les accepte ou les refuse.

## Vérifier

```bash
pnpm dev
node scripts/verifier-comptes.mjs   # inscription, connexion, isolation, demandes d'accès
node scripts/verifier-api.mjs       # progression, QCM, to-do, export
```

Les deux demandent une base vierge et `NUXT_CODE_INSCRIPTION=code-de-classe`.
