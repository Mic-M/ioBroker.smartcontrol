Durch Doppelklick oder F2 kannst du hier individuelle Werte für Zielgeräte setzen.<br>
<details>
  <summary style="padding-bottom:-20px">Weitere Erklärung (hier klicken)</summary> <!-- Header -->
  <!-- Markdown Collapsible Section - We must have an empty line below -->


### Beispiele
 * **{** `val:Radio Chillout, delay:20` **}**
 * **{** `delay:30` **}**
 * **{** `val:true` **}**

### Erklärung
 * **val**: Hiermit wird der *Wert für 'an'* von *1. ZIELGERÄTE* überschrieben.
 * **delay**: Verzögertes einschalten in Sekunden. Hiermit wird das Zielgerät bei Aktivierung der Zone verzögert eingeschaltet. <br>*Beispiel-Anwendungsfall (Use Case)*: Schalte den Strom-Zwischenstecker sofort ein, warte 30 Sekunden und schalte dann den Fernseher ein (weil er z.B. vorher noch nicht auf IR-Befehle reagiert) und dimme nach 50 Sekunden das Licht im TV-Eck.

#### Hinweis
Diese Funktion wurde mit Adapter-Version 0.5.3 erweitert, in den Vor-Versionen konnte man hier lediglich einen neuen Zielwert setzen mit **{** `neuer Zielwert` **}**. Bitte ändere dies gelegentlich in **{** `val:neuer Zielwert` **}** um, also Voranstellen von `val:`. In neueren Adapter-Versionen wird `val:` Voraussetzung sein, damit es weiter funktioniert.

</details>