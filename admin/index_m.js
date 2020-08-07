/* eslint-disable no-irregular-whitespace */
/* eslint-env jquery, browser */               // https://eslint.org/docs/user-guide/configuring#specifying-environments
/* global socket, values2table, table2values, M, _ */  // for eslint

/**
 * This is called by the admin adapter when the settings page loads
 */

// ++++++ Define option tables ++++++
const tableIds = [
    'tableTriggerMotion', 
    'tableTriggerDevices', 
    'tableTriggerTimes', 
    'tableTargetDevices', 
    'tableCombinedDevices', 
    'tableZones', 
    'tableConditions', 
    'tableSchedules'
];
const optionTablesSettings = {}; // Table variable holding the table settings array
for (const lpTableId of tableIds) {
    optionTablesSettings[lpTableId] = [];
}


/************************************************************************
 *** This is called by the admin adapter once the settings page loads ***
 ************************************************************************/
function load(settings, onChange) { /*eslint-disable-line no-unused-vars*/

    // This handles if the save button is clickable or not.
    // From Adapter Creator.
    if (!settings) return;
    $('.value').each(function () {
        const $key = $(this);
        const id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id])
                .on('change', () => onChange());
        } else {
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(settings[id])
                .on('change', () => onChange())
                .on('keyup', () => onChange());
        }
    });    

    // load fancytree for target device selection modal dialog
    fancytreeLoad('fancytree-select-settings');
   
    // ++++++ For option tables ++++++
    for (const lpTableId of tableIds) {
        optionTablesSettings[lpTableId] = settings[lpTableId] || [];
    }

    onChange(false);

    // ++++++ For option tables ++++++
    // values2table() - see iobroker/node_modules/iobroker.admin/www/js/adapter-settings.js
    for (const lpTableId of tableIds) {
        values2table(lpTableId, optionTablesSettings[lpTableId], onChange, function(){val2tableOnReady(lpTableId);});
    }

    /**
     * We call with values2table onReady parameter
     * @param {string} tableId - Table Id, like 'tableTriggerMotion', or blank string '' if nothing shall be executed
     */
    function val2tableOnReady(tableId) {

        switch (tableId) {
            case 'tableTargetDevices':
                statePathPopupSelection(tableId,'stateSelectPopupOnState', 'onState');
                statePathPopupSelection(tableId,'stateSelectPopupOffState', 'offState');                
                updateTableButtonIcons(tableId);
                break;
            case 'tableConditions':
                statePathPopupSelection(tableId,'stateSelectPopupConditionState', 'conditionState');               
                updateTableButtonIcons(tableId);
                break;

            case 'tableTriggerMotion':
                statePathPopupSelection(tableId,'stateSelectPopupMotionState', 'stateId');
                statePathPopupSelection(tableId,'stateSelectPopupBriState', 'briStateId');          
                updateTableButtonIcons(tableId);                
                break;

            case 'tableTriggerDevices':
                statePathPopupSelection(tableId,'stateSelectPopupStateId', 'stateId');    
                updateTableButtonIcons(tableId);                
                break;
            case 'tableTriggerTimes':
                dialogSelectSettings({tableId:'tableTriggerTimes', triggerDataCmd:'selectAdditionalConditions', targetField:'additionalConditions', dialogTitle:'Wähle zusätzliche Bedingungen' });
                dialogSelectSettings({tableId:'tableTriggerTimes', triggerDataCmd:'selectNever', targetField:'never', dialogTitle:`Wähle 'Nie auslösen wenn...'` });
                updateTableButtonIcons(tableId, 'pageview');
                break;
            case 'tableZones':
                dialogSelectSettings({tableId:'tableZones', triggerDataCmd:'selectTriggers', targetField:'triggers', dialogTitle:'Auswahl Auslöser' });
                dialogSelectSettings({tableId:'tableZones', triggerDataCmd:'selectTargetsMenu', targetField:'targets', dialogTitle:'Auswahl Zielgeräte' });
                updateTableButtonIcons(tableId, 'pageview');
                break;
            case 'tableSchedules':
                dialogSelectSettings({tableId:'tableSchedules', triggerDataCmd:'selectAdditionalConditions', targetField:'additionalConditions', dialogTitle:'Wähle zusätzliche Bedingungen' });
                dialogSelectSettings({tableId:'tableSchedules', triggerDataCmd:'selectNever', targetField:'never', dialogTitle:`Wähle 'Nie schalten wenn...'` });
                updateTableButtonIcons(tableId, 'pageview');
                break;       
            default:
                break;
        }


    }

    // Enhance Tabs with onShow-Function. Source: iQontrol Adapter.
    // This allows using JavaScript to perform certain actions as defined in function onTabShow(), since we have
    // several tabs in this adapter configuration.
    onTabShow('#tabMain');
    onTabShow('#tabDevices');
    onTabShow('#tabConditions');
    onTabShow('#tabTriggers');
    onTabShow('#tabZones');
    onTabShow('#tabSchedules');
    // --

    $('ul.tabs li a').on('click', function() { 
        onTabShow($(this).attr('href'));
    });
    function onTabShow(tabId){
        switch(tabId){

            case '#tabMain':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                break;

            case '#tabDevices':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                break;

            case '#tabConditions':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                break;

            case '#tabTriggers':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable('tableConditions', 'name', 'tableTriggerTimes', 'additionalConditions');
                populateTable('tableConditions', 'name', 'tableTriggerTimes', 'never');
                break;

            case '#tabZones':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable(['tableTriggerMotion', 'tableTriggerDevices', 'tableTriggerTimes'], ['name', 'name', 'name'], 'tableZones', 'triggers');
                populateTable('tableTargetDevices', 'name', 'tableZones', 'targets');

                break;

            case '#tabSchedules':
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable('tableZones', 'name', 'tableSchedules', 'name');
                populateTable('tableConditions', 'name', 'tableSchedules', 'additionalConditions');
                populateTable('tableConditions', 'name', 'tableSchedules', 'never');
                break;
        }
    }        

    /**
     * Populate select field
     * @param {*}  sourceTableIds   Id of input table, like "tableTriggerMotion". String or array of strings for multiple tables
     * @param {*}  sourceFieldIds   Id of table line field, from which to get content, like "name". . String or array of strings for multiple fields
     * @param {string}  targetTableId   Target table id, like "tableZones"
     * @param {string}  targetFieldId   Target table line field, like 'Test'
     * @param {string}  [addFirstItem]    Optional string to add as first item of drop-down.
     */
    function populateTable(sourceTableIds, sourceFieldIds, targetTableId, targetFieldId, addFirstItem = '') {
        
        if(!Array.isArray(sourceTableIds)) sourceTableIds = [sourceTableIds]; // wrap into array
        if(!Array.isArray(sourceFieldIds)) sourceFieldIds = [sourceFieldIds]; // wrap into array
        const result = [];
        if (addFirstItem) result.push(addFirstItem);
        for (let i = 0; i < sourceTableIds.length; i++) {
            const configTbl = settings[sourceTableIds[i]] || [];
            for (const lpElement of configTbl) {
                //if (lpElement['active'] == true) { // check for checkbox "active"
                result.push(lpElement[sourceFieldIds[i]]); 
                //}
            }
        }
        // Create dropdown menu
        $('*[data-name="' + targetFieldId + '"]').data('options', result.join(';'));
        // Fill table
        values2table(targetTableId, optionTablesSettings[targetTableId], onChange, function(){val2tableOnReady(targetTableId);});
        
    }
    

    /**
     * For Table Filter
     */
    for (const lpId of tableIds) {

        // Initially hide 'clear filter button' since no filter is set at this time
        $(`div#${lpId} .table-filter button`).hide();

        // Apply the filter
        applyTableFilter(lpId);

        // Clear filters on "Clear Filters" button click
        $(`div#${lpId} .table-filter button`).click(function() {
            $(`div#${lpId} .table-filter input`).val(''); // empty field
            $(`div#${lpId} table`).find('tr:gt(0)').show(); // show all rows
            $(`div#${lpId} .table-filter button`).hide(); // hide button
        });

    }

    /**
     * Dialog: Select Settings (like Triggers or Target Devices)
     * @param {object} given - like: {tableId:'tableZones', triggerDataCmd:'selectTargetsMenu', targetField:'targets', dialogTitle:'some title' }
     */
    function dialogSelectSettings(given) {

        const tableId = given.tableId;
        const triggerDataCmd = given.triggerDataCmd;
        const targetField = given.targetField;
        const dialogTitle = given.dialogTitle;

        const queryResult = $(`#${tableId} a.values-buttons[data-command="${triggerDataCmd}"]`);
        queryResult.on('click', function() {

            // A few variables
            const rowNum = $(this).data('index'); // table row number which was clicked, starting at zero. data-index is also the row number starting at zero
            const dropDownAllOptions = getSelectOptions(`#${tableId} .values-input[data-name="${targetField}"][data-index="${rowNum}"]`, true);
            const dropDownSelectionArray = getSelectOptions(`#${tableId} .values-input[data-name="${targetField}"][data-index="${rowNum}"]`, false);

            // Set modal title
            $('#dialog-select-settings>.modal-content>.row>.col>h6.title').text(dialogTitle);

            // Initialize dialog (modal)
            initDialog('dialog-select-settings', dialogOkClose);
            
            // Set current settings as source into FancyTree
            $('#fancytree-select-settings').fancytree('option', 'source', convertToFancySource(dropDownAllOptions, dropDownSelectionArray));

            /**
             * Sort nodes
             */
            // Folders first. To deactivate folders first: set variable "cmp" to null to deactivate. // https://stackoverflow.com/a/22638802
            const cmp=function(a, b) {
                const x = (a.isFolder() ? '0' : '1') + a.title.toLowerCase();
                const y = (b.isFolder() ? '0' : '1') + b.title.toLowerCase();
                return x === y ? 0 : x > y ? 1 : -1;
            };
            const node = $.ui.fancytree.getTree('#fancytree-select-settings').getRootNode();
            node.sortChildren(cmp, true);

            // Open dialog
            $('#dialog-select-settings').modal('open');
                
            // Called once user clicked "Ok" in the dialog
            function dialogOkClose() {

                const selectedFancyNodes = $.ui.fancytree.getTree('#fancytree-select-settings').getSelectedNodes();

                // go out if user has not selected any node
                if (!selectedFancyNodes) return; 

                const selectedKeys = [];
                //const target = `#${tableId} select.values-input[data-name="${targetField}"][data-index="${rowNum}"]`;
                for (const selectedNode of selectedFancyNodes) {
                    selectedKeys.push(selectedNode.key);
                }

                // go out if selected nodes did not change
                if (arraysEqual(dropDownSelectionArray, selectedKeys)) return;

                // Set to option tables, also to ensure materialize select field is being updated, save button is available, etc.
                optionTablesSettings[tableId][rowNum][targetField] = selectedKeys;
                onChange(true);
                values2table(tableId, optionTablesSettings[tableId], onChange, function(){val2tableOnReady(tableId);});
                
            }
            
        });
    }

    // From ioBroker Adapter Creator:
    // Re-initialize all the Materialize labels on the page if you are dynamically adding inputs.
    if (M) M.updateTextFields(); 


} // load

