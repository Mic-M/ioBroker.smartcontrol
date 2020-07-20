# Smart Control Adpater: Translations

## How to translate into another language?

Please use 'Google translate' for translation to your language. It works very well, and you're able to translate into nearly any language on the fly.

**Chrome users** may prefer the [Google Translate]( https://chrome.google.com/webstore/detail/google-translate/aapbdbdomjkkjkaonfhkkikfgjllcleb) extension to translate web pages (so your local ioBroker admin) on the fly. 

For sure there are similar plugins available for other browsers like Firefox, etc. to translate websites. 

If you have any further tips or hints for easy-to-use client-side translations within a web browser, please let me know by posting a [Github issue](https://github.com/Mic-M/ioBroker.smartcontrol/issues) with your tips.


## Reason / Approach

I have decided to no longer maintain translations into multiple languages due to the following reasons:
* The vast majority of ioBroker users are able to read German. Reference: [ioBroker Statistics](https://www.iobroker.net/#de/statistics)

* Maintaining ioBroker adapter translations is quite painful, as it takes a huge amount of time for keeping documentation, administration html, etc. up to date, especially for very young adapters when text changes still happen very often.
* I am doing all my ioBroker contribution in my private time, and - by the way - earn zero (0.00€) profit out of this. Why should I do something such painful and time-consuming in my private time? No way :-)

*Note:* Certainly Gulp helps greatly in translation (see [Gulp: Auto translation](https://forum.iobroker.net/topic/19047/)), but does not cover changes to e.g. index_m.html - which causes a lot of manual copy/paste operations, structuring html text for translations being used, formatting issues, etc.


## You do not like my translation approach?

That's OK, we all have different opinions ;-) Please contribute to the ioBroker community by improving the translation implementation for adapters. [Learn JavaScript](https://javascript.info/) if needed, it's a great programming language :-)
Potential starting points to contribute to translation improvements:
* [Gulp: Auto translation](https://forum.iobroker.net/topic/19047/)
* File `iobroker/node_modules/ioBroker.<adaptername>\gulpfile.js`. 


I would be very pleased to change this approach once an easy adapter translation implementation is available.
