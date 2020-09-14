Diese Tabelle ist optional:
<br>Hier trägst du zusätzliche Bedingungen ein, die (nicht) zutreffen sollen, z.B.: Jemand ist anwesend, Keiner ist anwesend, Heute ist Feiertag, etc. Diese Bedingungen kannst du dann in den entsprechenden anderen Optionen-Tabellen auswählen.

| Spalte   |  Pflichtfeld |  Beschreibung |
|----------|:------------:|-------|
| ✓        |  Ja          | Aktiviert/Deaktiviert diese Tabellenzeile. Falls nicht aktiviert, wird diese Tabellenzeile vom Adapter nicht beachtet. In den Adapter-Optionen, unter 'WEITERE OPTIONEN > Eingabe-Validierung' kannst du übrigens einstellen, dass auch deaktivierte Zeilen auf Gültigkeit geprüft werden. |
| Name der Bedingung | Ja | Hier beliebigen Namen deiner Bedingung eintragen, z.B. 'Feiertag Heute'. |
| Datenpunkt der Bedingung | Ja | Datenpunkt für diese Bedingung, wie `javascript.0.Holiday.isHolidayToday`. |
| DP-Wert | Ja | Datenpunkt-Wert der Bedingung, wenn sie zutreffen soll. Du kannst `true`, `false`, Nummern wie `144`, or Strings wie `Oma schläft jetzt` verwenden. Sämtliche Leerzeichen und Anführungszeichen (wie `"`) am Anfang und Ende werden automatisch entfernt. |

