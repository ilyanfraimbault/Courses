---
title: Virtualisation et conteneurisation
description: Docker par la pratique, atelier par atelier — des premières commandes jusqu'à Docker Compose, en tapant les commandes plutôt qu'en les cochant.
annee: A1
matiere: Virtualisation et conteneurisation
icone: i-simple-icons-docker
---

Le cours suit la formation **Docker par la pratique** de Microlinux, atelier après atelier, dans son ordre : chaque atelier est un chapitre. Les ateliers d'installation (préparer une VM, installer Docker sous Red Hat) n'y sont pas — on commence aux commandes de base.

::rappel{titre="Machine virtuelle ou conteneur" icone="i-lucide-boxes"}
Virtualisation et conteneurs poursuivent le même but : **isoler** des environnements pour faire coexister plusieurs systèmes sans qu'ils se gênent. Une **machine virtuelle** embarque un système d'exploitation entier ; un **conteneur** ne porte que le logiciel qu'il fait tourner — un serveur web, une base de données — sans l'embonpoint d'un système complet. D'où ses trois avantages :

- il se **déploie** et se **réplique** plus facilement qu'une machine virtuelle ;
- il demande nettement **moins de ressources** ;
- il s'adapte bien plus facilement à une **montée en charge**.

Docker n'est ni la seule technologie de conteneurisation ni la première, mais c'est aujourd'hui la plus utilisée.
::

::rappel{titre="Comment se servir de ces ateliers" icone="i-lucide-keyboard"}
Le jour du contrôle, on **écrit des commandes** : c'est donc ce qu'on fait ici. Sous la plupart des questions, un terminal attend ta commande — tape-la, puis **Entrée**. La correction accepte tout ce que Docker accepte : l'ordre des options (`-dit` ou `-it -d`), les formes longues (`--detach`), les synonymes (`docker container ls` pour `docker ps`), `alpine` pour `alpine:latest`. Si c'est faux, le terminal dit ce qui cloche — une option qui manque, une en trop, la mauvaise image — sans donner la réponse, et l'indice s'ouvre.

Pour un **Dockerfile** ou un **compose.yaml**, le terminal devient un éditeur : écris les lignes demandées, puis **Ctrl + Entrée**.

Quelques questions de compréhension se tranchent entre deux propositions ; le reste se tape.
::

## Les ateliers

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/commandes/atelier" titre="Les commandes de base" description="Lancer, lister, arrêter, relancer et inspecter un conteneur, lister les images, et trouver l'aide en ligne" type="cours" meta="31 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/images/atelier" titre="Gérer les images" description="Les couches d'une image, le téléchargement, les tags, la lecture d'un Dockerfile, la suppression des images et le ménage sur le disque" type="cours" meta="24 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/execution/atelier" titre="Exécuter un conteneur" description="Garder un conteneur en vie, le nommer, l'arrêter, le supprimer, le relancer automatiquement, forcer son arrêt, faire le ménage et lire ses logs" type="cours" meta="32 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/exposer/atelier" titre="Exposer un conteneur" description="Rendre une application qui tourne dans un conteneur accessible depuis l'hôte en publiant un port, et partager des données entre l'hôte et le conteneur" type="cours" meta="20 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/connecter/atelier" titre="Se connecter à un conteneur" description="Ouvrir un shell interactif dans un conteneur, au lancement avec docker run ou en cours d'exécution avec docker exec, y exécuter des commandes et lister ses processus" type="cours" meta="25 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/logs/atelier" titre="Gérer les logs" description="Lire les logs d'un conteneur, les suivre en direct et les horodater, puis retrouver ceux du moteur Docker lui-même" type="cours" meta="13 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/registres/atelier" titre="Utiliser les registres" description="Où vivent les images, comment se lit leur nom complet — registre, dépôt, image, tag — et comment s'authentifier auprès de Docker Hub" type="cours" meta="16 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/construire/atelier" titre="Construire une image" description="Écrire un Dockerfile, distinguer ENTRYPOINT et CMD, construire une image avec docker build et la publier sur Docker Hub avec docker push" type="cours" meta="25 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/cmatrix-compilation/atelier" titre="Compiler CMatrix" description="Prendre en main Alpine Linux, une distribution ultra-légère, et y compiler pas à pas le code source de l'économiseur d'écran CMatrix" type="cours" meta="25 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/cmatrix-multi-stage/atelier" titre="Conteneuriser CMatrix" description="Transformer l'historique de la compilation de CMatrix en un Dockerfile propre — WORKDIR, moins de couches, un multi-stage build, un utilisateur non privilégié, ENTRYPOINT et CMD" type="cours" meta="23 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/cmatrix-plateformes/atelier" titre="CMatrix multiplateforme" description="Construire et publier l'image de CMatrix pour plusieurs architectures à la fois avec docker buildx — Intel et AMD, Mac Silicon, S/390" type="cours" meta="11 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/volumes/atelier" titre="Gérer les volumes" description="Créer, lister, inspecter et supprimer des volumes, les monter avec --mount — en lecture seule, partagés, éphémères — ou avec l'ancienne option -v" type="cours" meta="33 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/reseau/atelier" titre="Conteneurs et réseaux" description="Le pare-feu, le réseau de l'hôte, le réseau bridge par défaut, les réseaux isolés, le DNS intégré, et un blog WordPress monté à la main" type="cours" meta="39 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/combiner/atelier" titre="Combiner les conteneurs" description="Un blog WordPress en trois conteneurs — MariaDB, PHPMyAdmin et WordPress — reliés par un réseau Docker, puis arrêtés, relancés et mis à jour" type="cours" meta="15 questions"}
::

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/compose/atelier" titre="Docker Compose" description="Décrire plusieurs conteneurs dans un fichier compose.yaml, les démarrer d'une commande, et tout arrêter et nettoyer d'une autre" type="cours" meta="23 questions"}
::

## Emporter mes résultats

::export-resultats
::
