/**
 * Le correcteur de commandes, éprouvé sur des cas écrits à la main.
 *
 * Une commande juste refusée apprend le faux — que l'ordre des options
 * compterait, ou que `docker container ls` ne vaudrait pas `docker ps`. Une
 * commande fausse acceptée, pire encore. Chaque cas ci-dessous est l'un ou
 * l'autre, et la plupart viennent du cours lui-même.
 *
 *   node scripts/verifier-commandes.mjs
 *
 * Pas de serveur, pas de base : Node lit le TypeScript du correcteur tel quel.
 */
import { corrigerCommande } from '../shared/utils/commandes.ts'

let echecs = 0
let total = 0

function cas(attendues, saisie, juste, mode = 'shell', remarque = null) {
  total += 1
  const liste = Array.isArray(attendues) ? attendues : [attendues]
  const v = corrigerCommande(saisie, liste, mode)
  const ok = v.juste === juste && (!remarque || v.remarques.some(r => r.includes(remarque)))
  if (!ok) {
    echecs += 1
    console.log(`✗ ${JSON.stringify(saisie)} contre ${JSON.stringify(liste)} : attendu ${juste ? 'juste' : 'faux'}${remarque ? ` (« ${remarque} »)` : ''}, obtenu ${v.juste ? 'juste' : 'faux'} — ${v.remarques.join(' | ')}`)
  }
}

// L'ordre et le groupement des options ne comptent pas.
cas('docker run -dit alpine', 'docker run -dit alpine', true)
cas('docker run -dit alpine', 'docker run -it -d alpine', true)
cas('docker run -dit alpine', 'docker run -i -t -d alpine', true)
cas('docker run -dit alpine', 'docker run --detach --interactive --tty alpine', true)
cas('docker run -dit alpine', 'docker container run -tid alpine:latest', true)
cas('docker run -dit alpine', '$ docker run -dit docker.io/library/alpine', true)
cas('docker run -dit alpine', 'sudo docker run -dit alpine', true)
cas('docker run -dit alpine', '  docker   run  -dit   alpine  ', true)
cas('docker run -dit alpine', 'docker run -it alpine', false, 'shell', 'Il manque une option')
cas('docker run -dit alpine', 'docker run -dit debian', false, 'shell', 'image')
cas('docker run -dit alpine', 'docker run alpine -dit', false, 'shell', 'avant')
cas('docker run -dit alpine', 'docker start -dit alpine', false, 'shell', 'sous-commande')
cas('docker run -dit alpine', 'run -dit alpine', false, 'shell', 'docker')
cas('docker run -dit alpine', '', false)

// Les valeurs : --name=web vaut --name web, -p sans /tcp, l'image au tag implicite.
cas('docker run -dit --name web debian', 'docker run --name=web -dit debian', true)
cas('docker run -dit --name web debian', 'docker run -dit --name serveur debian', false, 'shell', '« --name »')
cas('docker run --name mon_nginx -d -p 8080:80 nginx', 'docker run -d -p 8080:80 --name mon_nginx nginx:latest', true)
cas('docker run --name mon_nginx -d -p 8080:80 nginx', 'docker run -d --publish 8080:80/tcp --name mon_nginx nginx', true)
cas('docker run --name mon_nginx -d -p 8080:80 nginx', 'docker run -d -p 80:8080 --name mon_nginx nginx', false, 'shell', '« -p »')
cas('docker run -dit --restart always --name c4 debian', 'docker run --restart=always -dit --name c4 debian', true)

// --mount : clés synonymes, dans n'importe quel ordre, type volume par défaut.
cas('docker run -d --name avecvolume --mount source=mesdata1,destination=/root/volume nginx',
  'docker run -d --name avecvolume --mount src=mesdata1,dst=/root/volume nginx', true)
cas('docker run -d --name avecvolume --mount source=mesdata1,destination=/root/volume nginx',
  'docker run -d --name avecvolume --mount type=volume,target=/root/volume,source=mesdata1 nginx', true)