/**
 * Save Options - Called by the admin adapter when the user clicks save
 * @param {function} callback - callback function
 */
function save(callback) { /*eslint-disable-line no-unused-vars*/

    // example: select elements with class=value and build settings object
    const obj = {};
    $('.value').each(function () {
        const $this = $(this);
        if ($this.attr('type') === 'checkbox') {
            obj[$this.attr('id')] = $this.prop('checked');
        } else {
            obj[$this.attr('id')] = $this.val();
        }
    });
    // ++++++ For option tables ++++++
    for (const tableId of tableIds) {
        obj[tableId] = table2values(tableId);      
    }

    callback(obj);

}






/**
 * Update Table Button Icons
 * If 'data-buttons' in table th is not set to a known keyword (like 'edit'), it uses 'add' as materialize icon.
 * We modify this icon by replacing 'add' with an icon of our choice: https://materializecss.com/icons.html
 * 
 * @param {string|array} tableIds - Table ID(s), like "tableTargetDevices" or ['tableConditions', 'tableTriggerDevices']
 * @param {string} [iconName='zoom-in] - Icon Name - see https://materializecss.com/icons.html
 */
function updateTableButtonIcons(tableIds, iconName='search') {
    let tables = [];
    if (typeof tableIds == 'string') {
        tables = [tableIds];
    } else {
        tables = tableIds;
    }

    for (const lpTableId of tables) {
        $(`#${lpTableId} table.table-values tr a i.material-icons:contains('add')`).each(function() {
            const text = $(this).text().replace('add', iconName);
            $(this).text(text);
        });                
    }        
}


