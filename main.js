/* eslint-disable no-irregular-whitespace */
'use strict';
/**
 * ioBroker Smart Control Adapter
 *
 * @github  https://github.com/Mic-M/ioBroker.smartcontrol
 * @forum   https://forum.iobroker.net/topic/36728/
 * @author  Mic-M <https://github.com/Mic-M/ioBroker.smartcontrol>
 * @license MIT
 * 
 * Developer Notes:
 *  - A few ASCII blocks are being used for ease of code section identification. I've used
 *    http://patorjk.com/software/taag/#p=display&v=3&f=ANSI%20Regular&t=smart%20control%20adapter
 */

// ioBroker Adapter core module
const utils = require('@iobroker/adapter-core');

/**
 * Main Adapter Class
 * @class SmartControl
 */
class SmartControl extends utils.Adapter {

    /**
     * Constructor
     * @param {Partial<utils.AdapterOptions>} [options={}]  Adapter Options
     */
    constructor(options) {
        
        super( {...options, name: 'smartcontrol'} ); // to access the object's parent

        this.on('ready',        this._asyncOnReady.bind(this));
        this.on('stateChange',  this._asyncOnStateChange.bind(this));
        this.on('unload',       this._onUnload.bind(this));


        // adapter-specific objects being set here for global availability in adapter.x
        // We are using 'x' to avoid potential namespace conflicts
        this.x = {

            /**
             * Load Modules
             * VS Code: For all NPM modules, open console, change dir to "C:\iobroker\node_modules\ioBroker.<AdapterName>",
             *            and execute "npm install <module name>", ex: npm install suncalc2
             */
            constants: require('./lib/constants.js'),     // Adapter constants
            helper:    require('./lib/helper.js')(this),  // Generic JavaScript and ioBroker Adapter methods - https://forum.iobroker.net/post/484620
            Trigger:   require('./lib/trigger-class.js'), // Class for Triggers and Target devices handling
            mSuncalc:  require('suncalc2'),               // https://github.com/andiling/suncalc2
            mSchedule: require('node-schedule'),          // https://github.com/node-schedule/node-schedule

            // {object} timers    - All timer objects.
            timersZoneOff: {},    // for option "offAfter" in Zones table

            // {object} schedules - All schedules (node-schedule)
            // NOTE: different level as in 'timers', key value holds the schedule object.
            schedules: {
                midnight: null,
                // more schedule keys added later, as key: name of row of tableTriggerTimes
            }, 

            // Motion trigger should not set timeout if target device was turned on previously without a motion trigger.
            // Ref. https://forum.iobroker.net/post/433871 | https://forum.iobroker.net/post/437803
            motionTriggeredDevices: [],

            // ioBroker system configuration object (the common object of it), set in _asyncOnReady()
            // Has key names like: city, country, longitude, latitude, language, tempUnit, currency, dateFormat, isFloatComma, licenseConfirmed, defaultHistory, activeRepo, diag
            systemConfig: {}, 

            // Keep triggerName and timestamp for checking for limitTriggerInterval to not switch more than x secs
            onStateChangeTriggers: {},

            // Instances of Trigger class with trigger name as key name, and the class instance as value
            triggers: {},

            // Zones Status - currently switched on/off, like {'Bathroom': true, 'Couch':false}- initialized in _asyncOnReady() with false
            zonesIsOn: {},

        };
        
    }

    
    /**
     * Called once ioBroker databases are connected and adapter received configuration.
     */
    async _asyncOnReady() {

        try {

            // Get system configuration
            const sysConf = await this.getForeignObjectAsync('system.config');
            if (sysConf && sysConf.common) {
                this.x.systemConfig = sysConf.common;
            } else {
                throw(`ioBroker system configuration not found.`);
            }
            
            // Warning if latitude / longitude not defined
            if (!this.x.systemConfig.latitude || !this.x.systemConfig.longitude) {
                this.log.warn('Latitude/Longitude is not defined in your ioBroker main configuration, so you will not be able to use Astro functionality for schedules!');
            }

            /**
             * For testing: create test states
             */
            await this.x.helper.asyncCreateStates(this.x.constants.testStates);


            /**
             * Create smartcontrol.x.info.astroTimes states.
             */
            if (this.x.systemConfig.latitude && this.x.systemConfig.longitude) {

                const statesToBeCreated = [];
                for (let i = 0; i < this.x.constants.astroTimes.length; i++) {
                    const lpAstro = this.x.constants.astroTimes[i];
                    const statePathMain = `${this.namespace}.info.astroTimes.${this.x.helper.zeroPad(i+1, 2)}_${lpAstro}`;
                    const commonMain = { name: `${lpAstro} – ${this.x.constants.astroTimesGerman[i]}`, type: 'string', read: true, write: false, role: 'value', def: '' };
                    statesToBeCreated.push({statePath:statePathMain, commonObject:commonMain});
    
                    // Also, create timestamps
                    const statePathTs = `${this.namespace}.info.astroTimes.timeStamps.${lpAstro}`;
                    const commonTs = { name: `${lpAstro} – ${this.x.constants.astroTimesGerman[i]}`, type: 'number', read: true, write: false, role: 'value', def: 0 };
                    statesToBeCreated.push({statePath:statePathTs, commonObject:commonTs});
                }
                // Now create the states
                const createStatesResult = await this.x.helper.asyncCreateStates(statesToBeCreated);
                if (!createStatesResult) throw (`Certain error(s) occurred in asyncCreateStates().`);
    
                // Set current astro values
                await this._asyncOnReady_asyncRefreshAstroStates();

            }

            /**
             * Create smartcontrol.x.userstates states
             */
            const statePathsUsed = []; // to delete unused states
            for (const lpRow of this.config.tableTriggerDevices) {
                const statePath = `userstates.${lpRow.stateId}`;
                const statePathFull = `${this.namespace}.${statePath}`;
                if(lpRow.userState) { // We also create states for inactive rows, since user likely deactivates temporarily.
                    if (this.x.helper.isStateIdValid(`${this.namespace}.${statePath}`)) {
    
                        const stateCommonString =  {name:`User trigger '${lpRow.name}' of 'Other Devices' in Zones table`, type:'string', read:true, write:true, role:'state', def:'' };
                        const stateCommonBoolean = {name:`User trigger '${lpRow.name}' of 'Other Devices' in Zones table`, type:'boolean', read:true, write:true, role:'state', def:false };

                        const lpStateObject = await this.getObjectAsync(statePath);
                        if (!lpStateObject) {
                            // State does not exist
                            let stateObj = {};
                            if(lpRow.stateVal=='true' || lpRow.stateVal=='false') {
                                stateObj = {statePath:statePath, commonObject:stateCommonBoolean};
                            } else {
                                stateObj = {statePath:statePath, commonObject:stateCommonString};
                            }
                            await this.x.helper.asyncCreateStates(stateObj, false); // Create state
                            this.log.debug(`User state '${statePathFull}' created per option table 'Other Devices'.`);
                        } else {
                            // State exists. Now let's check if the "type" changed from boolean to string or vice versa.
                            const isStateConfValBoolean = (lpRow.stateVal=='true' || lpRow.stateVal=='false') ? true : false;
                            const isStateRealValBoolean = (lpStateObject.common.type == 'boolean' || lpStateObject.common.type == 'switch') ? true : false;
                            if (isStateConfValBoolean != isStateRealValBoolean) {
                                const newCommon = (isStateConfValBoolean) ? stateCommonBoolean : stateCommonString;
                                this.log.debug(`User state '${statePathFull}' - state type changed, so delete old state and create new one.`);
                                await this.delObjectAsync(statePath); // Delete state. 
                                await this.x.helper.asyncCreateStates({statePath:statePath, commonObject:newCommon}, false);
                            }
                        }
                        statePathsUsed.push(statePathFull);
                    } else {
                        throw(`State path '${this.namespace}.${statePath}' is not valid.`);
                    }
                }
            }
            // Delete states no longer needed
            const allUserStates = await this.getStatesOfAsync('userstates');
            if (allUserStates == undefined) throw (`Could not get adapter instance state paths for 'userstates'.`);
            
            for (const lpState of allUserStates) {
                const existingStatePath = lpState._id; // like: 'smartcontrol.0.userstates.Coffeemaker'
                if ( statePathsUsed.indexOf(existingStatePath) == -1 ) {
                    // State is no longer used.
                    await this.delObjectAsync(existingStatePath); // Delete state.                
                    this.log.debug(`State '${existingStatePath}' deleted, since trigger does no longer exist.'`);
                }
            }

            /**
             * Validate Adapter Admin Configuration
             */
            if (await this._asyncVerifyConfig(this.x.constants.configTableValidation)) {
                this.log.info('Adapter admin configuration successfully validated...');
            } else {
                // Error(s) occurred. We already logged error message(s) by the function, so no more log needed here
                this.setState('info.connection', false, true); // change to yellow
                return; // Go out.
            }

            /**
             * Create smartcontrol.x.targetDevices.xxx states.
             */
            const statesToBeCreated = [];
            const statePaths = [];
            for (const lpRow of this.config.tableTargetDevices) {
                if (!lpRow.active) continue;
                const lpStatePath = `${this.namespace}.targetDevices.${lpRow.name.trim()}`;
                if (! this.x.helper.isStateIdValid(lpStatePath) ) throw(`Invalid state name portion provided in table 'Target Devices': '${lpRow.name}'`);
                const lpCommon = { name: lpRow.name, type: 'boolean', read: true, write: true, role: 'switch', def: false };
                statesToBeCreated.push({statePath:lpStatePath, commonObject:lpCommon});
                statePaths.push(lpStatePath);
            }
            // Create all states
            const createStatesResult = await this.x.helper.asyncCreateStates(statesToBeCreated);
            if (!createStatesResult) throw (`Certain error(s) occurred in asyncCreateStates().`);

            // Delete all states which are no longer used.
            const allTargetDevicesStates = await this.getStatesOfAsync('targetDevices');
            if (allTargetDevicesStates == undefined) throw (`getStatesOfAsync(): Could not get adapter instance state paths for 'targetDevices'.`);

            for (const lpState of allTargetDevicesStates) {
                const statePath = lpState._id; // like: 'smartcontrol.0.targetDevices.Coffeemaker'
                if ( statePaths.indexOf(statePath) == -1 ) {
                    // State is no longer used.
                    await this.delObjectAsync(statePath); // Delete state.                
                    this.log.debug(`State '${statePath}' deleted, since option does no longer exist.'`);
                }
            }

            /**
             * Create smartcontrol.x.options.xxx states
             */
            const statesFull = []; // with common objects
            const statePathsOnly = [];
    
            const tablesToProcess = ['tableTriggerMotion', 'tableTriggerDevices', 'tableTriggerTimes', 'tableTargetDevices', 'tableZones', 'tableConditions'];
            let errorCounter = 0;
            for (let i = 0; i < tablesToProcess.length; i++) {
    
                for (let k = 0; k < this.config[tablesToProcess[i]].length; k++) {
                
                    const lpRow = this.config[tablesToProcess[i]][k];
                    let lpStateSubSection = tablesToProcess[i]; // Table name from config, like 'tableTargetDevices';
                    lpStateSubSection = lpStateSubSection.substr(5); // 'tableTargetDevices' => 'TargetDevices'
    
                    // Get the name of the table row and convert to a valid state portion.
                    const lpRowNameStatePortion = lpRow.name;  // like: 'Motion Bathroom' or 'At 04:05 every Sunday'
                    if (this.x.helper.isLikeEmpty(lpRow.name.trim())) {
                        continue; // We do not add rows with blank name
                    }
    
                    for (const fieldName in lpRow){
    
                        const fieldEntry = lpRow[fieldName]; // like 'smartcontrol.0.Test.light.Bathroom'
                        if(fieldName != 'active' && fieldName != 'name') {
                            continue;
                        }
    
                        const lpCommonObject = {};

                        // Define the common object to create the state
                        lpCommonObject.name = (fieldName != 'active') ? fieldName : 'Please note: Changing this state restarts the adapter instance to put the change into effect';
                        lpCommonObject.read = true;
                        lpCommonObject.write = true;
                        lpCommonObject.role = 'value';

                        // We convert all all to string, except to 'active'.
                        // Reason: User input in adapter settings is string as well. And so Users can change a state from 'true' to like 'Radio is playing'.
                        if (fieldName == 'active') {
                            // active check box of table row should always be boolean and not string.
                            lpCommonObject.type = 'boolean';
                            lpCommonObject.def  = fieldEntry;                            
                        } else {
                            // all others
                            lpCommonObject.type = 'string';
                            lpCommonObject.def  = (typeof fieldEntry != 'string') ? JSON.stringify(fieldEntry) : fieldEntry;
                        }

                        // Don't allow to change the 'name'
                        if (fieldName == 'name') {
                            lpCommonObject.write = false;
                        }

                        const lpStatePath = `${this.namespace}.options.${lpStateSubSection}.${lpRowNameStatePortion}.${fieldName}`; // Like: 'options.TargetDevices.Bathroom Light'
                        if (! this.x.helper.isStateIdValid(`${this.namespace}.${lpStatePath}`) ) {
                            this.log.error(`[${tablesToProcess[i]}] We were not able to generate a valid state path. This is what was determined to be not valid: [${lpStatePath}].`);
                            errorCounter++;
                            continue;
                        }
    
                        statesFull.push({statePath:lpStatePath, commonObject:lpCommonObject });
                        statePathsOnly.push(lpStatePath);
                      
                    }
                }
            }
    
            if (errorCounter > 0) {
                throw(`${errorCounter} error(s) occurred while processing state generation of options.`);
            } else if (statesFull.length == 0) {
                throw(`No states to be created determined while processing state generation of options.`);
            }

            // Create states
            const res = await this.x.helper.asyncCreateStates(statesFull, false);
            if (!res) {
                throw(`Certain error(s) occurred in asyncCreateStates().`);
            }

            // Delete all states which are no longer used.
            const allAdapterStates = await this.getStatesOfAsync('options');
            if (allAdapterStates != undefined) {
                for (const lpState of allAdapterStates) {
                    const statePath = lpState._id; // like: 'smartcontrol.0.options.Zones.Hallway.name'
                    if ( (statePathsOnly.indexOf(statePath) == -1) && (statePath.endsWith('active') || (statePath.endsWith('name') ) ) ) {
                        // State is no longer used.
                        await this.delObjectAsync(statePath); // Delete state.                
                        this.x.helper.logExtendedInfo(`State '${statePath}' deleted, since option does no longer exist.'`);
                    }
                }
            }

            // Update option states. Required if admin options were changed and saved (which restarts adapter).
            for (const lpStatePath of statePathsOnly) {

                // {name:'Hallway', index:2, table:'tableZones', field:'active', row:{.....} }
                const optionObj = await this._asyncGetOptionForOptionStatePath(lpStatePath);

                // Set the state
                let val;
                if(typeof optionObj.row[optionObj.field] == 'object') {
                    val = JSON.stringify(optionObj.row[optionObj.field]);
                } else {
                    val = optionObj.row[optionObj.field];
                }
                await this.setStateAsync(lpStatePath, {val:val, ack:true});

            }

            /**
             * Prepare Zones Status, setting per default to false (Zone is off)
             */
            for (const lpZoneRow of this.config.tableZones) {
                if (lpZoneRow.active) {
                    this.x.zonesIsOn[lpZoneRow.name] = false;
                }
            }            
            

            /**
             * Init Trigger instances of Trigger class for each trigger
             */
            // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
            const allTriggerRows = this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices, this.config.tableTriggerTimes);
            for (const lpTriggerRow of allTriggerRows) {
                if (lpTriggerRow.active) {
                    const triggerName = lpTriggerRow.name;
                    this.x.triggers[triggerName] = new this.x.Trigger(this, triggerName);
                }
            }



            /**
             * STATE SUBSCRIPTIONS
             */

            // STATE SUBSCRIPTION: to all smartcontrol.x.targetDevices states
            await this.subscribeStatesAsync('targetDevices.*');

            // STATE SUBSCRIPTION: to all on/off states of tableTargetDevices
            for (const lpRow of this.config.tableTargetDevices) {
                if (lpRow.active) {
                    await this.subscribeForeignStatesAsync(lpRow.onState);
                    await this.subscribeForeignStatesAsync(lpRow.offState);
                }
            }

            // STATE SUBSCRIPTION: to all 'smartcontrol.x.options.x.x.active'
            await this.subscribeStatesAsync('options.*.active');


            // STATE SUBSCRIPTION: to all trigger states
            // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
            for (const lpRow of this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices)) {
                if (lpRow.active) {
                    const statePath = lpRow.stateId; // like '0_userdata.0.motion-sensor.Bathroom.motion' 
                    await this.subscribeForeignStatesAsync(statePath); // Info: we already validated in asyncVerifyConfig() if state exists
                }
            }

