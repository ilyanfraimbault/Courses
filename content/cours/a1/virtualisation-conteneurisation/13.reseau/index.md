---
title: Conteneurs et réseaux
description: Le pare-feu, le réseau de l'hôte, le réseau bridge par défaut, les réseaux isolés, le DNS intégré, et un blog WordPress monté à la main.
annee: A1
matiere: Virtualisation et conteneurisation
ordre: 13
icone: i-lucide-network
---

Comment Docker relie ses conteneurs : le pare-feu du noyau, le réseau `bridge` utilisé par défaut, le réseau de l'hôte, puis des réseaux **personnalisés** qui isolent un groupe de conteneurs et leur donnent un **DNS** — de quoi monter un blog WordPress avec un serveur web et une base MariaDB que personne d'autre ne voit.

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/reseau/atelier" titre="L'atelier" description="docker network, --network, -e, le DNS des réseaux personnalisés, et les deux challenges : une image PHP avec mysqli, un Drupal sur PostgreSQL" type="cours"}
::
