Gib hier alle Zielgeräte ein, die Du schalten möchtest, sobald ein Auslöser aktiviert wird und die Bedingungen in den Zonen erfüllt sind.

*Warum sind hier unterschiedliche Datenpunkte für das Ein- und Ausschalten?*
Normalerweise sind diese gleich (Datenpunkt erwartet `true`/`false`) für das Ein-/Ausschalten, aber in bestimmten Fällen benötigen Benutzer einen anderen Datenpunkt und Datenpunkt-Wert, um ein Gerät ein- oder auszuschalten. Beispiel: fully-tablet-control.0.device.tablet_bathroom.commands.screenOn und fully-tablet-control.0.device.tablet_bathroom.commands.screenOff.
Du kannst auch Datenpunkte hinzufügen, die nicht boolean (`true`/`false`), sondern String oder Zahl sind.

Für jede Tabellenzeile fügt dieser Adapter verknüpfte Datenpunkte zu `smartcontrol.x.targetDevices.xxx` hinzu. Wenn du diese Datenpunkte änderst, wird der ursprüngliche Ziel-Datenpunkt entsprechend geändert, und umgekehrt.

| Spalte   |  Pflichtfeld |  Beschreibung |
|----------|:------------:|-------|
| ![image](https://github.com/Mic-M/ioBroker.smartcontrol/blob/master/admin/doc-md/img/check_box-24px.svg?raw=true) |  Ja          | Aktiviert/Deaktiviert diese Tabellenzeile. Falls nicht aktiviert, wird diese Tabellenzeile vom Adapter nicht beachtet. In den Adapter-Optionen, unter 'WEITERE OPTIONEN > Eingabe-Validierung' kannst du übrigens einstellen, dass auch deaktivierte Zeilen auf Gültigkeit geprüft werden. |
| Geräte-Name |    Ja   | Name des Gerätes deiner Wahl. Verbotene Zeichen: ``[ ] * , ; ' " ` < > \ ?`` |
| Datenpunkt zum einschalten | Ja | 	Datenpunkt des Zielgerätes zum Einschalten, sobald ein Auslöser auslöst und die Bedingungen in den Zonen zutreffen. |
| Wert für 'an' | Ja | Datenpunkt-Wert, der in 'Datenpunkt zum einschalten' gesetzt wird. Du kannst `true`, `false`, Nummern wie `144`, or Strings wie `Schalte Radio an` verwenden. Sämtliche Leerzeichen und Anführungszeichen (wie `"`) am Anfang und Ende werden automatisch entfernt. <br><br>Der Wert kann unter "4. ZONEN", "Zu schaltende Zielgeräte" überschrieben werden.|
| Prüfung deakiv. (an) | Nein | Vor dem Schalten wird immer geprüft, ob das Zielgerät bereits an ist lt. "Wert für 'an'". Wenn du diese Option aktivierst, erfolgt keine Überprüfung und es wird immer geschaltet. Use Case: z.B. ein Button als Datenpunkt. Siehe [Github Issue #5](https://github.com/Mic-M/ioBroker.smartcontrol/issues/5).|
| Datenpunkt zum ausschalten | Ja | Datenpunkt des Zielgerätes zum Ausschalten, sobald ein Timeout erreicht wurde (z.B. keine Bewegung mehr und die Bewegungsmelder-Sekunden sind heruntergezählt auf 0) oder falls der Datenpunkt `smartcontrol.x.targetDevices.xxx.[Device Name]` geändert wurde.|
| Wert für 'aus' | Ja | Datenpunkt-Wert, der in 'Datenpunkt zum ausschalten' gesetzt wird. Du kannst `true`, `false`, Nummern wie `144`, or Strings wie `Schalte Radio an` verwenden. Sämtliche Leerzeichen und Anführungszeichen (wie `"`) am Anfang und Ende werden automatisch entfernt.|
| Prüfung deakiv. (aus) | Nein | Siehe *Prüfung deakiv. (an)* weiter oben, nur hier für das ausschalten des Gerätes.|