            // STATE SUBSCRIPTION: to all tableTargetDevices state changes - "off" states only
            /*
             sc.logExtendedInfo('Subscribing to all target device off states...');
            for (const lpRow of this.config.tableTargetDevices) {
                if (lpRow.active) {
                    const statePath = lpRow.offState; // like 'smartcontrol.0.Test.light.Bathroom' 
                    await this.subscribeForeignStatesAsync(statePath); // Info: we already validated in asyncVerifyConfig() if state exists
                }
            }
            */

            /**
             * Schedule all trigger times
             */
            const numTriggers = await this._asyncOnReady_asyncScheduleTriggerTimes();

            /**
             * Re-schedule all trigger times every midnight. Also, refresh astro states.
             * This is required since we are supporting astro times (suncalc)
             */            
            this.x.schedules.midnight = this.x.mSchedule.scheduleJob('0 0 * * *', () => {
                this._asyncOnReady_asyncScheduleTriggerTimes();
                if (this.x.systemConfig.latitude && this.x.systemConfig.longitude) this._asyncOnReady_asyncRefreshAstroStates();
                this.x.helper.logExtendedInfo(`Re-scheduling time triggers for updating astro times and updating 'info.astroTimes.' states.`);
            });

            this.log.info(`Subscribing to all target devices and trigger states. ${numTriggers} trigger schedules activated...`);
            this.setState('info.connection', true, true); // change to green

        } catch (error) {
            this.x.helper.dumpError('[_asyncOnReady()]', error);
            this.setState('info.connection', false, true); // change to yellow
            return;
        }

    }

    /**
     * Schedule all trigger times of Trigger Times table
     * 
     * @return {Promise<number>}   number of schedules activated.
     */
    async _asyncOnReady_asyncScheduleTriggerTimes() {

        try {
            
            let counter = 0;
            for (const lpRow of this.config.tableTriggerTimes) {
                if (lpRow.active) {

                    // Convert non-crons to cron
                    let cron = '';
                    if (this.x.helper.isCronScheduleValid(lpRow.time.trim())) {
                        cron = lpRow.time.trim();
                    } else {
                        const ts = this.x.helper.getTimeInfoFromAstroString(lpRow.time, true).timestamp;
                        if (ts == 0) {
                            this.log.warn(`No valid time in Trigger Times table, row ${lpRow.name}: ${lpRow.time}`);
                            continue;
                        }
                        const date = new Date(ts);
                        cron = `${date.getMinutes()} ${date.getHours()} * * *`;
                    }

                    this.x.schedules[lpRow.name] = this.x.mSchedule.scheduleJob(cron, async () => {

                        const triggerName = lpRow.name;
                        const trigger = this.x.triggers[triggerName]; // Trigger class instance

                        // First check if additional conditions are met or "never if"
                        let doContinue = await trigger.asyncAreScheduleConditionsMet(trigger.triggerTmAdditionCond, trigger.triggerTmAddCondAll);
                        if (doContinue) doContinue = await trigger.asyncAreScheduleConditionsMet(trigger.triggerTmNever, trigger.triggerTmNeverAll, true);
                        if(!doContinue) {
                            this.x.helper.logExtendedInfo(`Execution table row ${triggerName} (time: ${trigger.triggerTime}) triggered, but condition(s) not met.`);
                            return;
                        }
                        this.log.debug(`Execution table row ${triggerName} (time: ${trigger.triggerTime}) triggered.`);
                        trigger.asyncSetTargetDevices();
                        
                    });
                    counter++;

                }
            }
            return counter;

        } catch (error) {
            this.x.mSchedule.dumpError('[_asyncOnReady_asyncScheduleTriggerTimes]', error);
            return 0;
        }    

    }

    /**
     * Refresh the astro states under smartcontrol.x.info.astroTimes
     */
    async _asyncOnReady_asyncRefreshAstroStates() {

        try {

            for (let i = 0; i < this.x.constants.astroTimes.length; i++) {
                const lpAstro = this.x.constants.astroTimes[i];

                const ts = this.x.helper.getAstroNameTs(lpAstro);
                const astroTimeStr = this.x.helper.timestampToTimeString(ts, true);
                await this.setStateAsync(`info.astroTimes.${this.x.helper.zeroPad(i+1, 2)}_${lpAstro}`, {val: astroTimeStr, ack: true });
                
                await this.setStateAsync(`info.astroTimes.timeStamps.${lpAstro}`, {val: ts, ack: true });

            }

        } catch (error) {
            this.x.helper.dumpError('[_asyncOnReady_asyncRefreshAstroStates()]', error);
            return false;            
        }

    }



    /**
     * Initialized by Class constructor and called once a subscribed state changes
     * 
     * @param {string}                            statePath       State Path
     * @param {ioBroker.State | null | undefined} stateObject     State object
     */
    async _asyncOnStateChange(statePath, stateObject) {

        try {

            if (!stateObject) {
                // this.log.debug(`Subscribed state '${statePath}' was deleted.`);
                return;
            }

            // this.log.debug(`Subscribed state '${statePath}' changed, new val: [${stateObject.val}] (ack: ${stateObject.ack}).`);

            // Check acknowledge (ack)
            const ackPassingResult = await this.x.helper.isAckPassing(statePath, stateObject);
            if ( ! ackPassingResult.passing ) {
                this.log.debug(`State Change: IGNORED – state '${statePath}' change: ack '${stateObject.ack}' - ${ackPassingResult.msg}`);
                return;
            } else {
                this.log.debug(`State Change: ACCEPTED – state '${statePath}' change: ack '${stateObject.ack}' - ${ackPassingResult.msg}`);
            }

            /**
             * State Change: smartcontrol.0.options.XXX.XXX.active
             */
            if (statePath.startsWith(`${this.namespace}.options.`) && statePath.endsWith('.active')) {
                this.log.debug(`State Change: smartcontrol.0.options.XXX.XXX.active - Subscribed state '${statePath}' changed.`);

                // {name:'Hallway', index:2, table:'tableZones', field:'active', row:{.....} }
                const optionObj = await this._asyncGetOptionForOptionStatePath(statePath);
    
                // Check if new value != old value
                if (optionObj.row[optionObj.field] == stateObject.val) {
                    this.log.info(`Smart Control Adapter State '${statePath}' changed to '${stateObject.val}', but is equal to old state val, so no action at this point.`);
                } else {
                    // Info
                    this.x.helper.logExtendedInfo(`Smart Control Adapter State '${statePath}' changed to '${stateObject.val}'.`);
        
                    // Acknowledge State Change
                    await this.setStateAsync(statePath, {val:stateObject.val, ack: true});
        
                    // Set config change into adapter configuration. This will also restart the adapter instance by intention.
                    // Restart is required since an activation or deactivation of a table row has multiple effects.
                    this.log.info(`State change of '${statePath}' to '${stateObject.val}' now executes an adapter instance restart to put the change into effect.`);
                    const resultObject = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
                    if (resultObject) {
                        resultObject.native[optionObj.table][optionObj.index][optionObj.field] = stateObject.val;
                        await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, resultObject);
                    } else {
                        throw('getForeignObjectAsync(): No object provided from function.');
                    }
                }
            } 

            /**
             * State Change: smartcontrol.0.targetDevices.xxx
             */                
            else if (statePath.startsWith(`${this.namespace}.targetDevices.`)) {
                this.log.debug(`State Change: smartcontrol.0.targetDevices.xxx - Subscribed state '${statePath}' changed.`);

                let targetDevicesRow = {};
                for (const lpRow of this.config.tableTargetDevices) {
                    if (!lpRow.active) continue;  
                    if (`${this.namespace}.targetDevices.${lpRow.name}` == statePath) {
                        targetDevicesRow = lpRow;
                        break;
                    }
                }
                if(this.x.helper.isLikeEmpty(targetDevicesRow)) throw (`Table 'Target Devices': No row found for state path ${statePath}`);
    
                // Set target states.
                // Note: Verification of the state value and conversion as needed was performed already by asyncVerifyConfig()
                const w = (stateObject.val) ? 'on' : 'off';
                await this.setForeignStateAsync(targetDevicesRow[w+'State'], {val: targetDevicesRow[w+'Value'], ack: false });
    
                // confirm by ack:true
                await this.setStateAsync(statePath, {val: stateObject.val, ack: true });

            } 

            /**
             * State Change: tableTargetDevices: on/off states
             */
            else if (
                (this.getOptionTableValue('tableTargetDevices', 'onState', statePath, 'name') != undefined)
                || (this.getOptionTableValue('tableTargetDevices', 'offState', statePath, 'name') != undefined)
            ) {                    
                this.log.debug(`State Change: tableTargetDevices: on/off states - Subscribed state '${statePath}' changed.`);
                for (const lpRow of this.config.tableTargetDevices) {
                    if (!lpRow.active) continue;  
                    if (lpRow.onState != statePath && lpRow.onState != statePath) continue;
    
                    if (lpRow.onState == statePath && lpRow.onValue == stateObject.val) {
                        await this.setStateAsync(`targetDevices.${lpRow.name}`, {val: true, ack: true });
                        this.log.debug(`State '${statePath}' changed to '${stateObject.val}' -> '${this.namespace}.targetDevices.${lpRow.name}' set to true.`);
                    } else if (lpRow.offState == statePath && lpRow.offValue == stateObject.val) {
                        await this.setStateAsync(`targetDevices.${lpRow.name}`, {val: false, ack: true });
                        this.log.debug(`State '${statePath}' changed to '${stateObject.val}' -> '${this.namespace}.targetDevices.${lpRow.name}' set to false.`);
                    }
                }
            }


            /**
             * State Change: Trigger of tableTriggerMotion or tableTriggerDevices
             */                    
            else if (
                (this.getOptionTableValue('tableTriggerMotion', 'stateId', statePath, 'name') != undefined)
                || (this.getOptionTableValue('tableTriggerDevices', 'stateId', statePath, 'name') != undefined)
            ) {
                this.log.debug(`State Change: Trigger of tableTriggerMotion or tableTriggerDevices - Subscribed state '${statePath}' changed.`);
                this.asyncDoOnTriggerActivated(statePath, stateObject);
            }

            /**
             * State Change: Everything else
             */
            else {
                this.log.debug(`State '${statePath}' is subscribed and currently changed, but no action defined in this function to proceed with this state change, which is most likely fine!`);
            }



        } catch (error) {
            this.x.helper.dumpError('[_asyncOnStateChange]', error);
        }

    }


    /**
     * Called once adapter shuts down; initialized by Class constructor.
     * @param {() => void} callback
     */
    _onUnload(callback) {

        try {

            /**
             * Clear all timeouts
             */
            let timeoutCounter = 0;

            // Zone off timers
            for (const timerName in this.x.timersZoneOff) {
                // We need getTimeoutTimeLeft() for logging purposes only, but since we have the value, we are using it for firing clearTimeout condition as well.
                const timeLeft = this.x.helper.getTimeoutTimeLeft(this.x.timersZoneOff[timerName]);
                if (timeLeft > -1) {
                    this.x.helper.logExtendedInfo('Clearing currently running zone timer: ' + timerName);
                    clearTimeout(this.x.timersZoneOff[timerName]);
                    this.x.timersZoneOff[timerName] = null;
                    timeoutCounter++;
                }

            }

            // Motion timers
            for (const triggerName in this.x.triggers) {
                const timeLeft = this.x.helper.getTimeoutTimeLeft(this.x.triggers[triggerName]);
                if (timeLeft > -1) {
                    this.x.helper.logExtendedInfo('Clearing currently running motion timer: ' + triggerName);
                    clearTimeout(this.x.triggers[triggerName]);
                    clearTimeout(this.x.triggers[triggerName]);
                    this.x.triggers[triggerName] = null;
                    timeoutCounter++;
                }
            }
            this.log.info(`(${timeoutCounter}) timers were active and have been cleared...`);

            /**
             * Clear all Schedules
             */
            let scheduleCounter = 0;
            for (const lpScheduleName in this.x.schedules) {
                this.log.debug('Cancelling schedule: ' + lpScheduleName);
                this.x.schedules[lpScheduleName].cancel();
                scheduleCounter++;
            }
            this.log.info(`(${scheduleCounter}) schedules cleared...`);

            /**
             * Completed
             */
            this.log.info('Stopping adapter instance successfully proceeded...');
            callback(); // Callback must be called under any circumstances!

        } catch (error) {
            this.x.helper.dumpError('Error while stopping adapter instance', error);
            callback(); // Callback must be called under any circumstances!
        }
    }


    /**
     * Get the table option for a given option state
     * @param {string} statePath  like 'smartcontrol.0.options.Zones.Hallway.active'
     *                              or 'smartcontrol.0.options.Zones.Flur EG.Lichter.Wandlicht 1.active'
     * @return {Promise<object>}    { name:'Hallway',
     *                                index:2, // index of the table
     *                                table:'tableZones',
     *                                tableName:'Zones 
     *                                field:'active'
     *                                row:{}   // The full row  }
    //  */
    async _asyncGetOptionForOptionStatePath(statePath) {

        try {
            
            if ( statePath.startsWith(`options.`) ) {
                statePath = `${this.namespace}.${statePath}`;
            }
            const statePathSplit = statePath.split('.');
            const stOptionTable = statePathSplit[3]; // Like 'Zones'
            const stOptionName = statePathSplit.slice(4, statePathSplit.length-1).join('.'); // Like 'Hallway' or '.Zones.Flur EG.Lichter.Wandlicht 1'
            const stOptionField = statePathSplit[statePathSplit.length-1]; // Like 'active'
            let cName; // The final Option name from state 'smartcontrol.0.options.Zones.Hallway.name'
            try {
                const state = await this.getStateAsync(`options.${stOptionTable}.${stOptionName}.name`);
                if (state) {
                    cName = state.val;
                } else {
                    throw(`Unable to get state value of statePath '${statePath}'`);
                }
            } catch (error) { 
                this.x.helper.dumpError(`Error getting state 'options.${stOptionTable}.${stOptionName}.name'`, error);
                return {};
            }
            
            // Find option table index
            let index = -1;
            if(stOptionTable == 'Schedules') {
                // Different handling for "tabSchedules" since we have '01_xxx', '02_xxx', etc. as name.
                const num = parseInt(stOptionName.substr(0,2));
                if(this.x.helper.isNumber(num)) {
                    index = num-1;
                } else {
                    throw(`We were not able to convert leading 'xx_' of '${stOptionField}' to a number.`);
                }

            } else {
                for (let i = 0; i < this.config['table' + stOptionTable].length; i++) {
                    if (this.config['table' + stOptionTable][i].name == cName) {
                        // We have a hit.
                        index = i;
                        break;
                    }
                }
                if (index == -1) {
                    throw(`Unable to find option name '${cName}' in adapter settings, table '${'table' + stOptionTable}'.`);
                }
            }

            // Check if the actual key, like 'active', exists in adapter options object
            if (! (stOptionField in this.config['table'+stOptionTable][index]) ) {
                throw(`Key '${stOptionField}' not found in adapter settings, table '${'table' + stOptionTable}'.`);
            }

            return {
                name:       cName, 
                index:      index, 
                table:      'table' + stOptionTable, 
                tableName:  stOptionTable,
                field:      stOptionField, 
                row:        this.config['table' + stOptionTable][index]
            };

        } catch (error) {
            this.x.helper.dumpError('Error', error);
        }

    }


    /**
     * Verify adapter configuration table
     * @param {array} functionConfigArray    Array of what to check
     * @return {Promise<boolean>}   passed   Returns true if no issues, and false if error(s).
     */
    async _asyncVerifyConfig(functionConfigArray) {

        try {
            
            let errors = 0;
            let validTriggerCounter = 0;

            // FIRST: Check the config array
            for (const functionConfigObj of functionConfigArray) {

                /**
                 * Prepare the table(s). Typically we only have one table to check, however, 'tableZoneExecution' requires
                 * multiple tables (per each row of Table Zones)
                 */
                const tablesToCheck = []; // Array holding all tables to check. Will be just one element, except to 'tableZoneExecution'
                if (!(functionConfigObj.tableId == 'tableZoneExecution')) {
                    // settings of adapter config table, like of 'tableTargetDevices'
                    tablesToCheck.push({table:this.config[functionConfigObj.tableId]}); 
                } else {
                    
                    let counter = 0;
                    for (const lpZoneRow of this.config.tableZones) {
                        if (lpZoneRow.active) {
                            const tbl = (this.x.helper.isLikeEmpty(lpZoneRow.executionJson)) ? [] : JSON.parse(lpZoneRow.executionJson);
                            tablesToCheck.push({zoneTableRowNo:counter, executeAlways:lpZoneRow.executeAlways, table:tbl}); 
                        }
                        counter++;
                    }
                }

                /**
                 * Handle each table
                 */
                for (const lpTable of tablesToCheck) {
                    if (lpTable.executeAlways) continue; // Skip if executeAlways is activated

                    // For Zone Table Execution only: set "better" table name for log
                    if(lpTable.zoneTableRowNo != undefined) {
                        functionConfigObj.tableName = `Zone: ${this.config.tableZones[lpTable.zoneTableRowNo].name}, Execution`;
                    }

                    // Active status of each row; We simply push true or false in loop, same index as table rows (lpTable.table)
                    const rowActiveStatus = [];
                
                    if (this.x.helper.isLikeEmpty(lpTable.table)) {
                        if(functionConfigObj.tableMustHaveActiveRows) {
                            this.log.warn('[Config Table \'' + functionConfigObj.tableName + '\'] No rows defined.');
                            errors++;
                        }
                        continue;
                    } 
                
                    for (let i = 0; i < lpTable.table.length; i++) {
                        // -- deactivated for 0.1.1-beta.2 - we should also validate de-activated table items, as these 
                        //    can be switched on thru smartcontrol.x.options.xxx.xxx.active
                        // if (!lpTable.table[i].active) continue;

                        // Returns all object keys starting with 'check_' as array, like ['check_1','check_2']. Or empty array, if not found.
                        const lpCriteriaToCheck = (Object.keys(functionConfigObj).filter(str => str.includes('check_'))); 
                        
                        for (const lpCheckKey of lpCriteriaToCheck) {

                            // lpCheckKey = check_1, or check_2, etc. 
                            // lpFcnConfigCheckObj = like {id: 'triggers', type:'name', deactivateIfError:true, removeForbidden:true }
                            const lpFcnConfigCheckObj = functionConfigObj[lpCheckKey]; 

                            // Special for tableTriggerDevices - userState
                            const isUserState = ((functionConfigObj.tableId == 'tableTriggerDevices') && lpTable.table[i].userState) ? true : false;

                            // Config table: the string from config table row, like '0.userdata.0.abc.def', 'true', 'false', 'Play Music', etc.
                            let lpConfigString = lpTable.table[i][lpFcnConfigCheckObj.id];

                            // +++++++ VALIDATION TYPE: a state path like "0_userdata.0.teststate" +++++++
                            if (lpFcnConfigCheckObj.type == 'statePath') {

                                lpConfigString = lpConfigString.trim();

                                if ( this.x.helper.isLikeEmpty(lpConfigString) && lpFcnConfigCheckObj.optional) {
                                    // Skip if empty state and field is optional
                                    continue;
                                }

                                // Special treatment for tableTriggerDevices, User States
                                if (isUserState) {
                                    if(!lpConfigString.startsWith(this.namespace + '.userstates.')) {
                                        lpConfigString = this.namespace + '.userstates.' + lpConfigString;
                                    }
                                }

                                if (!this.x.helper.isStateIdValid(lpConfigString)) {
                                    // State path is not valid
                                    this.log.warn(`[Config Table '${functionConfigObj.tableName}'] ${lpFcnConfigCheckObj.id} - State '${lpConfigString}' is not valid.`);
                                    if (lpFcnConfigCheckObj.deactivateIfError) {
                                        lpTable.table[i].active = false;
                                        rowActiveStatus[i] = false;
                                    }
                                    errors++; 
                                    continue;
                                }

                                if (!isUserState) {
                                    const lpStateObject = await this.getForeignObjectAsync(lpConfigString);
                                    if (!lpStateObject) {
                                        // State does not exist
                                        this.log.warn(`[Config Table '${functionConfigObj.tableName}'] State '${lpConfigString}' does not exist.`);
                                        if (lpFcnConfigCheckObj.deactivateIfError) {
                                            lpTable.table[i].active = false;
                                            rowActiveStatus[i] = false;
                                        }
                                        errors++; 
                                        continue;
                                    }
                                }

                                // We altered lpConfigString, so set to adapter config.
                                lpTable.table[i][lpFcnConfigCheckObj.id] = lpConfigString;
                                

                            // +++++++ VALIDATION TYPE: stateValue -- a value to be set to a certain state +++++++
                            } else if (lpFcnConfigCheckObj.type == 'stateValue') {

                                const lpStatePath       = lpTable.table[i][lpFcnConfigCheckObj.stateValueStatePath];
                                const lpStateVal        = lpConfigString;
                                const lpIsOptional      = lpFcnConfigCheckObj.optional;
                                const lpConfigTableName = functionConfigObj.tableName;
                                
                                const stateValueResult = await this._asyncVerifyConfig_verifyStateValue(lpStatePath, lpStateVal, lpIsOptional, lpConfigTableName);

                                if (stateValueResult.validationFailed) {
                                    if (lpFcnConfigCheckObj.deactivateIfError) {
                                        lpTable.table[i].active = false;
                                        rowActiveStatus[i] = false;
                                    }
                                    errors++; 
                                    continue;
                                } else {
                                    if ('newStateVal' in stateValueResult) {
                                        this.config[functionConfigObj.tableId][i][lpFcnConfigCheckObj.id] = stateValueResult.newStateVal;
                                    }
                                }
                    
                            // +++++++ VALIDATION TYPE: a number +++++++
                            } else if (lpFcnConfigCheckObj.type == 'number') {

                                const lpNumberToCheck = lpTable.table[i][lpFcnConfigCheckObj.id];

                                if (this.x.helper.isLikeEmpty(lpNumberToCheck) && lpFcnConfigCheckObj.optional ) {
                                    // Skip if empty and if is optional. 
                                    continue;
                                }

                                if(! this.x.helper.isNumber(lpNumberToCheck) ) {
                                    this.log.warn(`[Config Table ${functionConfigObj.tableName}] Field ${lpFcnConfigCheckObj.id} is expecting a number, but you set '${lpConfigString}'.`);
                                    if (lpFcnConfigCheckObj.deactivateIfError) lpTable.table[i].active = false;
                                    errors++; 
                                    continue;
                                // check for lower limit, if 'numberLowerLimit' set in functionConfigObj object
                                } else if (! this.x.helper.isLikeEmpty(lpFcnConfigCheckObj.numberLowerLimit)) {
                                    if(parseInt(lpNumberToCheck) < lpFcnConfigCheckObj.numberLowerLimit) {
                                        this.log.warn('[Config Table \'' + functionConfigObj.tableName + '\'] Number in field "' + lpFcnConfigCheckObj.id + '" is smaller than ' + lpFcnConfigCheckObj.numberLowerLimit + ', which does not make sense.');
                                        if (lpFcnConfigCheckObj.deactivateIfError) {
                                            lpTable.table[i].active = false;
                                        }
                                        errors++; 
                                        continue;
                                    }
                                // check for upper limit, if 'numberUpperLimit' set in functionConfigObj object
                                } else if (! this.x.helper.isLikeEmpty(lpFcnConfigCheckObj.numberUpperLimit)) { 
                                    if(parseInt(lpNumberToCheck) < lpFcnConfigCheckObj.numberUpperLimit) {
                                        this.log.warn('[Config Table \'' + functionConfigObj.tableName + '\'] Number in field "' + lpFcnConfigCheckObj.id + '" is greater than ' + lpFcnConfigCheckObj.numberUpperLimit  + ', which does not make sense.');
                                        if (lpFcnConfigCheckObj.deactivateIfError) lpTable.table[i].active = false;
                                        errors++;
                                        continue;
                                    }
                                }
                            // +++++++ VALIDATION TYPE: name (which can also be a drop down with multiple values) +++++++
                            } else if (lpFcnConfigCheckObj.type == 'name') {
                                let lpToCheck = lpTable.table[i][lpFcnConfigCheckObj.id];
                                
                                // Trim
                                if (Array.isArray(lpToCheck)) {
                                    for (let i = 0; i < lpToCheck.length; i++) {
                                        lpToCheck[i] = lpToCheck[i].trim();
                                    }
                                } else {
                                    lpToCheck = lpToCheck.trim();
                                }

                                // Handle forbidden state path chars
                                if (lpFcnConfigCheckObj.removeForbidden) {
                                    let checkForbiddenArray = [];
                                    if (Array.isArray(lpToCheck)) {
                                        checkForbiddenArray = lpToCheck; // we have an array (like pulldown menu)
                                    } else {
                                        checkForbiddenArray.push(lpToCheck); // we have a string
                                    }
                                    for (let i = 0; i < checkForbiddenArray.length; i++) {
                                        const forbidden = this.x.helper.forbiddenCharsInStr(checkForbiddenArray[i], this.x.constants.forbiddenStatePaths);
                                        if (forbidden) {
                                            // We have forbidden state paths
                                            this.x.helper.logExtendedInfo(`[Config Table '${functionConfigObj.tableName}'] Field value '${checkForbiddenArray[i]}' contains forbidden character(s) '${forbidden}', so we remove from string.`);
                                            if (Array.isArray(lpToCheck)) {
                                                lpToCheck[i] = lpToCheck[i].replace(this.x.constants.forbiddenStatePaths, '');
                                            } else {
                                                lpToCheck = lpToCheck.replace(this.x.constants.forbiddenStatePaths, '');
                                            }
                                        }    
                                    }
                                }

                                if (this.x.helper.isLikeEmpty(lpToCheck) &&  !lpFcnConfigCheckObj.optional) {
                                    this.log.warn('[Config Table \'' + functionConfigObj.tableName + '\'] Field "' + lpFcnConfigCheckObj.id + '" is empty.');
                                    if (lpFcnConfigCheckObj.deactivateIfError) lpTable.table[i].active = false;
                                    errors++; 
                                    continue;
                                }
                                
                                // We altered lpToCheck, so set to adapter config.
                                lpTable.table[i][lpFcnConfigCheckObj.id] = lpToCheck;


                            // +++++++ VALIDATION TYPE: time and timeCron +++++++
                            // -- We test for both "time" and "timeCron".
                            } else if (lpFcnConfigCheckObj.type.substring(0, 4) == 'time') {
                                const lpToCheck = lpTable.table[i][lpFcnConfigCheckObj.id];
                                let isValidTime = false;
                                if (this.x.helper.getTimeInfoFromAstroString(lpToCheck, false) ) {
                                    isValidTime = true;
                                } else if (lpFcnConfigCheckObj.type == 'timeCron' && this.x.helper.isCronScheduleValid(lpToCheck.trim())) {
                                    isValidTime = true;
                                }
                                if (!isValidTime) {
                                    this.log.warn(`[Config Table '${functionConfigObj.tableName}'] No valid time in field '${lpFcnConfigCheckObj.id}': '${lpConfigString}'`);
                                    if (lpFcnConfigCheckObj.deactivateIfError) lpTable.table[i].active = false;
                                    errors++; 
                                    continue;
                                }


                            // +++++++ VALIDATION TYPE: overwrite +++++++
                            // -- for tableZones -> targetsOverwrite
                            } else if (lpFcnConfigCheckObj.type == 'overwrite') {

                                // Like: "targetsOverwrite": { "Bath.Light": "true", "Hallway Light": "50"}
                                const targetsOverwriteObject = this.config[functionConfigObj.tableId][i][lpFcnConfigCheckObj.id];
                                if (this.x.helper.isLikeEmpty(targetsOverwriteObject)) continue; // nothing at this point
                                    
                                // loop thru the object to get the key name ("property")
                                for (const lpProperty in targetsOverwriteObject) {
                                    const name = lpProperty; // like 'Bath.Light'
                                    const lpStateVal        = targetsOverwriteObject[lpProperty];
                                    const lpConfigTableName = functionConfigObj.tableName;
                                    const lpStatePath = this.getOptionTableValue('tableTargetDevices', 'name', name, 'onState');
                                    
                                    
                                    if (!lpStatePath) {
                                        // This is actually handled already by verifying table Target Devices, so no error here.    
                                        continue;
                                        // throw(`Unexpected Error - Unable to retrieve state path by name '${name}' from tableTargetDevices.`);
                                    } 

                                    // Verify
                                    const stateValueValidationResult = await this._asyncVerifyConfig_verifyStateValue(lpStatePath, lpStateVal, true, lpConfigTableName);

                                    if (stateValueValidationResult.validationFailed) {
                                        if (lpFcnConfigCheckObj.deactivateIfError) lpTable.table[i].active = false;
                                        errors++; 
                                        continue;
                                    } else {
                                        this.config[functionConfigObj.tableId][i][lpFcnConfigCheckObj.id][name] = stateValueValidationResult.newStateVal;
                                    }
                                }
                            }
                        }
                        if(functionConfigObj.isTriggerTable) validTriggerCounter++;

                    }
                    let activeRowCounter = 0;
                    for (const lpRow of lpTable.table) {
                        if (lpRow.active) activeRowCounter++;
                    }

                    if (activeRowCounter == 0  && functionConfigObj.tableMustHaveActiveRows && !functionConfigObj.isTriggerTable) {
                        this.log.warn(`[Config Table '${functionConfigObj.tableName}'] No active rows defined (certain rows may have been deactivated due to errors, see previous logs for details).`);
                        errors++;
                    } 

                    // We altered table variable, so set into adapter config
                    if (!(functionConfigObj.tableId == 'tableZoneExecution')) {
                        this.config[functionConfigObj.tableId] = lpTable.table;
                    } else {
                        // @ts-ignore - Type 'undefined' cannot be used as an index type
                        this.config.tableZones[lpTable.zoneTableRowNo].executionJson = JSON.stringify(lpTable.table);
                    }

                }

            }
            if (validTriggerCounter == 0) {
                this.log.warn('No active and valid trigger defined in any trigger table.');
                errors++;                    
            }



            // SECOND: Certain table values must be unique.
            // TODO: Add to constants.js
            const uniqueCheckObjects = [
                // name: for logging only, column: the table to check, rows: the adapter config table rows
                // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
                { name:'Trigger Tables: Names',        column:'name',          rows:this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices, this.config.tableTriggerTimes) },
                { name:'Target device table: Names',                column:'name',    rows:this.config.tableTargetDevices },
                { name:'Zones table: Names',                    column:'name',      rows:this.config.tableZones },
                { name:'Conditions table: Names',                   column:'name', rows:this.config.tableConditions },
                // { name:'Trigger Tables Motion/Other: State Paths',  column:'stateId',       rows:this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices) },
            ];
            for (const lpCheckObj of uniqueCheckObjects) {
                if (!this.x.helper.isLikeEmpty(lpCheckObj.rows)) {
                    const allValues = [];
                    for (const lpRow of lpCheckObj.rows) {
                        if(lpRow.active) {
                            allValues.push(lpRow[lpCheckObj.column]);
                        }
                    }
                    if ( !this.x.helper.isArrayUnique(allValues) ) {
                        this.log.error(`${lpCheckObj.name} must be unique. You cannot use same string more than once here.`);
                        errors++;
                    }
                }
            }


            // FINALIZE
            if (errors == 0) {
                return true;
            } else {
                this.log.error(`[User Error (Anwenderfehler)] - ${errors} error(s) found in adapter configuration --> Please check the previous warn log for details and then correct your configuration accordingly. You must fix these issue(s) to use this adapter.`);
                return false;
            }

        } catch (error) {
            this.x.helper.dumpError('[asyncVerifyConfig()]', error);
            return false;
        }
    }


    /**
     * Verifies a state value
     * 
     * @param {string} statePath
     * @param {*} stateVal
     * @param {boolean} isOptional 
     * @param {string} configTableName -- name of config table, for log only
     * @return {Promise<object>}   {validationFailed:false, newStateVal:'xyz'}
     */
    async _asyncVerifyConfig_verifyStateValue(statePath, stateVal, isOptional, configTableName) {

        try {

            // Remove any brackets at beginning and end
            stateVal = stateVal.replace(/^(\[|"|'|`|´)([\s\S]*)(]|"|'|`|´)$/, '$2');

            // Trim again
            stateVal = stateVal.trim();

            if ( this.x.helper.isLikeEmpty(statePath.trim()) || (this.x.helper.isLikeEmpty(stateVal) && isOptional) ) {
                // Skip if empty and if is optional. 
                // We also check if the state path is empty. 
                return {validationFailed:false, newStateVal:''};
            }

            const lpStateObject = await this.getForeignObjectAsync(statePath);
            
            if (!lpStateObject) {
                // State does not exist
                this.log.warn(`[Config Table '${configTableName}'] State '${statePath}' does not exist.`);
                return {validationFailed:true};
            } else {
                // State exists
                // Verify State Type (like boolean, switch, number)
                const stateType = lpStateObject.common.type;

                if (stateType == 'boolean' || stateType == 'switch') {
                    if (stateVal != 'true' && stateVal != 'false') {
                        this.log.warn(`[Config Table '${configTableName}'] State '${statePath}' is expecting boolean (true/false), but you set '${stateVal}'.`);
                        return {validationFailed:true};
                    } else {
                        if (stateVal == 'true') stateVal = true;
                        if (stateVal == 'false') stateVal = false;
                        return {validationFailed:false, newStateVal:stateVal};
                    }
                } else if (stateType == 'number') {
                    // We allow comparators '<', '>=' etc.
                    const isComparator = (/^(>=|<=|>|<)\s?(\d{1,})$/.test(stateVal.trim()));
                    if (isComparator) {
                        return {validationFailed:false, newStateVal:stateVal};
                    } else if (this.x.helper.isNumber(stateVal)) {
                        return {validationFailed:false, newStateVal:parseFloat(stateVal)};
                    } else {
                        this.log.warn(`[Config Table ${configTableName}] State ${statePath} is expecting a number, but you set '${stateVal}'.`);
                        return {validationFailed:true};
                    }
                } else if (this.x.helper.isLikeEmpty(stateVal)) {
                    // Let's convert an "like empty" value to an empty string, just to make sure....
                    return {validationFailed:false, newStateVal:''};
                } else {
                    // Nothing to do at this point; return 
                    return {validationFailed:false, newStateVal:stateVal};
                }
            }            
        } catch (error) {
            this.x.helper.dumpError('[verifyStateValue()]', error);
            return {validationFailed:true};
        }

    }




    /**
     * Retrieves a value of an admin option table
     * 
     * Call example: const res = this.getOptionTableValue('tableTargetDevices', 'name', 'Bathroom Light', 'offState');
     * 
     * @param {string}  tableId          The id of the table, like 'tableTargetDevices'
     * @param {string}  identifierId     The column id of the identifier, like 'name'
     * @param {string}  identifierName   Like 'Bathroom Light'
     * @param {string}  resultId         The column id of the value we need, like 'offState'
     * @return {*}                       The value, or undefined if nothing found.
     */
    getOptionTableValue(tableId, identifierId, identifierName, resultId) {
        for (const tableRow of this.config[tableId]) {
            if (tableRow.active) {
                if (tableRow[identifierId] == identifierName) {
                    return tableRow[resultId];
                } else {
                    continue; // no hit
                }
            } else {
                continue;
            }
        }
        return undefined; // Nothing found
    }


    /**
     * Called once a trigger was activated (i.e. a motion or other trigger state changed)
     * For the given state, we retrieve all triggers and do some verifications.
     * @param {string}                        statePath      State Path of the trigger
     * @param {ioBroker.State|null|undefined} stateObject    State object
     * @fires trigger.asyncSetTargetDevices() Called if all verifications were successful.
     */
    async asyncDoOnTriggerActivated (statePath, stateObject) {

        try {

            if (!stateObject || !statePath || stateObject.val == null) return;

            // Get all trigger names which contain the statePath (per asyncVerifyConfig(), names are unique)
            // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
            const allTriggerRows = this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices);
            const triggerNames = [];
            for (const lpTriggerRow of allTriggerRows) {
                if (lpTriggerRow.active && lpTriggerRow.stateId == statePath) {
                    triggerNames.push(lpTriggerRow.name);
                }
            }
            if (triggerNames.length == 0) {
                throw(`No trigger found for '${statePath}'`);
            }

            // Loop through all trigger names
            for (const lpTriggerName of triggerNames) {
  
                if (!this.x.triggers[lpTriggerName]) {
                    this.log.debug(`Trigger '${lpTriggerName}': not not found for ${statePath}. This is likely caused by user (invalid configuration).`);
                    continue;
                }
                const trigger = this.x.triggers[lpTriggerName];

                /**
                 * Motion sensor changed to false (no motion).
                 * In this case, we will not switch any target devices, but set a timer to turn targets off.
                 */
                if (trigger.triggerIsMotion && stateObject.val===false) {

                    // We start timer to switch devices off
                    if (!trigger.zoneNames || !trigger.zoneTargetNames) {
                        this.x.helper.logExtendedInfo(`Motion sensor ${lpTriggerName} changed to false, but no zone name or zone target names found which were switched on before.`);
                    } else {
                        for (const lpZoneName of trigger.zoneNames) {
                            trigger.asyncSetZoneTimer_motion(lpZoneName);
                        }
                    }
                    continue; // Motion sensor to false - so we can go out here.

                }

                /**
                 * Motion sensor changed to true.
                 * Clear motion timer
                 */
                if (trigger.triggerIsMotion && stateObject.val===true) {
                    clearTimeout(trigger.motionTimer);
                    trigger.motionTimer = null;
                }

                /**
                 * Verify if state value that was set matches with the config
                 */
                // Check for >=, <=, >, <  and number, so like '>= 3', '<7'
                let comparatorSuccess = false;
                if (trigger.triggerTableId == 'tableTriggerDevices' && (typeof trigger.triggerStateVal == 'string') ) {
                    const matchComparator = trigger.triggerStateVal.match(/^(>=|<=|>|<)\s?(\d{1,})$/);
                    if (matchComparator != null) {
                        // String like ">= 30" found.
                        const operand = matchComparator[1];
                        const num = parseFloat(matchComparator[2]);
                        if (operand == '>=' && Number(stateObject.val) >= num ) {
                            comparatorSuccess = true;
                        } else if (operand == '<=' && Number(stateObject.val) <= num ) {
                            comparatorSuccess = true;
                        } else if (operand == '>' && Number(stateObject.val) > num ) {
                            comparatorSuccess = true;
                        } else if (operand == '<' && Number(stateObject.val) < num ) {
                            comparatorSuccess = true;
                        } else {
                            this.log.debug(`Trigger '${lpTriggerName}' activated, but not meeting 'comparator' condition (trigger state val: '${trigger.triggerStateVal}'), therefore, we disregard the activation.`);
                            continue; // We go out since we have a comparator, but not matching
                        }
                    }

                }
                
                /**
                 * Compare state value with config
                 */
                if (!comparatorSuccess && trigger.triggerStateVal != undefined && trigger.triggerStateVal != stateObject.val ) {
                    this.log.debug(`Trigger '${lpTriggerName}' activated, but not meeting conditions (triggerStateVal '${trigger.triggerStateVal}' != stateObject.val '${stateObject.val}' ), therefore, we disregard the activation.`);
                    continue; // Go out since no match
                }
                
                /**
                 * Do not switch more often than x seconds
                 */
                let threshold = parseInt(this.config.limitTriggerInterval); // in seconds
                if(!threshold || !this.x.helper.isNumber(threshold) || threshold < 1) threshold = 1;
                const formerTs = this.x.onStateChangeTriggers[trigger.triggerName];
                const currTs = Date.now();
                this.x.onStateChangeTriggers[trigger.triggerName] = currTs;
                if (formerTs && ( (formerTs + (threshold*1000)) > currTs)) {
                    this.log.info(`Trigger '${trigger.triggerName}' was already activated ${Math.round(((currTs-formerTs) / 1000) * 100) / 100} seconds ago and is ignored. Must be at least ${threshold} seconds.`);
                    continue;
                }
    
                /**
                 * All conditions passed -> set all target devices
                 */
                trigger.asyncSetTargetDevices();

            }

        } catch (error) {
            this.x.helper.dumpError('[asyncDoOnTriggerActivated]', error);
            return false;
        }

    }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new SmartControl(options);
} else {
    // otherwise start the instance directly
    new SmartControl();
}