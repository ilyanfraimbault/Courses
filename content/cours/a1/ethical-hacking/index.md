---
title: Ethical hacking
description: "Le module d'ethical hacking : le premier cours, la reconnaissance, le DNS, le scanning et Nmap, et les rooms TryHackMe du TD, en fiches de cours et en QCM en anglais, comme l'examen."
annee: A1
matiere: Ethical hacking
icone: i-lucide-shield-half
programme: s5-ethical-hacking
---

Le module de Nicolas Vieux tient en trois volets : dix jeux de diapos, un TD sur **TryHackMe** et des TP sur **Vulnhub**. L'examen du **17 novembre** est un QCM d'environ soixante questions **en anglais** — une quinzaine de définitions et quarante-cinq questions à choix —, une seule réponse par question, **+1** pour une bonne réponse, **−1** pour une réponse fausse ou absente : on répond donc toujours. Il porte sur tout, mais surtout sur le premier cours.

Chaque cours devient ici un chapitre : une **fiche de cours** en français, qui garde les termes anglais en gras — à l'examen, une définition se donne en anglais ou en français —, avec un exemple traité et un contrôle express par section, puis un **QCM**. Les questions sont en **anglais**, comme le jour de l'examen ; les indices et les solutions, en français. Toutes ont une seule bonne réponse : toutes vont au **quiz**, et une séance peut se restreindre à un chapitre ou à une section.

Sous chaque question, les mêmes trois boutons : **Indice** et **Solution** se déplient sous la question, **Cours** ouvre le rappel visé dans un tiroir latéral.

Les cinq **labs Vulnhub** ont leur propre section de révision — l'essentiel de leurs gestes, sans le détail de chaque machine. Ce que le site ne couvre pas encore, et qu'il faut réviser sur les diapos et ses notes de TP : les cours 07 à 11 — RFI, LFI et traversée de répertoires, injection SQL et Burp Suite, reverse shell, élévation de privilèges, la boîte à outils —, et les autres rooms spécifiques.

## Introduction à la cybersécurité

::carte-lien{to="/cours/a1/ethical-hacking/introduction/cours" titre="Le cours" description="Seize sections, des fondamentaux à la détection, chacune avec un exemple traité et un contrôle express" type="cours" meta="43 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/introduction/qcm" titre="Le QCM" description="Quatre QCM de mises en situation et un QCM de définitions, en anglais comme à l'examen" type="qcm" meta="75 questions · 75 min"}
::

## Reconnaissance

::carte-lien{to="/cours/a1/ethical-hacking/reconnaissance/cours" titre="Le cours" description="Passive ou active, ce que l'on cherche, dorks et Shodan, sous-domaines, métadonnées et secrets, whois et traceroute, Maltego" type="cours" meta="14 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/reconnaissance/qcm" titre="Le QCM" description="Passive ou active, quel outil, quelle requête, que révèle telle trace — en anglais comme à l'examen" type="qcm" meta="16 questions · 20 min"}
::

## DNS et transferts de zone

::carte-lien{to="/cours/a1/ethical-hacking/dns-zone-transfer/cours" titre="Le cours" description="Résolution, DoH et DoT, types d'enregistrements, dig, SPF, DKIM et DMARC, AXFR, outils et protections" type="cours" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/dns-zone-transfer/qcm" titre="Le QCM" description="Qui a répondu, quel enregistrement, que lire dans dig ou dans DMARC, comment refermer un AXFR — en anglais" type="qcm" meta="16 questions · 20 min"}
::

## Scanning et énumération

::carte-lien{to="/cours/a1/ethical-hacking/scanning/cours" titre="Le cours" description="Méthode, découverte d'hôtes, états de ports, déroulé d'un scan, bannières et énumération, scanners de vulnérabilités" type="cours" meta="15 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/scanning/qcm" titre="Le QCM" description="Découverte d'hôtes, états de ports, bannières, énumération et scanners — en anglais comme à l'examen" type="qcm" meta="16 questions · 15 min"}
::

## Nmap

::carte-lien{to="/cours/a1/ethical-hacking/nmap/cours" titre="Le cours" description="Cibles, ports et sorties, types de scans, versions et timing, NSE, déroulé en quatre phases, évasion" type="cours" meta="20 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/nmap/qcm" titre="Le QCM" description="Deux blocs : cibles, ports et types de scans ; versions, scripts, timing, sorties et évasion — en anglais" type="qcm" meta="32 questions · 40 min"}
::

## TryHackMe — les rooms d'introduction

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/what-is-networking" titre="I-01 — What is Networking?" description="Réseau, naissance d'Internet et du Web, adresses IP et MAC, usurpation de MAC, ping et ICMP" type="exercices" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/offensive-security-intro" titre="I-02 — Offensive Security Intro" description="Offensif ou défensif, l'autorisation, Gobuster, les codes HTTP et les métiers offensifs" type="exercices" meta="11 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/defensive-security-intro" titre="I-03 — Defensive Security Intro" description="L'équipe bleue, le SOC, le renseignement, la DFIR, les malwares et le SIEM" type="exercices" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/cyber-kill-chain" titre="I-04 — Cyber Kill Chain" description="Les sept phases de Lockheed Martin, de la reconnaissance aux actions sur objectifs" type="exercices" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/passive-reconnaissance" titre="I-05 — Passive Reconnaissance" description="Passif ou actif, WHOIS, nslookup et dig, DNSDumpster et Shodan" type="exercices" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/active-reconnaissance" titre="I-06 — Active Reconnaissance" description="Le navigateur, ping et ICMP, traceroute, telnet et netcat" type="exercices" meta="12 questions"}
::

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/dns-in-detail" titre="I-07 — DNS in Detail" description="Hiérarchie des domaines, enregistrements, TTL et chemin d'une requête" type="exercices" meta="12 questions"}
::

## TryHackMe — les rooms spécifiques

::carte-lien{to="/cours/a1/ethical-hacking/tryhackme/further-nmap" titre="S-01 — Further Nmap" description="Ports et poignée de main, types de scans, états, NSE et évasion" type="exercices" meta="15 questions"}
::

## Les labs Vulnhub

::carte-lien{to="/cours/a1/ethical-hacking/labs/cours" titre="Le cours" description="La démarche et le rapport, énumérer large et l'injection de commande, énumérer un CMS, de l'injection SQL au shell, backdoor de service et énumération web, l'élévation de privilèges" type="cours" meta="8 sections"}
::

::carte-lien{to="/cours/a1/ethical-hacking/labs/qcm" titre="Le QCM" description="Les gestes des cinq labs en anglais, comme à l'examen : démarche, énumération, injection de commande, CMS, injection SQL jusqu'au shell, backdoor de service, élévation de privilèges" type="qcm" meta="19 questions · 20 min"}
::

## Emporter mes résultats

::export-resultats
::
