Durch Doppelklick oder F2 kannst du hier individuelle Optionen für Zielgeräte setzen.<br>
<details>
  <summary style="padding-bottom:-20px">Weitere Erklärung (hier klicken)</summary> <!-- Header -->
  <!-- Markdown Collapsible Section - We must have an empty line below -->


### Beispiele
 * **{** `val:Radio Chillout, delay:20` **}**
 * **{** `delay:30` **}**
 * **{** `val:true` **}**

### Erklärung
 * **val**: Hiermit wird der *Wert für 'an'* von *1. ZIELGERÄTE* überschrieben.
 * **delay**: Hiermit wird *Verzögertes Einschalten des Zielgerätes* von *1. ZIELGERÄTE* durch die angegebene Anzahl Sekunden überschrieben. Zum Deaktivieren kannst du `delay:0` eintragen.<br>*Beispiel-Anwendungsfall (Use Case)*: Schalte den Strom-Zwischenstecker sofort ein, warte 30 Sekunden und schalte dann den Fernseher ein (weil er z.B. vorher noch nicht auf IR-Befehle reagiert) und dimme nach 50 Sekunden das Licht im TV-Eck.

#### Hinweis
Diese Funktion wurde mit Adapter-Version 0.5.3 erweitert, in den Vor-Versionen konnte man hier lediglich einen neuen Zielwert setzen mit z.B. **{** `Radio Chillout` **}**. Dies unterstützt der Adapter weiterhin. Falls du also nur den Zielwert überschreiben willst, kannst du einfach **{** `Radio Chillout` **}** eingeben, anstatt **{** `val:Radio Chillout` **}**. Aber wenn du auch ein **delay** (Verzögertes Einschalten) setzen willst, musst du **{** `val:Radio Chillout, delay:20` **}** eingeben. Delay alleine, also **{** `delay:20` **}** geht natürlich auch, dann wird der Zielwert natürlich nicht überschrieben.

</details>