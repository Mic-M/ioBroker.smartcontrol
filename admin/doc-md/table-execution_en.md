### This is supposed to be in English - translation will follow soon.
Du kannst **Immer ausführen** selektieren, dann wird einfach immer ausgeführt, sofern etwaige zuvor definierte Bedingungen zutreffen.<br>Möchtest du jedoch weitere Bedingungen definieren, wann die in der Zone definierten Zielgeräte angeschaltet werden, sobald ein Auslöser auslöst, deaktivierst du diese Option.<br>Dann erscheint eine Tabelle mit folgenden Optionen:

| Spalte   |  Pflichtfeld |  Beschreibung |
|----------|:------------:|-------|
| ✓        |  Ja          | Aktiviert/Deaktiviert diese Tabellenzeile. Falls nicht aktiviert, wird diese Tabellenzeile vom Adapter nicht beachtet. In den Adapter-Optionen, unter 'WEITERE OPTIONEN > Eingabe-Validierung' kannst du übrigens einstellen, dass auch deaktivierte Zeilen auf Gültigkeit geprüft werden. |
| Start/Ende |  Ja     | Sobald ein Auslöser auslöst, muss die aktuelle Uhrzeit innerhalb dieses Zeitraums sein, damit die Zielgeräte geschalten werden.<br>Du kannst hier eine Uhrzeit in Stunde/Minute, wie `08:25` oder `23:30` eingeben. Außerdem kannst du einen Astro-Namen wie `sunset` eingeben und dabei einen Versatz ("Offset") in Minuten hinzufügen, z.B. `goldenHourEnd+30` oder `sunset-60`.<br>Die aktuellen Astrozeiten findest du übrigens als Info-Datenpunkte in diesem Adapter: `smartcontrol.x.info.astroTimes`.<br>Eine Startzeit von z.B. `sunset` und eine Endzeit von z.B. `03:00` (also über Mitternacht hinaus) ist ebenso möglich. |
| Mo-So |  Ja     | Ziele werden geschaltet, wenn diese Wochentage zutreffen. |
| Zusätzlich muss erfüllt sein |  Ja     | Hier kannst du zusätzliche Bedingungen eintragen, die zusätzlich zutreffen müssen, z.B.: Jemand ist anwesend, Heute ist Feiertag, Oma schläft, usw. |
| ✓✓ |  Nein   | Für *Zusätzlich muss erfüllt sein*: Wenn aktiviert, müssen alle Bedingungen zutreffen ('und'). Wenn deaktiviert, reicht es, wenn eine der Bedingungen zutrifft.<br>Falls du nur eine Bedingung auswählst, ist es egal, ob du das aktivierst oder nicht. |
| Nie schalten wenn... |  Nein   | 	Hier kannst du zusätzliche Bedingungen eintragen, die nie zutreffen dürfen, z.B.: Keiner zu Hause, Radio läuft, usw. |
| ✓✓ |  Nein   | Für *Nie schalten wenn...*: Wenn aktiviert, müssen alle Bedingungen zutreffen ('und'). Wenn deaktiviert, reicht es, wenn eine der Bedingungen zutrifft.<br>Falls du nur eine Bedingung auswählst, ist es egal, ob du das aktivierst oder nicht. |

