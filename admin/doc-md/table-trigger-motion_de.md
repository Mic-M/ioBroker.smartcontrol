Hier erfasst du deine Bewegungsmelder. Du kannst optional auch noch Helligkeits-Datenpunkte und Grenzwerte für diese festlegen.

| Spalte   |  Pflichtfeld |  Beschreibung |
|----------|:------------:|-------|
| ✓        |  Ja          | Aktiviert/Deaktiviert diese Tabellenzeile. Falls nicht aktiviert, wird diese Tabellenzeile vom Adapter nicht beachtet. In den Adapter-Optionen, unter 'WEITERE OPTIONEN > Eingabe-Validierung' kannst du übrigens einstellen, dass auch deaktivierte Zeilen auf Gültigkeit geprüft werden. |
| Name für Bewegungsmelder | Ja | Beliebiger Name für den Bewegungsmelder.|
| Datenpunkt Bewegungsmelder | Ja | Datenpunkt des Bewegungsmelders|
| Sek | Nein | Nach dieser Anzahl an Sekunden (und keiner weiteren zwischendurch erkannten Bewegung) werden die Zielgeräte ausgeschaltet.<br>Zum deaktivieren: Leer lassen oder 0 setzen.<br>Detail-Info: Sobald der Bewegungsmelder-Datenpunkt auf `false` geht, also keine Bewegung mehr erkannt wird, startet ein Timer mit den hier angegebenen Sekunden. Erst nach Ablauf dieser Sekunden werden die in der jeweiligen Zone definierten Zielgeräte ausgeschaltet. Erfolgt eine neue Bewegung (Bewegungsmelder-Datenpunkt auf `true`) während der Timer läuft, wird der Timer gelöscht und die Zielgeräte bleiben an.|
| (Symbol: Timer aus) | Nein | Wenn diese Option aktiviert ist, wird kein Ausschalt-Timer für die Zielgeräte gesetzt, die bereits an waren. Use Case: [siehe Forum-Beitrag](https://forum.iobroker.net/post/433871).|
| Datenpunkt Helligkeit | Nein | Datenpunkt, der die aktuelle Helligkeit widergibt.|
| Grenze | Nein | Grenzwert für die Helligkeit. Falls die aktuelle Helligkeit von 'Datenpunkt Helligkeit' größer als diese Zahl ist, wird die Bewegung ignoriert.<br>Bitte beachte hierzu auch die Option Helligkeit (Bri) nicht prüfen falls Zone an unter 'WEITERE OPTIONEN > Bewegungsmelder'.|