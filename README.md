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

## Smart Control Adapter for ioBroker

Control devices smarter: by grouping, including triggers like motion, opening window, etc. and set target devices accordingly.

<sub><sup>Adapter icon made by [freepik](https://www.flaticon.com/authors/freepik) from [flaticon.com](https://www.flaticon.com/).</sup></sub>

## Forum Links
* **Current Thread: [Teste Adapter SmartControl 0.1.1-beta.x](https://forum.iobroker.net/topic/35308/)**
* 10.07. - 19.07.2020 : [Neuen SmartControl-Adapter 0.1.0-alpha.x testen](https://forum.iobroker.net/topic/35096/1)
* 23.05. - 10.07.2020 : [Planung neuer Adapter: Smart Control](https://forum.iobroker.net/topic/33691/)
* 25.04.2020 : [Umfrage: Welchen Adapter soll ich als nächstes entwickeln?](https://forum.iobroker.net/topic/32644/)



## Installation
The adapter is not yet in the "latest repository". So please [Install adapter from own URL](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/admin/adapter.md). Then add an adapter instance.


## Instructions

We are having a nice term [Medienbruch](https://de.wikipedia.org/wiki/Medienbruch) in the German language, which is an unnecessary requirement to 'break' the current medium and switch to a different medium (like different website, program, etc.) to execute/complete a task. 
Since this is cumbersome, I am not providing any adapter instructions here, but intuitively right within the adapter configuration.

Therefore, I have included all instructions in the admin settings of this adapter. Click on the according header, and you will get the instructions accordingly:

![SmartControl Options](admin/img/smartControl_options1.gif)


## Changelog

### 0.1.1-beta.2
* (Mic-M) Fix: Perform configuration validation and correction also for non-active table rows, since these can be switched on thru `smartcontrol.x.options.xxx.xxx.active` states.

### 0.1.1-beta.1
* (Mic-M) New feature: New option in motion sensor table: if activated, motion triggers will not set a timeout if target device was turned on previously without a motion trigger ("manually"). [Forum Link](https://forum.iobroker.net/post/433871)
* (Mic-M) Fix: non-consistent logs for verifying config
* (Mic-M) Change: changed limitTriggerInterval from 2s to 1s - [Issue #3](https://github.com/Mic-M/ioBroker.smartcontrol/issues/3)
* (Mic-M) Fix: 24:00 as time: now treated as 0:00 but adding 24h to timestamp. 
* (Mic-M) Fix: If a trigger state path was used multiple times in different triggers and schedules, second schedule stopped. [Forum Link](https://forum.iobroker.net/post/464208)
* (Mic-M) Improvement: Better info log / extended info log per Option 'Extended Info Log'

### 0.1.0-alpha.11
* (Mic-M) Fix: check for 'is time between'

### 0.1.0-alpha.10
* (Mic-M) New feature: Provide "Toggle?" option in 'Other Triggers' table to allow toggles: if targets are off -> turn on, and vice versa.
* (Mic-M) New feature: Allow using same trigger state multiple times. Required significant code changes.
* (Mic-M) New feature: If you are using multiple motion sensors for a zone: whenever a motion device triggers, the turn off timer is being stopped and a new timer is set per the latest motion sensor.
* (Mic-M) New feature: In certain northern areas is night/nightEnd not available at least in Summer in Germay. New adapter option added to set midnight to 0:00 and midnightEnd to 2:00 in this case.
* (Mic-M) New feature 'Always of after x secs' in Zones table.
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