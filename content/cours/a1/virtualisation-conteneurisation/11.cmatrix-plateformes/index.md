---
title: CMatrix multiplateforme
description: Construire et publier l'image de CMatrix pour plusieurs architectures à la fois avec docker buildx — Intel et AMD, Mac Silicon, S/390.
annee: A1
matiere: Virtualisation et conteneurisation
ordre: 11
icone: i-lucide-cpu
---

Une image construite sur un PC Intel ne tourne pas telle quelle sur un Mac Silicon ou un Raspberry Pi. `docker buildx` construit en une commande une image par architecture et les publie ensemble sur Docker Hub, sous un seul nom.

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/cmatrix-plateformes/atelier" titre="L'atelier" description="De docker build à docker buildx : préparer un constructeur, construire et publier pour plusieurs plateformes, puis faire le ménage" type="cours"}
::
