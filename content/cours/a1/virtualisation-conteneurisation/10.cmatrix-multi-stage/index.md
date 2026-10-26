---
title: Conteneuriser CMatrix
description: Transformer l'historique de la compilation de CMatrix en un Dockerfile propre — WORKDIR, moins de couches, un multi-stage build, un utilisateur non privilégié, ENTRYPOINT et CMD.
annee: A1
matiere: Virtualisation et conteneurisation
ordre: 10
icone: i-lucide-package-check
---

La suite de l'atelier précédent : l'historique du shell devient un `Dockerfile`, d'abord pataud, puis élagué pas à pas jusqu'à une image de quelques mégaoctets — construite en plusieurs étapes, lancée par un utilisateur sans privilèges, et qui accepte les options de CMatrix.

::carte-lien{to="/cours/a1/virtualisation-conteneurisation/cmatrix-multi-stage/atelier" titre="L'atelier" description="Le Dockerfile de CMatrix, instruction après instruction, à écrire soi-même — jusqu'au multi-stage build et aux options de CMatrix" type="cours"}
::