/*************************************************************
 * Table Filter
 * Inspired by: https://github.com/mjansma/LiveSearch/livesearch.js
 * @param {string} id - like 'tableTargetDevices'
 *************************************************************/
function applyTableFilter(id) {
    $(`div#${id} .table-filter input`).keyup(function() {
    //$(this).keyup(function() {
        const table = $('div#' + id + ' table');
        //Get all table columns
        const children = table.find('td');
        const searchString = $(this).val().toLowerCase();

        if (searchString.length < 1) {

            $(`div#${id} .table-filter button`).hide(); // hide filter button
            table.find('tr:gt(0)').show(); // show all if search string is too short
            return;

        } else {

            $(`div#${id} .table-filter button`).show(); // show filter button since we have 2+ chars in filter

            //Hide all rows except the table header
            table.find('tr:gt(0)').hide();

            //Loop through all table columns
            children.each(function(index, child){
                //If search string matches table column
                let checkFor;
                if (child.firstChild && child.firstChild.firstChild && child.firstChild.firstChild.value) {
                    checkFor = child.firstChild.firstChild.value; // we have a drop down
                } else if (!checkFor && child.firstChild && child.firstChild.value && child.firstChild.value != '' && child.firstChild.value != 'on') {
                    checkFor = child.firstChild.value;
                }
                if (checkFor && checkFor.toLowerCase().indexOf(searchString) != -1) {
                    $(child).closest('tr').show(); //Show table row
                }
            });
        }

    });
}



