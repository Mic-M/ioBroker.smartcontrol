// This will be called by the admin adapter when the settings page loads

// ++++++ Define variables for option tables ++++++
let tableTriggerMotion = [];
let tableTriggerDevices = [];
let tableTriggerTimes = [];
let tableTargetDevices = [];
let tableCombinedDevices = [];
let tableZones = [];
let tableConditions = [];
let tableSchedules = [];
const adapterNamespace = `smartcontrol.${instance}`;

/************** LOAD ********************************************************
*** This will be called by the admin adapter when the settings page loads ***
****************************************************************************/
function load(settings, onChange) {
    // example: select elements with id=key and class=value and insert value
    if (!settings) return;

    $('.value').each(function () {
        const $key = $(this);
        const id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id])
                .on('change', () => onChange())
            ;
        } else {
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(settings[id])
                .on('change', () => onChange())
                .on('keyup', () => onChange())
            ;
        }
    });
    
    // ++++++ For option tables ++++++
    tableTriggerMotion = settings.tableTriggerMotion || [];
    tableTriggerDevices = settings.tableTriggerDevices || [];
    tableTriggerTimes = settings.tableTriggerTimes || [];
    tableTargetDevices = settings.tableTargetDevices || [];
    tableCombinedDevices = settings.tableCombinedDevices || [];
    tableZones = settings.tableZones || [];
    tableConditions = settings.tableConditions || [];
    tableSchedules = settings.tableSchedules || [];

    onChange(false);

    // ++++++ For option tables ++++++
    // see iobroker/node_modules/iobroker.admin/www/js/adapter-settings.js
    values2table('tableTriggerMotion', tableTriggerMotion, onChange, statePopupTableTriggerMotion); 
    values2table('tableTriggerDevices', tableTriggerDevices, onChange, statePopupTableTriggerDevices); // <-- added statePopupTableTriggerDevices
    values2table('tableTriggerTimes', tableTriggerTimes, onChange);
    values2table('tableTargetDevices', tableTargetDevices, onChange, statePopupTableTargetDevices); // <-- added statePopupTableTargetDevices
    values2table('tableCombinedDevices', tableCombinedDevices, onChange);
    values2table('tableZones', tableZones, onChange);
    values2table('tableConditions', tableConditions, onChange, statePopupTableConditions); // <-- added statePopupTableConditions
    values2table('tableSchedules', tableSchedules, onChange);

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    

    // Enhance Tabs with onShow-Function. Source: iqontrol Adapter.
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

            case "#tabMain":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
            break;

            case "#tabDevices":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
            break;

            case "#tabConditions":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
            break;

            case "#tabTriggers":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable('tableConditions', 'name', 'tableTriggerTimes', tableTriggerTimes, 'additionalConditions');
                populateTable('tableConditions', 'name', 'tableTriggerTimes', tableTriggerTimes, 'never');
            break;

            case "#tabZones":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable(['tableTriggerMotion', 'tableTriggerDevices', 'tableTriggerTimes'], ['name', 'name', 'name'], 'tableZones', tableZones, 'triggers');
                populateTable('tableTargetDevices', 'name', 'tableZones', tableZones, 'targets');
            break;

            case "#tabSchedules":
                $('.collapsible').collapsible(); // https://materializecss.com/collapsible.html
                populateTable('tableZones', 'name', 'tableSchedules', tableSchedules, 'name');
                populateTable('tableConditions', 'name', 'tableSchedules', tableSchedules, 'additionalConditions');
                populateTable('tableConditions', 'name', 'tableSchedules', tableSchedules, 'never');
            break;
        
        }
    }        

    /**
     * Populate select field
     * @param {*}  sourceTableIds   Id of input table, like "tableTriggerMotion". String or array of strings for multiple tables
     * @param {*}  sourceFieldIds   Id of table line field, from which to get content, like "name". . String or array of strings for multiple fields
     * @param {string}  targetTableId   Target table id, like "tableZones"
     * @param {array}   targetTableArr  Target table array, like tableZones variable
     * @param {string}  targetFieldId   Target table line field, like 'Test'
     * @param {string}  [addFirstItem]    Optional string to add as first item of drop-down.
     */
    function populateTable(sourceTableIds, sourceFieldIds, targetTableId, targetTableArr, targetFieldId, addFirstItem = '') {
        if(!Array.isArray(sourceTableIds)) sourceTableIds = [sourceTableIds]; // wrap into array
        if(!Array.isArray(sourceFieldIds)) sourceFieldIds = [sourceFieldIds]; // wrap into array
        let result = [];
        if (addFirstItem) result.push(addFirstItem);
        for (let i = 0; i < sourceTableIds.length; i++) {
            const configTbl = settings[sourceTableIds[i]] || [];
            for (let lpElement of configTbl) {
                //if (lpElement['active'] == true) { // check for checkbox "active"
                result.push(lpElement[sourceFieldIds[i]]); 
                //}
            }
        }
        // Create dropdown menu
        $('*[data-name="' + targetFieldId + '"]').data('options', result.join(';'));
        // Fill table
        values2table(targetTableId, targetTableArr, onChange);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    

    // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
    if (M) M.updateTextFields();

    // ##############################################################################
    // FOR selectID.js (node_modules/iobroker.admin/www/lib/js/)
    // If 'data-buttons' in table th is not set to a known keyword (like 'edit'), it uses 'add' as materialize icon.
    // We modify this icon by replacing 'add' with an icon of our choice: https://materializecss.com/icons.html
    const tables = [
        'tableTargetDevices', 
        'tableConditions',
        'tableTriggerMotion',
        'tableTriggerDevices',
    ];
    for (const lpTableId of tables) {
        $(`#${lpTableId} .table-values tr i.material-icons`).each(function() {
            let text = $(this).text().replace('add', 'zoom_in');
            $(this).text(text);
        });                
    }
    // ##############################################################################


} // load