cas('docker run -d --name l --mount src=nv,dst=/usr/share/nginx/html,ro nginx',
  'docker run -d --name l --mount src=nv,dst=/usr/share/nginx/html,readonly nginx', true)
cas('docker run -d --name l --mount src=nv,dst=/usr/share/nginx/html,ro nginx',
  'docker run -d --name l --mount src=nv,dst=/usr/share/nginx/html nginx', false, 'shell', '« --mount »')
cas('docker run -dit --name e --mount type=tmpfs,tmpfs-size=256M,dst=/root/volume nginx',
  'docker run -dit --name e --mount type=tmpfs,dst=/root/volume,tmpfs-size=256M nginx', true)

// -v : ~ et $HOME, $(pwd) et $PWD.
cas('docker run -d -p 8080:80 -v ~/pagesweb:/usr/share/nginx/html:ro nginx',
  'docker run -d -p 8080:80 -v $HOME/pagesweb:/usr/share/nginx/html:ro nginx', true)
cas('docker run -d -v $PWD/pagesweb:/usr/share/nginx/html:ro nginx',
  'docker run -d -v "$(pwd)/pagesweb:/usr/share/nginx/html:ro" nginx', true)

// -e : un ensemble de paires.
cas('docker run -dit --name database --network blog -e MYSQL_ROOT_PASSWORD=password123 -e MYSQL_DATABASE=wordpress --mount src=blog_db_data,dst=/var/lib/mysql mariadb',
  'docker run -dit --network=blog --name database --mount source=blog_db_data,target=/var/lib/mysql -e MYSQL_DATABASE=wordpress --env MYSQL_ROOT_PASSWORD=password123 mariadb', true)
cas('docker run -dit --name database -e MYSQL_ROOT_PASSWORD=password123 mariadb',
  'docker run -dit --name database -e MYSQL_ROOT_PASSWORD=autre mariadb', false, 'shell', '« -e »')

// Ce qui suit l'image appartient au conteneur ; bash et /bin/bash se valent.
cas('docker run -it --name apache httpd /bin/bash', 'docker run -it --name apache httpd bash', true)
cas('docker run -it --name apache httpd /bin/bash', 'docker run -it --name apache httpd sh', false, 'shell', 'commande passée')
cas('docker exec -it shelltest /bin/bash', 'docker exec -ti shelltest bash', true)
cas('docker exec -it shelltest /bin/bash', 'docker container exec --interactive --tty shelltest /bin/bash', true)
cas('docker exec -it shelltest /bin/bash', 'docker exec shelltest bash', false, 'shell', 'Il manque 2 options')
cas('docker exec -d execution touch /root/coucou.txt', 'docker exec -d execution touch /root/coucou.txt', true)
cas('docker exec -it execution ls /root', 'docker exec -it execution ls /tmp', false)

// Les synonymes de sous-commandes.
cas('docker ps -a', 'docker container ls -a', true)
cas('docker ps -a', 'docker ps --all', true)
cas('docker ps -a', 'docker ps', false, 'shell', 'Il manque une option')
cas('docker ps', 'docker ps -a', false, 'shell', 'En trop : « -a »')
cas('docker images', 'docker image ls', true)
cas('docker images', 'docker image list', true)
cas('docker rmi nginx:monblog_prod', 'docker image rm nginx:monblog_prod', true)
cas('docker rmi -f debian:latest', 'docker rmi --force debian', true)
cas('docker rmi ubuntu:jammy', 'docker rmi ubuntu', false, 'shell', 'image')
cas('docker volume ls', 'docker volume list', true)

// Plusieurs cibles : un ensemble.
cas('docker stop mariadb phpmyadmin wordpress', 'docker stop wordpress mariadb phpmyadmin', true)
cas('docker stop mariadb phpmyadmin wordpress', 'docker stop wordpress mariadb', false, 'shell', 'argument')
cas('docker volume rm mesdata1 nouveauvolume', 'docker volume rm nouveauvolume mesdata1', true)