/**
 * From: selectID.js (node_modules/iobroker.admin/www/lib/js/)
 * Name "dialog-select-member" is important, because for that exist the CSS classes
 * Important to have "admin/img/big-info.png", because this icon will be loaded if no icon found, otherwise we have endless loop
 */
let selectId;
function initSelectId (cb) {
    if (selectId) return cb ? cb(selectId) : selectId;
    socket.emit('getObjects', function (err, res) {
        if (!err && res) {
            selectId = $('#dialog-select-member').selectId('init',  {
                noMultiselect: true,
                objects: res,
                imgPath:       '../../lib/css/fancytree/',
                filter:        {type: 'state'},
                name:          'adapter-select-state',
                texts: {
                    select:          _('Select'), 
                    cancel:          _('Cancel'),
                    all:             _('All'),
                    id:              _('ID'),
                    name:            _('Name'),
                    role:            _('Role'),
                    room:            _('Room'),
                    value:           _('Value'),
                    selectid:        _('Wähle einen Datenpunkt'),
                    from:            _('From'),
                    lc:              _('Last changed'),
                    ts:              _('Time stamp'),
                    wait:            _('Processing...'),
                    ack:             _('Acknowledged'),
                    selectAll:       _('Select all'),
                    unselectAll:     _('Deselect all'),
                    invertSelection: _('Invert selection')
                },
                columns: ['image', 'name', 'role', 'room']
            });
            cb && cb(selectId);
        }
    });
}