// For selectID.js (node_modules/iobroker.admin/www/lib/js/)
function statePopupTableTargetDevices() {
    statePathPopupSelection('tableTargetDevices','stateSelectPopupOnState', 'onState');
    statePathPopupSelection('tableTargetDevices','stateSelectPopupOffState', 'offState');
}
function statePopupTableConditions() {
    statePathPopupSelection('tableConditions','stateSelectPopupConditionState', 'conditionState');
}
function statePopupTableTriggerMotion() {
    statePathPopupSelection('tableTriggerMotion','stateSelectPopupMotionState', 'stateId');
    statePathPopupSelection('tableTriggerMotion','stateSelectPopupBriState', 'briStateId');
}
function statePopupTableTriggerDevices() {
    statePathPopupSelection('tableTriggerDevices','stateSelectPopupStateId', 'stateId');
}


/**
 * Opens the popup menu for state selection.
 * Using selectID.js (node_modules/iobroker.admin/www/lib/js/)
 * It monitors a button for a click, and writes the selected state into a field.
 *
 * @param {string}  tableId     - The id of the table, like 'tableTargetDevices'
 * @param {string}  dataCommand - Name of [data-buttons="edit1"] of the <th>. so like 'edit1'.
                                     If you use multiple buttons per table row, use like 'edit1', 'edit2' for 'data-buttons=' in <th>
    * @param {string}  targetField - The target field, like 'onState' (of data-name="onState")
    */
function statePathPopupSelection(tableId, dataCommand, targetField) {

    $(`#${tableId} .table-values-div .table-values .values-buttons[data-command="${dataCommand}"]`).on('click', function () {
        let id = $(this).data('index');
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
//XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX


// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    // example: select elements with class=value and build settings object
    var obj = {};
    $('.value').each(function () {
        var $this = $(this);
        if ($this.attr('type') === 'checkbox') {
            obj[$this.attr('id')] = $this.prop('checked');
        } else {
            obj[$this.attr('id')] = $this.val();
        }
    });
    // ++++++ For option tables ++++++
    obj.tableTriggerMotion = table2values('tableTriggerMotion');
    obj.tableTriggerDevices = table2values('tableTriggerDevices');
    obj.tableTriggerTimes = table2values('tableTriggerTimes');
    obj.tableTargetDevices = table2values('tableTargetDevices');
    obj.tableCombinedDevices = table2values('tableCombinedDevices');
    obj.tableZones = table2values('tableZones');
    obj.tableConditions = table2values('tableConditions');
    obj.tableSchedules = table2values('tableSchedules');

    callback(obj);
}

/**
 * From: selectID.js (node_modules/iobroker.admin/www/lib/js/)
 * Name "dialog-select-member" is important, because for that exist the CSS classes
 * Important to have "admin/img/big-info.png", because this icon will be loaded if no icon found, otherwise we have endless loop
 */
var selectId;
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