// logs, -tf et -ft ; stop -t prend une valeur, run -t non.
cas('docker logs -tf 8b5c', 'docker logs -f -t 8b5c', true)
cas('docker logs -tf 8b5c', 'docker logs --follow --timestamps 8b5c', true)
cas('docker stop -t 5 web', 'docker stop --time 5 web', true)

// Les registres : docker.io/library est le défaut, registry.hub.docker.com non.
cas('docker pull ubuntu:jammy', 'docker pull docker.io/ubuntu:jammy', true)
cas('docker pull ubuntu:jammy', 'docker pull docker.io/library/ubuntu:jammy', true)
cas('docker pull ubuntu:jammy', 'docker pull registry.hub.docker.com/library/ubuntu:jammy', false)
cas('docker pull nginx', 'docker pull nginx:latest', true)
cas('docker pull mysql/mysql-server', 'docker pull mysql/mysql-server:latest', true)
cas('docker tag nginx:latest nginx:monblog_prod', 'docker tag nginx nginx:monblog_prod', true)
cas('docker tag nginx:latest nginx:monblog_prod', 'docker tag nginx:monblog_prod nginx', false)
cas('docker login -u kikinovak', 'docker login --username kikinovak', true)

// build : -t prend une valeur, le point est un argument.
cas('docker build -t mon_nginx .', 'docker build -t mon_nginx:latest .', true)
cas('docker build -t mon_nginx .', 'docker build --tag mon_nginx .', true)
cas('docker build -t mon_nginx .', 'docker build -t mon_nginx', false, 'shell', 'argument')
cas('docker buildx build --no-cache --platform linux/amd64,linux/arm64/v8 -t kikinovak/cmatrix . --push',
  'docker buildx build --push --platform linux/arm64,linux/amd64 --no-cache -t kikinovak/cmatrix .', true)
cas('docker buildx build --no-cache --platform linux/amd64,linux/arm64/v8 -t kikinovak/cmatrix . --push',
  'docker build --no-cache --platform linux/amd64,linux/arm64/v8 -t kikinovak/cmatrix . --push', false, 'shell', 'sous-commande')

// Les tubes et les commandes enchaînées.
cas('docker inspect conteneur_quatre | grep -A 3 RestartPolicy', 'docker inspect conteneur_quatre | grep -A 3 RestartPolicy', true)
cas('docker inspect conteneur_quatre | grep -A 3 RestartPolicy', 'docker inspect conteneur_quatre', false, 'shell', '« | »')
cas('docker stop web\ndocker rm web', 'docker stop web && docker rm web', true)
cas('docker stop web\ndocker rm web', 'docker stop web; docker rm web', true)
cas('docker stop web\ndocker rm web', 'docker rm web\ndocker stop web', false)
cas('docker stop web\ndocker rm web', 'docker rm -f web', false, 'shell', '2 commandes')
cas('docker run --name x -d -p 8080:80 \\\n  -v ~/a:/b:ro nginx', 'docker run --name x -d -p 8080:80 -v ~/a:/b:ro nginx', true)

// compose, et l'ancienne commande à trait d'union.
cas('docker compose up -d', 'docker-compose up -d', true)
cas('docker compose up -d', 'docker compose up --detach', true)
cas('docker compose down --volumes', 'docker compose down -v', true)
cas('docker compose down --volumes', 'docker compose down', false, 'shell', 'Il manque une option')
cas('docker compose -f autre.yaml up -d', 'docker compose --file autre.yaml up -d', true)

// Hors de Docker : les mots, tels quels.
cas('cat /etc/os-release', 'cat /etc/os-release', true)
cas('cat /etc/os-release', 'cat /etc/hostname', false)
cas('apk add git', '# apk add git', true)
cas('echo "<h1>Mon serveur Nginx</h1>" > ~/Test/index.html', 'echo \'<h1>Mon serveur Nginx</h1>\' > ~/Test/index.html', true)
cas('docker run -dit alpine', 'docker run -dit "alpine', false, 'shell', 'guillemet')