/**
 * Opens the dialog for state selection.
 * Using selectID.js (node_modules/iobroker.admin/www/lib/js/)
 * It monitors a button for a click, and writes the selected state into a field.
 *
 * @param {string}  tableId     - The id of the table, like 'tableTargetDevices'
 * @param {string}  dataCommand - Name of [data-buttons="edit1"] of the <th>. so like 'edit1'.
 *                                If you use multiple buttons per table row, use like 'edit1', 'edit2' for 'data-buttons=' in <th>
 * @param {string}  targetField - The target field, like 'onState' (of data-name="onState")
 */
function statePathPopupSelection(tableId, dataCommand, targetField) { 
    
    const queryResult = $(`#${tableId} a.values-buttons[data-command="${dataCommand}"]`);
    queryResult.on('click', function () {
        const id = $(this).data('index');
        initSelectId(function (sid) {
            sid.selectId('show', $(`#${tableId} .values-input[data-name="${targetField}"][data-index="${id}"]`).val(), function (statePath) {
                if (statePath) {
                    // We have a selected state, so let's fill the target field
                    $(`#${tableId} .values-input[data-name="${targetField}"][data-index="${id}"]`).val(statePath).trigger('change');
                }
            });
        });
    });

}



/**
 * Initializes a dialog (materialize Modal)
 * 
 * @source iQontrol adapter
 * 
 * @param {string} id - id of Modal, like 'dialog-select-settings'
 * @param {*} callback - callback function.
 */
function initDialog(id, callback) {
    const $dialog = $('#' + id);
    if (!$dialog.data('isInitialized')) {
        $dialog.data('isInitialized', true);
        $dialog.modal({
            dismissible: false
        });

        $dialog.find('.btn-set').on('click', function () {
            const $dialog = $('#' + $(this).data('dialogId'));
            const callback = $dialog.data('callback');
            if (typeof callback === 'function') callback();
            $dialog.data('callback', null);
        });
    }
    $dialog.find('.btn-set').data('dialogId', id);
    $dialog.data('callback', callback);
}


/**
 * To be called in load() function of index_m.html / index_m.js 
 * @param {string} fancytreeId - like 'fancytree-select-settings' for #fancytree-select-settings
 */
