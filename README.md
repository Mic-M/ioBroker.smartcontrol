![Logo](admin/smartcontrol.png)
# ioBroker.smartcontrol

[![NPM version](http://img.shields.io/npm/v/iobroker.smartcontrol.svg)](https://www.npmjs.com/package/iobroker.smartcontrol)
[![Downloads](https://img.shields.io/npm/dm/iobroker.smartcontrol.svg)](https://www.npmjs.com/package/iobroker.smartcontrol)
![Number of Installations (latest)](http://iobroker.live/badges/smartcontrol-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/smartcontrol-stable.svg)
[![Dependency Status](https://img.shields.io/david/Mic-M/iobroker.smartcontrol.svg)](https://david-dm.org/Mic-M/iobroker.smartcontrol)
[![Known Vulnerabilities](https://snyk.io/test/github/Mic-M/ioBroker.smartcontrol/badge.svg)](https://snyk.io/test/github/Mic-M/ioBroker.smartcontrol)

[![NPM](https://nodei.co/npm/iobroker.smartcontrol.png?downloads=true)](https://nodei.co/npm/iobroker.smartcontrol/)

**Tests:**: [![Travis-CI](http://img.shields.io/travis/Mic-M/ioBroker.smartcontrol/master.svg)](https://travis-ci.org/Mic-M/ioBroker.smartcontrol)

## smartcontrol adapter for ioBroker

Control devices smarter: by grouping, including triggers like motion, opening window, etc. and set target devices accordingly.

<sub><sup>Adapter icon made by [freepik](https://www.flaticon.com/authors/freepik) from [flaticon.com](https://www.flaticon.com/).</sup></sub>

## Installation
The adapter is not yet in the "latest repository". So please [Install adapter from own URL](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/admin/adapter.md). Then add an adapter instance.


## Instructions

We are having a nice term [Medienbruch](https://de.wikipedia.org/wiki/Medienbruch) in the German language, which is an unnecessary requirement to 'break' the current medium and switch to a different medium (like different website, program, etc.) to execute/complete a task. 
Since this is cumbersome, I am not providing any adapter instructions here, but intuitively right within the adapter configuration.

Therefore, I have included all instructions in the admin settings of this adapter. Click on the according header, and you will get the instructions accordingly:

![SmartControl Options](admin/img/smartControl_options1.gif)


## To Do (to be considered for further development and future releases
* ~~(OstfrieseUnterwegs) - 2020-16-07 - Warnung/Fehlermeldung nicht ganz konsistent. [Siehe Forum](https://forum.iobroker.net/post/463170)~~
* (Yetiberg) & (crunship) - 2020-07-15 - Zielgerät schalten per Button ohne Überprüfung ob bereits an/aus. [Siehe Forum](https://forum.iobroker.net/post/463068)
* (crunchip) - 2020-07-13 - ...bisher nur ein paar Lichter integriert hab, füllt sich die Liste der Zielgeräte jedoch recht schnell. Nur so mal in den Raum geworfen, bei intensiver Nutzung, wird diese List doch recht lang und unübersichtlich. Gäbe es da nicht eine Möglichkeit, eine Art Untermenü anzulegen, so alla "Räume" z.b.? [Siehe Forum](https://forum.iobroker.net/post/461764)
* (Christoph1337) - 2020-07-12 - Wenn Bewegung kurz. Z. B. 3 Minuten. Dann Licht nach 5 Minuten abschalten.
Wenn Bewegung länger. Z. B. 15 Minuten. Licht für 30 Minuten an lassen. [Siehe Forum](https://forum.iobroker.net/post/461643)
* ~~(MartyBr) - 2020-07-11 - Suncalc findet in Deutschland je nach Lage nicht immer night/nightEnd. [Siehe Forum](https://forum.iobroker.net/post/461159). Idee: Option anbieten, die bei night/nightEnd Fehler einfach eine vorzugebende Uhrzeit setzt, damit zumindest die Funktionalität soweit gegeben ist. - [Siehe Zeiten zur Kalkulation](https://forum.iobroker.net/post/461216)~~ new option 'correct night/nightEnd' in 0.1.0-alpha.10
* (frostnatt) - 2020-07-09 - Timing issue for Aquara motion sensors if brightness. [ioBroker Forum Link](https://forum.iobroker.net/post/460130)
* (Christoph1337) - 2020-09-07 - automatisch eine HTML Tabelle generiert wo alle Schalter mit Zuordnung enthalten sind. Das wäre gerade für den Start für viele einfacher da man sich nicht in vis großartig einarbeiten muss. Am besten sogar responsive für verschiedene Auflösungen. [ioBroker Forum Link](https://forum.iobroker.net/post/460117)
* ~~(EdgarM) - 2020-07-08 - Taster benutzen -> Licht an, Taster nochmal benutzen -> Licht aus [ioBroker Forum Link](https://forum.iobroker.net/post/459671)~~ 0.1.0-alpha.10
* (frostnatt) - 2020-07-05 - Es wäre ein gewisses "misbehaviour-handling" wünschenswert, wenn zum Beispiel der Occupancy-Datenpunkt nicht auf False gesetzt wird. Hier könnte man zwischen "nichts tun" und "in z Minuten ausschalten" wählen. [ioBroker Forum Link](https://forum.iobroker.net/post/458399)
* (OstfrieseUnterwegs) - 2020-07-03 - Add option to disregard additional schedule table if a time specific trigger is activated - [ioBroker Forum Link](https://forum.iobroker.net/post/457849)
* ~~(OstfrieseUnterwegs) - 2020-07-03 - Think about a better name for "Room/Area", which is actually like a complex 'scene'. Maybe "zone"? - [ioBroker Forum Link](https://forum.iobroker.net/post/457849)~~ -> renamed to "Zones"
* (OstfrieseUnterwegs) - 2020-07-03 - Cron Wizard - [ioBroker Forum Link](https://forum.iobroker.net/post/457861)
* (looxer01) - 2020-06-22 - IFTTT etc. - [ioBroker Forum Link](https://forum.iobroker.net/post/453321)
* (EdgarM) - 2020-06-18 - Several ideas - [ioBroker Forum Link](https://forum.iobroker.net/post/451578)
* (siggi85) - 2020-05-24 - time depending light control features - [ioBroker Forum Link](https://forum.iobroker.net/post/437887)
* (klassisch) - 2020-05-24 - several suggestions - [ioBroker Forum Link](https://forum.iobroker.net/post/437877)
* (Mic-M) - 2020-05-23 - die Möglichkeit, nach x Minuten ausschalten zu lassen (z.B. nach 2 Stunden) falls kein Trigger wie BWM mehr was auslöst, um Fälle abzudecken wie "der User ist eingeschlafen" [ioBroker Forum Link](https://forum.iobroker.net/post/437806)
* (MartyBr) & (crunship)  - 2020-05-17 - Manuelles schalten soll Bewegungsmelder außer Kraft setzen. [ioBroker Forum Link](https://forum.iobroker.net/post/433871) | [ioBroker Forum Link 2](https://forum.iobroker.net/post/437803) | [Script](https://forum.iobroker.net/topic/21226/vorlage-automatisches-licht)


## Changelog

### 0.1.0-alpha.xx 
* (Mic-M) Fix: non-consistent logs for verifying config


### 0.1.0-alpha.11
* (Mic-M) Fix: check for 'is time between'

### 0.1.0-alpha.10
* (Mic-M) New feature: Provide "Toggle?" option in 'Other Triggers' table to allow toggles: if targets are off -> turn on, and vice versa.
* (Mic-M) New feature: Allow using same trigger state multiple times. Required significant code changes.
* (Mic-M) New feature: If you are using multiple motion sensors for a zone: whenever a motion device triggers, the turn off timer is being stopped and a new timer is set per the latest motion sensor.
* (Mic-M) New feature: In certain northern areas is night/nightEnd not available at least in Summer in Germay. New adapter option added to set midnight to 0:00 and midnightEnd to 2:00 in this case.
* (Mic-M) + a few more features I forgot do mention ;)

### 0.1.0-alpha.9
* (Mic-M) New feature: Triggers (Auslöser) - new option to switch target devices off and not on for 'Other Triggers' and 'Time specific Triggers'

### 0.1.0-alpha.8
* (Mic-M) Editorial only: rename '5. ZEITPLÄNE' (SCHEDULES) into '5. AUSFÜHRUNG' (EXECUTION) throughout the code - https://forum.iobroker.net/post/461282

### 0.1.0-alpha.7
* (Mic-M) Extend option 'triggerStatesAck' to include alias and namespaces not from adapters - https://forum.iobroker.net/post/461221

### 0.1.0-alpha.6
* (Mic-M) Remove requirement that trigger states must be unique - https://forum.iobroker.net/post/461115

### 0.1.0-alpha.5
* (Mic-M) New feature: allow comparison operators >=, <=, >, < for trigger states

### 0.1.0-alpha.4
* (Mic-M) translations

### 0.1.0-alpha.3
* (Mic-M) multiple changes, improvements and enhancements

### 0.1.0-alpha.2
* (Mic-M) multiple changes, improvements and enhancements

### 0.1.0-alpha.1
* (Mic-M) multiple changes, improvements and enhancements

### 0.0.3
* (Mic-M) release for very early testers

## License
MIT License

Copyright (c) 2020 Mic-M <iob.micm@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.