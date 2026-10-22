# La progression par domaine

`/mes-domaines`. La même mémoire que partout ailleurs, rangée par **point de
cours** au lieu de l'être par fiche.

## Pourquoi une seconde vue

Une fiche est un contenant. « Exercices de nombres complexes » est un fichier,
pas un sujet : savoir qu'on en a fait 18 sur 40 ne dit pas si c'est le module
qu'on ne tient pas ou la forme exponentielle. Or ce qu'on révise, c'est un
sujet.

Ces sujets existent déjà dans le contenu, et ils n'ont demandé aucune
métadonnée nouvelle : ce sont les **rappels de cours** que les questions visent
(`::exo-question{cours="cours-module"}`). Le relevé du build les porte question
par question, avec le chapitre déduit de la `source` de l'extrait — exactement
la même déduction que celle du quiz, et pour la même raison : un QCM mélange les
chapitres exprès, donc le dossier d'une question ne dit pas de quoi elle parle.

Aujourd'hui : **675 questions**, **133 domaines** répartis sur neuf chapitres de
trois matières. Cent trente-deux d'entre eux sont des points de cours nommés ; le
dernier est le tas
« Sans renvoi au cours » — **48 questions** qui ne pointent vers aucun extrait,
regroupées par chapitre pour que la somme des domaines tombe sur le total du
chapitre. Sans ce tas, la barre du haut ne collerait plus à celles du bas. Il
ferme toujours la marche : ce n'est pas un sujet, c'est un reste.

Ces 48 questions viennent aujourd'hui d'une seule page — le cours de
trigonométrie, dont les questions sont posées dans le fil du cours et ne
renvoient donc à rien. Leur donner un `cours=` les rangerait dans un point
précis, et le tas fondrait d'autant.

## Ce que la barre montre

Deux segments, une piste. Ils répondent à trois questions différentes d'un coup :

| | |
|---|---|
| **Vert** | trouvée, jamais ratée |
| **Ambre** | trouvée, mais après au moins une faute |
| **Piste nue** | jamais trouvée |

Une question retrouvée après une faute reste **acquise** : elle ne perd pas le
terrain gagné, elle dit seulement qu'il a coûté quelque chose. C'est tout
l'écart qu'on sache mesurer entre « su » et « retrouvé », et c'est ce qui
distingue cette page du tableau de bord, où un point est un point.

Le composant est `UProgressGroup` : une seule piste, plusieurs segments. C'est
la seule chose que `UProgress` ne sait pas faire, et c'est précisément ce dont
la page a besoin.

Dans un chapitre, **le moins acquis passe en premier** : la page répond à « où
est-ce que ça coince », et l'ordre du cours ne répond pas à cette question-là. À
part égale, le domaine le plus fourni passe devant — c'est celui qui pèse le
plus. Les chapitres, eux, gardent l'ordre du cours.

## Matière par matière

La page range matière, chapitre, domaine — la hiérarchie du site. Chaque matière
porte sa propre barre et son bouton « m'interroger sur la matière » : deux cours
ne partagent pas un pourcentage, qui ne dirait rien de l'un ni de l'autre. La
barre du haut reste, pour la vue d'ensemble, et la somme des matières tombe sur
elle comme la somme des chapitres tombe sur leur matière.

## D'où viennent les chiffres

`GET /api/progression/domaines`, une requête, quatre lectures qui ne dépendent
pas les unes des autres :

- **`reussite`** dit ce qui est acquis. C'est la même mémoire que les fiches et
  que le report du quiz : une question trouvée est une question trouvée, quel
  que soit l'écran où elle l'a été.
- **`quiz_reponse`** (les `juste = 0`), **`qcm_tentative.ratees`** et
  **`qcm_compose_copie.ratees`** disent ce qui a coûté une faute. Le quiz et les
  QCM composés rangent l'identité entière, un QCM de contenu ne retient que les
  repères de ses questions ratées — d'où la recomposition côté serveur.

Le croisement a lieu **au serveur**, comme le reste. La table de correspondance
question → point de cours est le relevé du build ; l'envoyer au navigateur pour
qu'il fasse la jointure lui-même coûterait mille fois la réponse, qui tient en
quelques kilo-octets.

### Ce que le compte des hésitantes ne voit pas

Une question ratée sur une fiche puis reprise dans la foulée ne laisse **aucune
trace** : la progression d'une fiche s'écrit par instantané de ce qui est
trouvé, pas par historique. Le compte des hésitantes est donc un plancher, pas
un total. C'est assumé — tenir un journal des fautes sur les fiches
demanderait une table de plus pour une information qu'on lit déjà là où elle
compte, au quiz.

## Le relevé a dû s'élargir

Il ne portait que les questions à choix, celles que le quiz sait poser. Une
vue qui range **toute** la progression ne pouvait pas s'en contenter : les 41
questions ouvertes se cochent comme les autres, et les laisser dehors aurait
fait afficher « 12 / 13 » sur un domaine qui en compte 15.

Le relevé porte donc les 675 questions, et un champ `interrogeable` dit
lesquelles le quiz peut poser. Un seul relevé plutôt que deux côte à côte, qui
se seraient contredits le jour où l'un aurait changé. Le catalogue du quiz, lui,
ne compte toujours que les interrogeables : annoncer « 18 questions » sur une
notion dont le quiz ne sait en poser que 12 ferait une séance qui s'arrête plus
tôt que promis.

## De la page au quiz

Chaque domaine porte un bouton qui ouvre `/quiz?notion=<chemin-du-chapitre#identifiant>`,
chaque chapitre `/quiz?theme=<chemin-du-chapitre>`, et chaque matière
`/quiz?matiere=<chemin-de-la-matière>`. La page de quiz relit ces clés, en
déduit la matière à ouvrir,
les **confronte au catalogue**, et n'en retient que ce qu'il connaît : un lien
mis en favori survit ainsi à un cours renommé — il ouvre le quiz sur tout, au
lieu de préparer une séance vide.

Le bouton ne s'affiche pas quand le domaine n'a aucune question interrogeable :
proposer une séance que le quiz ne peut pas servir serait mentir.

## Vérifier

La page ne se vérifie pas au `curl` : comme le reste du site, elle ne lit la
progression qu'au montage — le HTML servi est le même pour tout le monde.

Le contrôle qui compte est que **les comptes se réconcilient** : la somme des
domaines d'un chapitre vaut le total du chapitre, celle des chapitres le total de
leur matière, et celle des matières 675. Serveur en marche et compte connecté :

```bash
curl -s --cookie "$COOKIE" localhost:3000/api/progression/domaines | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
let s=0, n=0;
for (const m of d.matieres) {
  const chapitres=m.chapitres.reduce((k,c)=>k+c.questions,0);
  if (chapitres!==m.questions) console.log('ÉCART', m.cle, chapitres, '!=', m.questions);
  for (const c of m.chapitres) {
    const somme=c.domaines.reduce((k,x)=>k+x.questions,0);
    if (somme!==c.questions) console.log('ÉCART', c.cle, somme, '!=', c.questions);
    n+=c.domaines.length;
  }
  s+=m.questions;
}
console.log(s, '==', d.total.questions, '|', n, 'domaines');
"
```

Attendu aujourd'hui : `675 == 675 | 133 domaines`.