// eslint-disable-next-line no-unused-vars
function fancytreeLoad(fancytreeId) {

    $(`#${fancytreeId}`).fancytree({
        checkbox: true,
        checkboxAutoHide: undefined, // Display check boxes on hover only
        extensions: ['filter'],
        quicksearch: true,
        filter: {
            autoApply: true,   // Re-apply last filter if lazy data is loaded
            autoExpand: true, // Expand all branches that contain matches while filtered
            counter: true,     // Show a badge with number of matching child nodes near parent icons
            fuzzy: false,      // Match single characters in order, e.g. 'fb' will match 'FooBar'
            hideExpandedCounter: true,  // Hide counter badge if parent is expanded
            hideExpanders: false,       // Hide expanders if all child nodes are hidden by filter
            highlight: true,   // Highlight matches by wrapping inside <mark> tags
            leavesOnly: false, // Match end nodes only
            nodata: false,      // Display a 'no data' status node if result is empty
            mode: 'hide'       // 'dimm' to gray out unmatched nodes, 'hide' to remove unmatched node instead)
        },        
        selectMode: 2,         // 1:single, 2:multi(limited to actual selected items), 3:multi-hierarchy (will also select parent items)
        source: [], // We set this later
      
        activate: function(event, data) {
            $('#statusLine').text(event.type + ': ' + data.node);
        },

        strings: {
            //loading: 'Loading&#8230;',
            //loadError: 'Load error!',
            //moreData: 'More&#8230;',
            noData: 'Keine Treffer',
        },

        select: function(event, data) {

            $('#statusLine').text(
                event.type + ': ' + data.node.isSelected() + ' ' + data.node
            );

            // Get a list of all selected nodes, and convert to a key array:
            const selKeys = $.map(data.tree.getSelectedNodes(), function(node){
                return node.key;
            });
            $('#echoSelection3').text(selKeys.join(', '));
    
            // Get a list of all selected TOP nodes
            const selRootNodes = data.tree.getSelectedNodes(true);
            // ... and convert to a key array:
            const selRootKeys = $.map(selRootNodes, function(node){
                return node.key;
            });
            $('#echoSelectionRootKeys3').text(selRootKeys.join(', '));
            $('#echoSelectionRoots3').text(selRootNodes.join(', '));
        },

    });

    const tree = $.ui.fancytree.getTree(`#${fancytreeId}`);

    /**
     * Event handlers
     */
    $('input[name=search]').on('keyup', function(e){

        const tree = $.ui.fancytree.getTree();
        const match = $(this).val();

        if(e && e.which === $.ui.keyCode.ESCAPE || $.trim(match) === ''){
            $('button#btnResetSearch').click();
            return;
        }

        const filterFunc = tree.filterBranches; // filterBranches = match whole branches, filterNodes = nodes only
        const n = filterFunc.call(tree, match);

        $('button#btnResetSearch').attr('disabled', false);
        $('span#matches').text('(' + n + ' matches)');

    }).focus();    
      
    $('button#btnResetSearch').click(function(){
        $('input[name=search]').val('');
        $('span#matches').text('');
        tree.clearFilter();
    }).attr('disabled', true);
      
    $('fieldset input:checkbox').change(function() {
        const id = $(this).attr('id');
        const flag = $(this).is(':checked');
      
        // Some options can only be set with general filter options (not method args):
        switch( id ){
            case 'counter':
            case 'hideExpandedCounter':
                tree.options.filter[id] = flag;
                break;
        }
        tree.clearFilter();
        $('input[name=search]').keyup();
    });
}


/**
 * Converts array of dotted strings to FancyTree source format.
 * 
 * @param {array} allDottedStrings - array of ALL dotted strings, like: ['Bath.Radio.on', 'Bath.Light', 'Hallway']
 * @param {array} selectedDottedStrings - array of SELECTED dotted strings, like: ['Hallway']
 * @return {array}               Array for FancyTree source - https://github.com/mar10/fancytree/wiki/TutorialLoadData
 */
