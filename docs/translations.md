# Smart Control Adpater: Translations

## Approach

I have decided to no longer maintain translations into multiple languages due to the following reasons:
* The vast majority of ioBroker users are German speaking. Reference: [ioBroker Statistics](https://www.iobroker.net/#de/statistics)

* Maintaining ioBroker adapter translations is pretty painful, as it takes a huge amount of time for keeping documentation, administration html, etc. up to date, especially for very young adapters when text changes are being done like every other minute.
* I am doing all my ioBroker contribution in my personal time, and, by the way, get zero (0.00€) profit out of this. Why should I do something such painful and time-consuming in my personal time? No way :-)

*Note:* Gulp certainly helps greatly (see [Gulp: Auto translation](https://forum.iobroker.net/topic/19047/)), but does not cover changes to index_m.html for example which causes major manual copy/paste etc, structuring html text for translations being used in like no line breaks, formatting issues, etc.


## Non-German speaking folks

Please use Google translate It works very well, and you can translate into like any language on the fly.

**Chrome users** may like the [Google Translate]( https://chrome.google.com/webstore/detail/google-translate/aapbdbdomjkkjkaonfhkkikfgjllcleb) extension to translate local web pages (so your local ioBroker admin) on the fly. 

I am certain there are similar plugins available for other browsers like Firefox, etc. to translate local websites. 

If you have any further tips or hints client-side translations within the web browser for users, please let me know by posting a [Github issue](https://github.com/Mic-M/ioBroker.smartcontrol/issues).


## You do not like my translation approach?

This is fine, we all have different opinions ;-) Please go ahead and contribute to the ioBroker community by improving the translation implementation for adapters. Good starting point is the file `iobroker/node_modules/ioBroker.<adaptername>\gulpfile.js`. 
I am more than willing to change this approach once an easier adapter translation implementation is available.