Hiermit kannst du als Ziel eine URL verwenden, z.B. `http://192.198.10.20/relay/0?turn=on`. Dies dient dazu, etwa Geräte per URL zu steuern.

### Tabellen-Einstellungen:


| Spalte   |  Pflichtfeld |  Beschreibung |
|----------|:------------:|-------|
| ![image](https://github.com/Mic-M/ioBroker.smartcontrol/blob/master/admin/doc-md/img/check_box-24px.svg?raw=true) |  Ja          | Aktiviert/Deaktiviert diese Tabellenzeile. Falls nicht aktiviert, wird diese Tabellenzeile vom Adapter nicht beachtet. In den Adapter-Optionen, unter 'WEITERE OPTIONEN > Eingabe-Validierung' kannst du übrigens einstellen, dass auch deaktivierte Zeilen auf Gültigkeit geprüft werden. |
| Name |    Ja   | Name deiner Wahl. Verbotene Zeichen: ``[ ] * , ; ' " ` < > \ ?`` |
| URL zum Einschalten | Ja | Die entsprechende URL, die aufgerufen werden soll, z.B. `http://192.198.10.20/relay/0?turn=on`
| URL zum Ausschalten| Nein | Hier optional eine URL, die die zum Ausschalten aufgerufen werden soll, z.B. `http://192.198.10.20/relay/0?turn=off`. Falls du dies leer lässt, wird nicht ausgeschaltet und auch keine Ausschalt-Datenpunkte angelegt.

Unter "ZONEN" kannst du diese "Zielgeräte" dann entsprechend wählen.


### Datenpunkte unterhalb smartcontrol.x.targetURLs.<definierter URL-Name>.:

Für jede Tabellenzeile werden diese Datenpunkte angelegt, dabei wird der Wert, der unter `Name` steht, eintsprechend verwendet:

| Datenpunkt |  Erklärung |
|------------|------------|
| `smartcontrol.x.targetURLs.<Name>.call_on` | Sobald dieser Datenpunkt auf `true` gesetzt wird, wird die URL aufgerufen. |
| `smartcontrol.x.targetURLs.<Name>.response_on` | In diesem Datenpunkt wird dann die Response, also die Antwort auf deinen URL-Aufruf, ausgegeben. |

Wenn du eine URL "zum Ausschalten" angelegt hast, dann werden ebenso die Datenpunkte `smartcontrol.x.targetURLs.<Name>.call_off` und `smartcontrol.x.targetURLs.<Name>.response_off`


Unabhängig zu den sonstigen Einstellungen in diesem Adapter kannst du über die angelegten Datenpunkte die URLs dann entsprechend ausführen bzw. aufrufen, in dem du `.call_on` oder `.call_off` auf `true` setzt. 
Das Ergebnis erscheint dann im Datenpunkt `.response`. Damit kannst du die URLs also beispielsweise auch über Blockly/Javascript aufrufen.