function convertToFancySource(allDottedStrings, selectedDottedStrings) {

    try {
        /**
         * First: Prepare array of objects, example:
         *     [
         *      {"key":"Bath.Radio.on","title":"on", , parent:"Bath.Radio", selected:false},
         *      {"key":"Bath.Radio","title":"Radio", parent:"Bath"},
         *      {"key":"Bath","title":"Bath"},
         *      {"key":"Bath.Light","title":"Light", parent:"Bath", selected:false},
         *      {"key":"Hallway","title":"Hallway", selected:false}
         *     ]
         */
        const objectArray = [];

        for (const lpDottedStr of allDottedStrings) {

            const dottedArr = lpDottedStr.split('.');
            for (let i = dottedArr.length-1; i > -1; i--) {
                const resObj = {};

                // get id of looped value, like "Bath.Radio", if i==1, or "Bath.Radio.on" of i==2
                let resId = '';
                for (let k = 0; k <= i; k++) {
                    if (k > 0) resId = resId + '.';
                    resId = resId + dottedArr[k];
                }
                resObj.key = resId;

                // Skip if key value is already in any array object
                if (objectArray.some( (elem)=> elem.key === resId)) continue;

                // Title - 'Bath.Radio.on' -> 'on' if i=2
                resObj.title = dottedArr[i]; 

                // Check box for selected ones, but only last level
                if (i == dottedArr.length -1) {
                    resObj.selected = (selectedDottedStrings.indexOf(lpDottedStr) != -1) ? true : false;
                } else {
                    resObj.checkbox = false; // https://wwwendt.de/tech/fancytree/demo/sample-select.html
                }
                
                // Add parent id
                if (i > 0) {
                    resObj.parent = resObj.key.substr(0, resObj.key.lastIndexOf('.')); // 'Bath.Radio' for 'Bath.Radio.on'
                }

                objectArray.push(resObj);

            }
        }

        /**
         * Next, convert to final FancyTree source.
         * @source (modified accordingly) - https://github.com/mar10/fancytree/wiki/TutorialLoadData#howto-load-data-from-a-flat-parent-referencing-list
         */

        const nodeMap = {};


        // Pass 1: store all tasks in reference map
        for(const lpVal of objectArray) {
            nodeMap[lpVal.key] = lpVal;
        }


        // Pass 2: adjust fields and fix child structure
        let parent;
        let mappedArray = objectArray.map( function (value) {

            // Check if value is a child node
            if( value.parent ) {
                // add value to `children` array of parent node
                parent = nodeMap[value.parent];
                if (!parent) throw('Unexpected error: No parent found.');
                parent.folder = true;
                if(parent.children ) {
                    parent.children.push(value);
                } else {
                    parent.children = [value];
                }
                return null;  // Remove value from childList
            }
            return value;  // Keep top-level nodes
        });
        mappedArray = mappedArray.filter(val => val != null);

        // Pass 3: sort children by 'title'
        for(const lpVal of mappedArray) {
            if( lpVal.children && lpVal.children.length > 1 ) {
                lpVal.children.sort(function(a, b){
                    return ((a.title < b.title) ? -1 : ((a.title > b.title) ? 1 : 0));
                });
            }
        }
        return mappedArray;


    } catch (error) {
        console.error(`[convertToFancySource] - ${error}`);
        return null;
    }

}



/*
██████   ███████ ███    ██ ███████ ██████  ██  ██████          ██ ███████ 
██       ██      ████   ██ ██      ██   ██ ██ ██               ██ ██      
██   ███ █████   ██ ██  ██ █████   ██████  ██ ██               ██ ███████ 
██    ██ ██      ██  ██ ██ ██      ██   ██ ██ ██          ██   ██      ██ 
 ██████  ███████ ██   ████ ███████ ██   ██ ██  ██████      █████  ███████ 
Generic JS Functions
*/


/**
 * Checks if 2 arrays have the same values
 * [2, 4] and [4, 2] is considered equal
 * 
 * @param {array} arr1 - first array
 * @param {array} arr2 - second array
 * @return {boolean}  - true or false
 */
function arraysEqual(arr1, arr2) {

    if (!Array.isArray(arr1) || ! Array.isArray(arr2) || arr1.length !== arr2.length) {
        return false;
    }

    const fArr1 = arr1.concat().sort();
    const fArr2 = arr2.concat().sort();

    for (let i = 0; i < fArr1.length; i++) {
        if (fArr1[i] !== fArr2[i]) {
            return false;
        }
    }

    return true;

}

/**
 * Get (all) options of a Select dropdown
 * https://stackoverflow.com/a/7760197
 * @param {string}  jQuery       - the jQuery string, like '#selectBox'
 * @param {boolean} [all=false]  - true: get all option items, false: just get selected option items
 * 
 */
function getSelectOptions(jQuery, all=false) {
    if (!all) {
        return $(jQuery).val();
    } else {
        const options = $(`${jQuery} option`);
        const values = $.map(options, function(option) {
            return option.value;
        });
        return values;
    }
}