// Le Dockerfile.
cas('WORKDIR /cmatrix', 'workdir /cmatrix', true, 'dockerfile')
cas('CMD ["nginx", "-g", "daemon off;"]', 'CMD ["nginx","-g","daemon off;"]', true, 'dockerfile')
cas('CMD ["./cmatrix"]', 'CMD ./cmatrix', false, 'dockerfile', 'tableau JSON')
cas('CMD ["./cmatrix"]', 'CMD [\'./cmatrix\']', false, 'dockerfile', 'JSON')
cas('ENTRYPOINT ["./cmatrix"]\nCMD ["-b"]', 'ENTRYPOINT ["./cmatrix"]\nCMD ["-b"]', true, 'dockerfile')
cas('ENTRYPOINT ["./cmatrix"]\nCMD ["-b"]', 'CMD ["-b"]\nENTRYPOINT ["./cmatrix"]', false, 'dockerfile', 'Instruction 1')
cas('FROM alpine AS cmatrixbuilder', 'FROM alpine:latest as cmatrixbuilder', true, 'dockerfile')
cas('COPY --from=cmatrixbuilder /cmatrix/cmatrix /cmatrix', 'COPY --from cmatrixbuilder /cmatrix/cmatrix /cmatrix', true, 'dockerfile')
cas('RUN apt-get update && apt-get install -y iputils-ping && apt-get clean',
  'RUN apt-get update \\\n    && apt-get install -y iputils-ping \\\n    && apt-get clean', true, 'dockerfile')
cas('RUN apt-get update && apt-get install -y iputils-ping && apt-get clean',
  'RUN apt-get update\nRUN apt-get install -y iputils-ping\nRUN apt-get clean', false, 'dockerfile', 'Une seule instruction')
cas('LABEL org.opencontainers.image.authors="Nicolas Kovacs" org.opencontainers.image.description="Container image for CMatrix"',
  'LABEL org.opencontainers.image.description="Container image for CMatrix" \\\n      org.opencontainers.image.authors="Nicolas Kovacs"', true, 'dockerfile')
cas('ENV NGINX_VERSION=1.29.2', 'ENV NGINX_VERSION 1.29.2', true, 'dockerfile')
cas('EXPOSE 80', 'EXPOSE 80/tcp', true, 'dockerfile')
cas('USER thomas', 'USER root', false, 'dockerfile', 'arguments')

// Un morceau de compose.yaml.
const service = `phpmyadmin:
  image: phpmyadmin:latest
  environment:
    PMA_HOST: mariadb
  ports:
    - "8080:80"
  restart: always`
cas(service, service, true, 'yaml')
cas(service, `phpmyadmin:
  restart: always
  ports: ["8080:80"]
  image: 'phpmyadmin:latest'
  environment:
    - PMA_HOST=mariadb`, true, 'yaml')
cas(service, `phpmyadmin:
  image: phpmyadmin:latest
  environment:
    PMA_HOST: mariadb
  ports:
    - "80:8080"
  restart: always`, false, 'yaml', 'liste')
cas(service, `phpmyadmin:
  image: phpmyadmin:latest
  ports:
    - "8080:80"
  restart: always`, false, 'yaml', 'Il manque une clé')
cas(service, `phpmyadmin:
\timage: phpmyadmin:latest`, false, 'yaml', 'tabulations')
cas('s:\n  environment:\n    A: 1\n    B: 2', 's:\n  environment:\n    - B=2\n    - A=1', true, 'yaml')
cas('s:\n  image: mariadb:latest', 's:\n  image: mariadb', true, 'yaml')
cas('docker build -t mon_nginx .', 'docker build -t mon_nginx ./', true)
cas(`volumes:
  blog-db-volume:
  blog-wp-volume:`, `volumes:
  blog-wp-volume:
  blog-db-volume:`, true, 'yaml')

console.log(`${total - echecs} cas sur ${total} tiennent.`)
if (echecs) process.exit(1)
