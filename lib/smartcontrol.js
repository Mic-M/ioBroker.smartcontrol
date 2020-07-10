'use strict';

/**
 * Library
 *
 * @class Library
 * @description Library of various functions.
 * @author Mic-M <https://github.com/Mic-M/>
 * @license MIT License
 */
class Library {

    /**
     * Constructor
     *
     * @param    {object}    adapter        ioBroker adapter object
     * @param    {object}    sunCalc        suncalc
     * @param    {object}    schedule       https://github.com/node-schedule/node-schedule
     *
     */
    constructor(adapter, sunCalc, schedule) {
        this._adapter = adapter;
        this._sunCalc = sunCalc;
        this._Schedule = schedule;
        this.latitude = 0;
        this.longitude = 0;
        this._timers = {}; // Here we keep all timers
        this._timers.motion = {};
        this._schedules = {}; // Here we keep all schedules (node-schedule)
        this._onStateChangeStates = {};  // Once a subscribed state changes, we keep the state path and its timestamp
        this.forbiddenStatePaths = /[\][*,;'"`<>\\?]/g; // Source: https://github.com/ioBroker/ioBroker.js-controller/blob/master/lib/adapter.js - Version 3.1.6
        this.astroTimes = ['nightEnd', 'nauticalDawn', 'dawn', 'sunrise', 'sunriseEnd', 'goldenHourEnd', 'solarNoon', 'goldenHour', 'sunsetStart', 'sunset', 'dusk', 'nauticalDusk', 'night', 'nadir'];
        this.astroTimesGerman = ['Ende der Nacht', 'Nautische Morgendämmerung', 'Morgendämmerung', 'Sonnenaufgang', 'Ende des Sonnenaufgangs', 'Ende der goldenen Stunde', 'Mittag', 'Goldene Abendstunde', 'Start des Sonnenuntergangs', 'Sonnenuntergang', 'Dämmerung Abends', 'Nautische Dämmerung Abends', 'Start der Nacht', 'Mitternacht'];
    }


    /**
     * Create smartcontrol.x.info.astroTimes states.
     * 
     * @return {Promise<boolean>}   true if successful, false if not.
     */
    async asyncCreateAstroStates() {

        try {
            const statesToBeCreated = [];

            for (let i = 0; i < this.astroTimes.length; i++) {
                const lpAstro = this.astroTimes[i];
                const statePathMain = `${this._adapter.namespace}.info.astroTimes.${this.zeroPad(i+1, 2)}_${lpAstro}`;
                const commonMain = { name: `${lpAstro} – ${this.astroTimesGerman[i]}`, type: 'string', read: true, write: false, role: 'value', def: '' };
                statesToBeCreated.push({statePath:statePathMain, commonObject:commonMain});

                // Also, create timestamps
                const statePathTs = `${this._adapter.namespace}.info.astroTimes.timeStamps.${lpAstro}`;
                const commonTs = { name: `${lpAstro} – ${this.astroTimesGerman[i]}`, type: 'number', read: true, write: false, role: 'value', def: 0 };
                statesToBeCreated.push({statePath:statePathTs, commonObject:commonTs});


            }

            // Create all states
            const createStatesResult = await this.asyncCreateStates(statesToBeCreated);
            if (!createStatesResult) throw (`Certain error(s) occurred in asyncCreateStates().`);

            // Set current astro values
            await this.refreshAstroStatesAsync();

            return true;

        } catch (error) {
            this.dumpError('[asyncCreateAstroStates()]', error);
            return false;
        }        
    }

    /**
     * Refresh the astro states under smartcontrol.x.info.astroTimes
     */
    async refreshAstroStatesAsync() {

        try {

            for (let i = 0; i < this.astroTimes.length; i++) {
                const lpAstro = this.astroTimes[i];

                const ts = this.getAstroNameTs(lpAstro, this.latitude, this.longitude);
                const astroTimeStr = this.timestampToTimeString(ts, true);
                await this._adapter.setStateAsync(`info.astroTimes.${this.zeroPad(i+1, 2)}_${lpAstro}`, {val: astroTimeStr, ack: true });
                
                await this._adapter.setStateAsync(`info.astroTimes.timeStamps.${lpAstro}`, {val: ts, ack: true });

            }

        } catch (error) {
            this.dumpError('[refreshAstroStatesAsync()]', error);
            return false;            
        }

    }




    /**
     * This is called once a foreign, target device changes of table tableTargetDevices: on/off states
     * 
     * @param {string}                            statePath    - State Path
     * @param {ioBroker.State | null | undefined} stateObject  - State object
     */
    async handleStateChangeTargetForeignTargets(statePath, stateObject) {

        try {

            if(!stateObject || !statePath) return;

            for (const lpRow of this._adapter.config.tableTargetDevices) {
                if (!lpRow.active) continue;  
                if (lpRow.onState != statePath && lpRow.onState != statePath) continue;

                if (lpRow.onState == statePath && lpRow.onValue == stateObject.val) {
                    await this._adapter.setStateAsync(`targetDevices.${lpRow.name}`, {val: true, ack: true });
                    this.logExtendedInfo(`State '${statePath}' changed to '${stateObject.val}' -> 'targetDevices.${lpRow.name}' set to true.`);
                } else if (lpRow.offState == statePath && lpRow.offValue == stateObject.val) {
                    await this._adapter.setStateAsync(`targetDevices.${lpRow.name}`, {val: false, ack: true });
                    this.logExtendedInfo(`State '${statePath}' changed to '${stateObject.val}' -> 'targetDevices.${lpRow.name}' set to true.`);
                }
            }

        } catch (error) {
            this.dumpError('[handleStateChangeTargetForeignTargets]', error);
            return;
        }        

    }


    /**
     * This is called once an adapter state changes like 'smartcontrol.0.targetDevices.BathroomRadio'
     * 
     * @param {string}                            statePath    - State Path
     * @param {ioBroker.State | null | undefined} stateObject  - State object
     */
    async handleStateChangeTargetDevices(statePath, stateObject) {

        try {

            if(!stateObject || !statePath) return;
            let targetDevicesRow = {};
            for (const lpRow of this._adapter.config.tableTargetDevices) {
                if (!lpRow.active) continue;  
                if (`${this._adapter.namespace}.targetDevices.${lpRow.name}` == statePath) {
                    targetDevicesRow = lpRow;
                    break;
                }
            }
            if(this.isLikeEmpty(targetDevicesRow)) throw (`Table 'Target Devices': No row found for state path ${statePath}`);

            // Set target states.
            // Note: Verification of the state value and conversion as needed was performed already by asyncVerifyConfig()
            const w = (stateObject.val) ? 'on' : 'off';
            await this._adapter.setForeignStateAsync(targetDevicesRow[w+'State'], {val: targetDevicesRow[w+'Value'], ack: false });

            // confirm by ack:true
            await this._adapter.setStateAsync(statePath, {val: stateObject.val, ack: true });
            
        } catch (error) {
            this.dumpError('[handleStateChangeTargetDevices]', error);
            return;
        }        

    }



    /**
     * This is called once an adapter state changes like 'smartcontrol.0.options.Zones.Hallway.active'
     * 
     * @param {string}                            statePath    - State Path
     * @param {ioBroker.State | null | undefined} stateObject  - State object
     */
    async handleStateChangeOptionsActive(statePath, stateObject) {

        try {

            if(!stateObject || !statePath) return;

            // {name:'Hallway', index:2, table:'tableZones', field:'active', row:{.....} }
            const optionObj = await this.asyncGetOptionForOptionStatePath(statePath);

            // Check if new value != old value
            if (optionObj.row[optionObj.field] == stateObject.val) {
                this._adapter.log.info(`Smart Control Adapter State '${statePath}' changed to '${stateObject.val}', but is equal to old state val, so no action at this point.`);
                return;
            }

            // Info
            this.logExtendedInfo(`Smart Control Adapter State '${statePath}' changed to '${stateObject.val}'.`);

            // Acknowledge State Change
            await this._adapter.setStateAsync(statePath, {val:stateObject.val, ack: true});

            // Set config change into adapter configuration.
            // This will also restart the adapter instance by intention.
            // Restart is required since an activation or deactivation of a table row has multiple effects.
            this._adapter.log.info(`State change of '${statePath}' to '${stateObject.val}' now executes an adapter instance restart to put the change into effect.`);
            const resultObject = await this._adapter.getForeignObjectAsync(`system.adapter.${this._adapter.namespace}`);
            if (resultObject) {
                resultObject.native[optionObj.table][optionObj.index][optionObj.field] = stateObject.val;
                await this._adapter.setForeignObjectAsync(`system.adapter.${this._adapter.namespace}`, resultObject);
                return;
            } else {
                throw('getForeignObjectAsync(): No object provided from function.');
            }

        } catch (error) {
            this.dumpError('[handleStateChangeOptionsActive()]', error);
            return;
        }        

    }


    /**
     * Get the option for a given state option
     * 
     * @param {string} statePath  like 'smartcontrol.0.options.Zones.Hallway.active'
     * 
     * @return {Promise<object>}    { 
     *                                name:'Hallway',
     *                                index:2, // index of the table
     *                                table:'tableZones',
     *                                tableName:'Zones 
     *                                field:'active'
     *                                row:{}   // The full row
     *                               }
     */
    async asyncGetOptionForOptionStatePath(statePath) {

        try {
            
            if ( statePath.startsWith(`options.`) ) {
                statePath = `${this._adapter.namespace}.${statePath}`;
            }

            const statePathSplit = statePath.split('.');
            const stOptionTable = statePathSplit[3]; // Like 'Zones'
            const stOptionName = statePathSplit[4]; // Like 'Hallway'
            const stOptionField = statePathSplit[5]; // Like 'active'
            let cName; // The final Option name from state 'smartcontrol.0.options.Zones.Hallway.name'
            try {
                const state = await this._adapter.getStateAsync(`options.${stOptionTable}.${stOptionName}.name`);
                if (state) {
                    cName = state.val;
                } else {
                    throw(`Unable to get state value of statePath '${statePath}'`);
                }
            } catch (error) { 
                this.dumpError(`Error getting state 'options.${stOptionTable}.${stOptionName}.name'`, error);
                return {};
            }
            
            // Find option table index
            let index = -1;
            if(stOptionTable == 'Schedules') {
                // Different handling for "tabSchedules" since we have '01_xxx', '02_xxx', etc. as name.
                const num = parseInt(stOptionName.substr(0,2));
                if(this.isNumber(num)) {
                    index = num-1;
                } else {
                    throw(`We were not able to convert leading 'xx_' of '${stOptionField}' to a number.`);
                }

            } else {
                for (let i = 0; i < this._adapter.config['table' + stOptionTable].length; i++) {
                    if (this._adapter.config['table' + stOptionTable][i].name == cName) {
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
            if (! (stOptionField in this._adapter.config['table'+stOptionTable][index]) ) {
                throw(`Key '${stOptionField}' not found in adapter settings, table '${'table' + stOptionTable}'.`);
            }

            return {
                name:       cName, 
                index:      index, 
                table:      'table'+stOptionTable, 
                tableName:  stOptionTable,
                field:      stOptionField, 
                row:        this._adapter.config['table'+stOptionTable][index]
            };

        } catch (error) {
            this.dumpError('Error', error);
        }

    }


    /**
     * Update option states. Required if admin options are being changed.
     */
    async updateOptionStatesFromConfig() {

        try {

            const states = this.generateOptionStates(false, false);

            for (const lpStatePath of states) {

                // {name:'Hallway', index:2, table:'tableZones', field:'active', row:{.....} }
                const optionObj = await this.asyncGetOptionForOptionStatePath(lpStatePath);

                // Set the state
                let val;
                if(typeof optionObj.row[optionObj.field] == 'object') {
                    val = JSON.stringify(optionObj.row[optionObj.field]);
                } else {
                    val = optionObj.row[optionObj.field];
                }
                await this._adapter.setStateAsync(lpStatePath, {val:val, ack:true});

            }

        } catch (error) {
            this.dumpError('[updateOptionStatesFromConfig()]', error);
            return;
        }
        
    }

    /**
     * Create smartcontrol.x.targetDevices.xxx states and delete no longer needed ones.
     * 
     * @return {Promise<boolean>}   true if successful, false if not.
     */
    async asyncCreateTargetDevicesStates() {

        try {

            /*********************************
             * A: Get all states to be created.
             *********************************/            
            const statesToBeCreated = [];
            const statePaths = [];
            for (const lpRow of this._adapter.config.tableTargetDevices) {
                
                if (!lpRow.active) continue;
                const lpStatePath = `${this._adapter.namespace}.targetDevices.${lpRow.name.trim()}`;
                if (! this.isStateIdValid(lpStatePath) ) throw(`Invalid state name portion provided in table 'Target Devices': '${lpRow.name}'`);

                const lpCommon = { name: lpRow.name, type: 'boolean', read: true, write: true, role: 'switch', def: false };
                statesToBeCreated.push({statePath:lpStatePath, commonObject:lpCommon});
                statePaths.push(lpStatePath);
            }

            /*********************************
             * B: Create all states
             *********************************/

            const createStatesResult = await this.asyncCreateStates(statesToBeCreated);
            if (!createStatesResult) throw (`Certain error(s) occurred in asyncCreateStates().`);

            /*********************************
             * B: Delete all states which are no longer used.
             *********************************/
            const allTargetDevicesStates = await this._adapter.getStatesOfAsync('targetDevices');
            if (allTargetDevicesStates == undefined) throw (`getStatesOfAsync(): Could not get adapter instance state paths for 'targetDevices'.`);

            for (const lpState of allTargetDevicesStates) {
                const statePath = lpState._id; // like: 'smartcontrol.0.targetDevices.Coffeemaker'
                if ( statePaths.indexOf(statePath) == -1 ) {
                    // State is no longer used.
                    await this._adapter.delObjectAsync(statePath); // Delete state.                
                    this.logExtendedInfo(`State '${statePath}' deleted, since option does no longer exist.'`);
                }
            }

            return true;

        } catch (error) {
            this.dumpError('[asyncCreateTargetDevicesStates()]', error);
            return false;
        }        
    }

    /**
     * Create option states and delete states no longer used.
     * 
     * @return {Promise<boolean>}   true if successful, false if not.
     */
    async asyncCreateOptionStates() {
        try {
        
            const statesFull = this.generateOptionStates(false, true);
            const statePathsOnly = this.generateOptionStates(false, false);

            /*********************************
             * B: Create all states
             *********************************/

            const res = await this.asyncCreateStates(statesFull, false);
            if (!res) {
                throw(`Certain error(s) occurred in asyncCreateStates().`);
            }

            /*********************************
             * B: Delete all states which are no longer used.
             *********************************/
            const allAdapterStates = await this._adapter.getStatesOfAsync('options');
            if (allAdapterStates != undefined) {
                for (const lpState of allAdapterStates) {
                    const statePath = lpState._id; // like: 'smartcontrol.0.options.Zones.Hallway.name'
                    if ( (statePathsOnly.indexOf(statePath) == -1) && (statePath.endsWith('active') || (statePath.endsWith('name') ) ) ) {
                        // State is no longer used.
                        await this._adapter.delObjectAsync(statePath); // Delete state.                
                        this.logExtendedInfo(`State '${statePath}' deleted, since option does no longer exist.'`);
                    }
                }
            }
            return true;

        } catch (error) {
            this.dumpError('[asyncCreateOptionStates()]', error);
            return false;
        }        
    }


    /**
     * Generate option states
     * 
     * @param {boolean}  all   If true, all options will be created as states, if false: limited to 'active' and 'name'
     * @param {boolean}  [withCommon=false]    If true, with common objects for state creation, false: just the state paths
     * @return {array}   Array of all states that were created.
     * 
     */
    generateOptionStates(all, withCommon=false) {

        const optionsStatesResult = [];
        const tablesToProcess = [
            'tableTriggerMotion',
            'tableTriggerDevices',
            'tableTriggerTimes',
            'tableTargetDevices',
            'tableZones',
            'tableConditions',
            'tableSchedules'
        ];
        let errorCounter = 0;
        for (let i = 0; i < tablesToProcess.length; i++) {

            // tableSchedules needs a special treatment, since we do not have a unique name.
            // We simply add a counter "xx_" at the beginning, where xx is a counter, starting with 1.
            // This will help to determine the array element accordingly.
            const lpTableScheduleRowNames = [];
            if (tablesToProcess[i] == 'tableSchedules') {
                for (let i = 0; i < this._adapter.config['tableSchedules'].length; i++) {
                    lpTableScheduleRowNames.push(this.zeroPad(i+1, 2) + '_' + this._adapter.config['tableSchedules'][i].name);  // Like: '04_Relax Area'
                }
            }

            for (let k = 0; k < this._adapter.config[tablesToProcess[i]].length; k++) {
            
                const lpRow = this._adapter.config[tablesToProcess[i]][k];
            
                // Get table name for the state portion 
                let lpStateSubSection = tablesToProcess[i]; // Table name from config, like 'tableTargetDevices';
                lpStateSubSection = lpStateSubSection.substr(5); // 'tableTargetDevices' => 'TargetDevices'

                // Get the name of the table row and convert to a valid state portion.
                
                let lpRowNameStatePortion = lpRow.name;  // like: 'Motion Bathroom' or 'At 04:05 every Sunday'
                if (this.isLikeEmpty(lpRow.name.trim())) {
                    // We do not add rows with blank name
                    continue;
                }

                // * Special treatment for 'tableSchedules'
                if (tablesToProcess[i] == 'tableSchedules' && !this.isLikeEmpty(lpTableScheduleRowNames)) {
                    lpRowNameStatePortion = lpTableScheduleRowNames[k]; // Like: '04_Relax Area'
                }

                lpRowNameStatePortion = lpRowNameStatePortion.replace(this.forbiddenStatePaths, '');
                if ( lpRowNameStatePortion.length < 3 ) {
                    // !! To do: do this already in config verification function
                    this._adapter.log.debug(`[${tablesToProcess[i]}] Name string cannot be converted to state string portion since less than 3 chars (after removing forbidden chars): [${lpRowNameStatePortion}]`);
                    errorCounter++;
                    continue;
                }

                // for...in to loop through the object (table row)
                for (const fieldName in lpRow){

                    const fieldEntry = lpRow[fieldName]; // like 'smartcontrol.0.Test.light.Bathroom'


                    if(!all && (fieldName != 'active' && fieldName != 'name')) {
                        // If all=false, ignore if not 'active' or 'name'
                        continue;
                    }
                    
                    // We always need the name


                    const lpCommonObject = {};
                    if(withCommon) {

                        // Define the common object to create the state
                        lpCommonObject.name = (fieldName != 'active') ? fieldName : 'Please note: Changing this state restarts the adapter instance to put the change into effect';
                        lpCommonObject.read = true;
                        lpCommonObject.write = true;
                        lpCommonObject.role = 'value';

                        /**
                         * * We convert all all to string, except to 'active'.
                         * * Reason: User input in adapter settings is string as well. And so Users can change a state from 'true' to like 'Radio is playing'.
                         */
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

                    }

                    const lpStatePath = `${this._adapter.namespace}.options.${lpStateSubSection}.${lpRowNameStatePortion}.${fieldName}`; // Like: 'options.TargetDevices.Bathroom Light'
                    if (! this.isStateIdValid(`${this._adapter.namespace}.${lpStatePath}`) ) {
                        this._adapter.log.error(`[${tablesToProcess[i]}] We were not able to generate a valid state path. This is what was determined to be not valid: [${lpStatePath}].`);
                        errorCounter++;
                        continue;
                    }

                    if (withCommon) {
                        optionsStatesResult.push({statePath:lpStatePath, commonObject:lpCommonObject });
                    } else {
                        optionsStatesResult.push(lpStatePath);
                    }
                    
                }
                
            }

        }

        if (errorCounter > 0) {
            this._adapter.log.error(`${errorCounter} error(s) occurred while processing state generation of options.`);
            return [];
        } else if (optionsStatesResult.length == 0) {
            this._adapter.log.error(`No states to be created determined while processing state generation of options.`);
            return [];
        } else {
            return optionsStatesResult;
        }

    }





    /**
     * Schedule all trigger times of Trigger Times table
     */
    scheduleTriggerTimes() {

        let counter = 0;
        for (const lpRow of this._adapter.config.tableTriggerTimes) {
            if (lpRow.active) {

                // Convert non-crons to cron
                let cron = '';
                if (this.isCronScheduleValid(lpRow.time.trim())) {
                    cron = lpRow.time.trim();
                } else {
                    const ts = this.getTimeInfoFromAstroString(lpRow.time, true).timestamp;
                    if (ts == 0) {
                        this._adapter.log.warn(`No valid time in Trigger Times table, row ${lpRow.name}: ${lpRow.time}`);
                        continue;
                    }
                    const date = new Date(ts);
                    cron = `${date.getMinutes()} ${date.getHours()} * * *`;
                }

                this._schedules[lpRow.name] = this._Schedule.scheduleJob(cron, async () => {
                    try {
                        const cP = await this.getTriggerConfigParam('timeName', lpRow.name);
                        if(cP && cP.triggerName) {

                            // First check if additional conditions are met or "never if"
                            let doContinue = await this.asyncAreScheduleConditionsMet(cP, cP.triggerTmAdditionCond, true);
                            if (doContinue) doContinue = await this.asyncAreScheduleConditionsMet(cP, cP.triggerTmNever, false, true);
                            if(!doContinue) {
                                this.logExtendedInfo(`Schedule ${cP.triggerName} (time: ${cP.triggerTime}) triggered, but condition(s) not met.`);
                                return;
                            }
                            
                            this.logExtendedInfo(`Schedule ${cP.triggerName} (time: ${cP.triggerTime}) triggered.`);
                            this.asyncSwitchTargetDevices(cP);
                        }
                    } catch(error) {
                        this._adapter.log.error(`[scheduleTriggerTimes ] Error in callback of scheduleJob: ${error}`);
                    }
                });
                counter++;

            }
        }

        this.logExtendedInfo(`${counter} trigger schedules activated...`);

    }






    /**
     * Set timeout to switch devices off if a motion sensor was triggered and switch off time (duration) is provided.
     *
     *  @param {object} cP   Configuration parameters per getTriggerConfigParam()
     * 
     */
    async asyncSetTimerMotionSensor(cP) {

        try {

            // Go out if no duration is set
            if (!cP.motionDuration || cP.motionDuration < 0 ) return;

            // Timer
            const timeLeft = this.getTimeoutTimeLeft(this._timers.motion[cP.triggerName]);
            if (timeLeft > -1) {
                this._adapter.log.debug(`Timer for ${cP.triggerName} still running ${(timeLeft/1000).toFixed(0)} seconds. We set it new to ${(cP.motionDuration).toFixed(0)} seconds.`);
                clearTimeout(this._timers.motion[cP.triggerName]);
                this._timers.motion[cP.triggerName] = null;
            }


            // Get all target device state paths and values
            const targetDeviceStatePaths = [];
            const targetDeviceStateValues = [];
            const targetDeviceNamesFinal = [];

            for(const lpTargetName of cP.targetDeviceNames) {
                // Get target device information
                const targetOffState = this.getOptionTableValue('tableTargetDevices', 'name', lpTargetName, 'offState');
                const targetOffVal   = this.getOptionTableValue('tableTargetDevices', 'name', lpTargetName, 'offValue');

                // Switching off state and state value is optional. So don't proceed if state is blank.
                if (this.isLikeEmpty(targetOffState.trim())) {
                    this._adapter.log.debug(`Trigger ${cP.triggerName}: No 'off state' is defined for ${lpTargetName}, so this device will not be turned off once timeout is reached.`);
                    continue;
                }

                // Target Off State
                if (await this._adapter.getForeignObjectAsync(targetOffState)) {
                    // State is existing
                    targetDeviceStatePaths.push(targetOffState);
                    targetDeviceStateValues.push(targetOffVal);
                    targetDeviceNamesFinal.push(lpTargetName);
                } else {
                    // State is not existing
                    this._adapter.log.error(`State '${targetOffState}' of device '${lpTargetName}' does not exist.`);
                }
            }

            // Go out if we actually have no to turn off
            if (this.isLikeEmpty(targetDeviceStatePaths)) {
                this._adapter.log.warn(`Trigger ${cP.triggerName}: --> No turn off states set in adapter settings, so no timer will be set to turn off.`);
                return;
            }

            /**
             * Timer
             */
            // Set new timeout to turn off all target states once timeout reached.
            this._timers.motion[cP.triggerName] = setTimeout(async ()=> {

                const lTargetDevicesSwitchedOff = []; // For Log
                const lManualOnDevices = []; // For log
                for (let i = 0; i < targetDeviceStatePaths.length; i++) {

                    // All are having same length and association per each element
                    const lpStatePath = targetDeviceStatePaths[i];
                    const lpStateValToSet  = targetDeviceStateValues[i];
                    const lpTargetName = targetDeviceNamesFinal[i];

                    // Check if current value != new value
                    const targetOffStateValCurrent = await this.asyncGetForeignStateValue(lpStatePath);
                    if (targetOffStateValCurrent == null) {
                        this._adapter.log.error(`Timeout of '${cP.motionDuration}' seconds reached, but could not get current state value of '${lpStatePath}', so unable to turn device off.`);
                        continue;
                    }
                    if (lpStateValToSet == targetOffStateValCurrent) {
                        this.logExtendedInfo(`Timeout of '${cP.motionDuration}' seconds reached, but target device '${lpTargetName}' is already turned off, so no action at this point.`);
                        continue;
                    }

                    // All passed.
                    await this._adapter.setForeignStateAsync(lpStatePath, {val: lpStateValToSet, ack: false });
                    lTargetDevicesSwitchedOff.push(lpTargetName);

                }

                // Log
                if (lManualOnDevices.length > 0) {
                    this.logExtendedInfo(`Timeout of '${cP.motionDuration}' seconds reached, but target device(s) '${lManualOnDevices.toString()}' manually turned on while timer was running, so do not turn off.`);
                }
                if (lTargetDevicesSwitchedOff.length > 0) {
                    this.logExtendedInfo(`Turned off target device(s) '${cP.targetDeviceNames.toString()}' per ${cP.motionDuration}s timer for ${cP.triggerName}, zone(s) '${cP.zoneNames.toString()}'.`);
                }

            }, cP.motionDuration * 1000);

        } catch (error) {
            this.dumpError(`[asyncSetTimerMotionSensor]`, error);
        }
    }


    /**
     * For given triggerStatePath and associated schedule rows, get all needed values
     * 
     * @param {string} triggerType                   'statePath' for a State Path, or 'timeName' for name of a time trigger
     * @param {string} trigger                       Either state path of device that was triggered, or timer trigger name
     * @param {*}      [triggerStateValSet=undefined]   if what='statePath': Trigger State Value
     * @return {Promise<object|null>}     The return object. We return null in case of errors
     */
    async getTriggerConfigParam(triggerType, trigger, triggerStateValSet=undefined) {

        try {

            // The return object
            const cP = {
                // {string}  triggerType            'statePath' for a State Path, or 'timeName' for name of a time trigger
                // {string}  triggerStatePath       State Path of Trigger, if a state
                // {string}  triggerName            Name of Trigger
                // {string}  triggerStateVal        Trigger state value from Options Table
                // {string}  triggerStateValSet     Trigger state value which was set in triggerStatePath
                // {boolean} triggerIsMotion        Is trigger a motion sensor?

                // {string}  triggerTime            If time trigger: time like '42 * * * *' or 'sunset+30'
                // {array}   triggerTmAdditionCond  Array of additional condition names            
                // {string}  triggerTmNever         Array of condition names which must not be met

                // {number}  motionDuration         Duration (timer) is seconds for motion sensor
                // {string}  motionBriStatePath     State Path of brightness state
                // {number}  motionBriThreshold     Threshold of brightness

                // {array}   zoneNames              All zones that were triggered

                // {array}   scheduleRows           The "Schedule" table rows which were triggered.
                // {array}   targetDeviceNames      Target device names


            };

            if (triggerType == 'statePath') {
                
                cP.triggerType = triggerType;
                cP.triggerStatePath = trigger;
                cP.triggerStateValSet = triggerStateValSet;
                cP.scheduleRows = await this.getSchedulesOfTrigger(trigger, 'statePath');
                if(this.isLikeEmpty(cP.scheduleRows)) return null;                

                /**
                 * Triggers - Motion Sensors 
                 */
                for (const lpRow of this._adapter.config.tableTriggerMotion) {
                    if (lpRow.active && lpRow.stateId == cP.triggerStatePath) {
                        cP.triggerIsMotion = true;
                        cP.triggerName = lpRow.name;
                        cP.triggerStateVal = lpRow.stateVal;
                        if (lpRow.duration && parseInt(lpRow.duration) > 0 ) {
                            cP.motionDuration = parseInt(lpRow.duration);
                        } else  {
                            cP.motionDuration = 0;
                        }
                        if (lpRow.briThreshold && parseInt(lpRow.briThreshold) > 0 && lpRow.briStateId && lpRow.briStateId.length > 5 ) {
                            cP.motionBriStatePath = lpRow.briStateId;
                            cP.motionBriThreshold = lpRow.briThreshold;
                        } else {
                            cP.motionBriStatePath = '';
                            cP.motionBriThreshold = 0;
                        }

                        break;
                    }
                }

                /**
                 * Triggers - Other Devices
                 */
                for (const lpRow of this._adapter.config.tableTriggerDevices) {
                    if (lpRow.active && lpRow.stateId == cP.triggerStatePath) {
                        cP.triggerIsMotion = false;
                        cP.triggerName = lpRow.name;
                        cP.triggerStateVal = lpRow.stateVal;
                        break;
                    }
                }        

                // Check if we actually found the state path in one of the trigger tables
                if (this.isLikeEmpty (cP.triggerName)) 
                    throw(`State ${cP.triggerStatePath} not found in options trigger tables.`);


            } else if (triggerType == 'timeName') {

                cP.triggerType = triggerType;
                cP.triggerName = trigger;
                cP.scheduleRows = await this.getSchedulesOfTrigger(trigger, 'timeName');
                if(this.isLikeEmpty(cP.scheduleRows)) return null;

                /**
                 * Time Trigger Table
                 */
                for (const lpRow of this._adapter.config.tableTriggerTimes) {
                    if (lpRow.active && lpRow.name == cP.triggerName) {
                        cP.triggerTime = lpRow.time;
                        cP.triggerTmAdditionCond = lpRow.additionalConditions;
                        cP.triggerTmNever = lpRow.never;
                        break;
                    }
                }     
                if (this.isLikeEmpty(cP.triggerTime)) 
                    throw (`State ${cP.triggerName} not found in time trigger tables.`);

            } else {
                throw(`Wrong parameter for triggerType provided: ${triggerType}`);
            }


            /**
             * Get 
             *  - zone names that were triggered and which are meeting schedule
             *  - the target device names for all schedule rows matching criteria.
             */
            let allZoneNames = [];
            let allTargetDeviceNames = [];
            for (const lpScheduleRow of cP.scheduleRows) {
                const targetDeviceNames = this.getOptionTableValue('tableZones', 'name', lpScheduleRow.name, 'targets');
                if (!this.isLikeEmpty(targetDeviceNames)) {
                    allZoneNames.push(lpScheduleRow.name); // lpScheduleRow.name = zone name
                    allTargetDeviceNames = allTargetDeviceNames.concat(targetDeviceNames);                    
                } else {
                    this._adapter.log.warn(`Trigger 'trigger '${cP.triggerName}': No target devices for zone ${lpScheduleRow.name} found.`);
                }
            }

            // Finalize zone names
            allZoneNames = this.uniqueArray(allZoneNames); // Remove duplicates
            if(!this.isLikeEmpty(allTargetDeviceNames)) {
                cP.zoneNames = allZoneNames;
            } else {
                throw(`No active schedules found for trigger '${cP.triggerName}'.`);
            }

            // Finalize target device names
            allTargetDeviceNames = this.uniqueArray(allTargetDeviceNames); // Remove duplicates
            if(!this.isLikeEmpty(allTargetDeviceNames)) {
                cP.targetDeviceNames = allTargetDeviceNames;
            } else {
                throw(`No target devices found for trigger '${cP.triggerName}'.`);
            }

            // Return result
            return cP;

        } catch (error) {
            this.dumpError('[getTriggerConfigParam()]', error);
            return null;
        }

    }




    /**
     * Called once a trigger was activated (i.e. a motion or other trigger state changed)
     * @param {string}                        statePath      State Path of the trigger
     * @param {ioBroker.State|null|undefined} stateObject    State object
     */
    async asyncTriggerActivated(statePath, stateObject) {

        try {

            if (!stateObject || !statePath) return;

            const cP = await this.getTriggerConfigParam('statePath', statePath, stateObject.val);
            if(this.isLikeEmpty(cP)) {
                throw(`No valid config parameters found for ${statePath}`);
            }
            
            this._adapter.log.debug(`[cP] : ${JSON.stringify(cP)}`);

            // Verify if state value that was set matches with the config
            if (cP.triggerStateVal != cP.triggerStateValSet) return;

            
            // A motion sensor was the triggered and a brightness is set and if state bri is smaller than defined threshold.
            if (cP.triggerIsMotion
                && cP.motionBriStatePath && !this.isLikeEmpty(cP.motionBriStatePath)
                && cP.motionBriThreshold && !this.isLikeEmpty(cP.motionBriThreshold)
                && this.isNumber(cP.motionBriThreshold) && parseInt(cP.motionBriThreshold) > 0 ) {

                const disregardBriIfTimerIsRunning = this._adapter.config.motionNoBriIfTimer;
                const isTimerRunning = (this.getTimeoutTimeLeft(this._timers.motion[cP.triggerName]) <= 0) ? false : true;
                if (disregardBriIfTimerIsRunning && isTimerRunning) {
                    // Disregard brightness if lamp is on
                    // Ist eine Lampe an, wird ein größerer Lux-Wert vom Sensor 
                    // gemessen, daher macht die Prüfung auf Lux bei bereits eingeschalteter Lampe auf erneute Bewegung und Lux-Abfrage 
                    // keinen Sinn mehr. Daher wird durch dieses Script bei Bewegung während das Gerät (die Lampe) an ist -- die Lux-Erkennung 
                    // hier deaktiviert.
                    this._adapter.log.debug(`Trigger [${cP.triggerName}] Timer to turn devices off for this motion sensor is still running. New motion detected in the meanwhile, therefore, we disregard any current brightness states since a turned on light would break the brightness measurement.`);
                    // continue (disregard bri)
                } else {
                    // Do the brightness stuff
                    const briStateValCurrent = await this.asyncGetForeignStateValue(cP.motionBriStatePath);
                    if ( this.isLikeEmpty(briStateValCurrent) || !this.isNumber(briStateValCurrent) || parseInt(briStateValCurrent) < 0) {
                        // Bri not valid
                        this._adapter.log.debug(`Trigger [${cP.triggerName}] Brightness of ${briStateValCurrent} of ${cP.motionBriStatePath} is not valid. State Value: [${briStateValCurrent}]. Therefore, bri will be disregarded and we continue.`);
                        // We continue anyway
                    } else if (parseInt(briStateValCurrent) < parseInt(cP.motionBriThreshold)) {
                        // continue
                        this._adapter.log.debug(`Trigger [${cP.triggerName}] Brightness of ${briStateValCurrent} is < threshold of ${cP.motionBriThreshold}, so we continue.`);
                    } else {
                        // Brightness condition is not met!
                        this.logExtendedInfo(`Trigger [${cP.triggerName}] activated but current brightness of ${briStateValCurrent} is >= 10 (= setting threshold of ${cP.motionBriThreshold}) -> Motion disregarded.`);
                        return;
                    }
                }

            } else {
                this._adapter.log.debug(`No brightness defined for motion sensor '${cP.triggerName}', so continue and do not use bri as an additional criterion.`);
            }

            // Do not switch more often than xxx seconds
            let threshold = parseInt(this._adapter.config.limitTriggerInterval); // in seconds
            if(!threshold || !this.isNumber(threshold) || threshold < 2) threshold = 2;

            const formerTs = this._onStateChangeStates[statePath];
            const currTs = Date.now();
            this._onStateChangeStates[statePath] = currTs;
            if (formerTs && ( (formerTs + (threshold*1000)) > currTs)) {
                this._adapter.log.info(`Trigger [${cP.triggerName}] was already activated ${Math.round(((currTs-formerTs) / 1000) * 100) / 100} seconds ago, so we ignore. Must be at least ${threshold} seconds.`);
                return;
            }

            // Finally, switch:
            this.asyncSwitchTargetDevices(cP);

        } catch (error) {
            this.dumpError('[asyncTriggerActivated()]', error);
            return false;
        }

    }


    /**
     * Switch all target devices.
     * * Note: No need to remove duplicates, this is being taken care of with asyncVerifyConfig() function.
     * TODO: Timer auf "Always off after x secs" setzen. Ist in Admin Options noch deaktiviert.
     * 
     * @param {object} cP   Configuration parameters per getTriggerConfigParam()
     */
    async asyncSwitchTargetDevices(cP) {

        try {

            // some log
            this._adapter.log.debug(`[asyncSwitchTargetDevices] Config Parameters cP = ${JSON.stringify(cP)}`);

            // Verify if schedule conditions are met
            if (! await verifyIfScheduleConditionsTrue(this)) return false;

            // Loop thru the target device names and switch accordingly.
            const lSwitchedOnDevices = [];      // for log only
            const lAlreadyOnDevices = [];      // for log only
            for (const lpTargetDeviceName of cP.targetDeviceNames) {

                // Get option values
                const lpTargetOnState = this.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, 'onState');
                const lpTargetOnVal   = this.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, 'onValue');

                // Go out if state does not exist or if we could not get old state value.
                const oldStateVal = await this.asyncGetForeignStateValue(lpTargetOnState);
                if (oldStateVal == null) {
                    throw(`Could not get current state value for '${lpTargetOnState}' of device '${lpTargetDeviceName}'`);
                }

                // Set target state.
                // Note: Verification of the state value and conversion as needed was performed already by asyncVerifyConfig()
                // Check if device is already on.
                if (oldStateVal != lpTargetOnVal) {
                    await this._adapter.setForeignStateAsync(lpTargetOnState, {val: lpTargetOnVal, ack: false });
                    lSwitchedOnDevices.push(lpTargetDeviceName);                    
                } else {
                    lAlreadyOnDevices.push(lpTargetDeviceName);
                }
               
            }

            // Set Motion Sensor timer
            let logMotion = '';
            if (cP.triggerIsMotion) {
                // Set Motion Timer
                this.asyncSetTimerMotionSensor(cP);
                logMotion = `Setting timer of ${cP.motionDuration}s to turn off.`;
            }

            // Final Log
            if (lSwitchedOnDevices.length > 0) {
                if (lAlreadyOnDevices.length < 1) {
                    this.logExtendedInfo(`Trigger '${cP.triggerName}' activated for '${cP.zoneNames.toString()}'. Turned on '${lSwitchedOnDevices.toString()}'. ${logMotion}`);
                } else {
                    this.logExtendedInfo(`Trigger '${cP.triggerName}' activated for '${cP.zoneNames.toString()}'. Turned on: '${lSwitchedOnDevices.toString()}'; Not turned on (as already on): '${lAlreadyOnDevices.toString()}'. ${logMotion}`);
                }
            } else {
                this.logExtendedInfo(`Trigger '${cP.triggerName}' activated for '${cP.zoneNames.toString()}'. However, devices '${lAlreadyOnDevices.toString()}' not turned on as these are already on. ${logMotion}`);
            }


            // Done.
            return true;

        } catch (error) {
            this.dumpError('[asyncSwitchTargetDevices()]', error);
            return false;
        }

        /**
         * Verify if schedule conditions are met
         * @param {object}   thisRef                    the "this" reference to the class object. We cannot access it directly, so we are using thisRef
         * @return {Promise<boolean>}                   Return true if schedule conditions met, and false otherwise.
         */
        async function verifyIfScheduleConditionsTrue (thisRef) {

            try {
                /**
                 * Since multiple schedules per zone are possible, we loop thru every schedule table row which contains 
                 * the zone name which was containing the trigger.
                 */
                let isHit = false;
                for (const lpRowTableSchedule of cP.scheduleRows) {

                    thisRef._adapter.log.debug(`Trigger ${cP.triggerName} is associated with following schedule table row: ${JSON.stringify(lpRowTableSchedule)}`);
                    // This is what we have as table row: {"active":true,"name":"Bathroom Ground Floor","start":"06:00","end":"sunset-20","mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false,"additionalConditions":[],"never":[]}
            
                    // A few variables / constants
                    const tsCurrent = Date.now();   // the current timestamp
                    let doContinue = true;          // flag if we can continue.
            
                    // First – check if current time is within the schedule times        
                    if (doContinue) doContinue = thisRef.scheduleIsTimeStampWithinPeriod(tsCurrent, lpRowTableSchedule.start, lpRowTableSchedule.end, lpRowTableSchedule.name);
            
                    // Next, check if current day is within the mon-sun options as set in schedules tables.
                    if (doContinue) doContinue = thisRef.scheduleIsWeekdayMatching(lpRowTableSchedule, tsCurrent);
            
                    // Next, check additional conditions (like Public Holiday, etc. -- as set in conditions table)
                    if (doContinue) doContinue = await thisRef.asyncAreScheduleConditionsMet(cP, lpRowTableSchedule.additionalConditions, true);
            
                    // Next, check conditions "Never if"
                    if (doContinue) doContinue = await thisRef.asyncAreScheduleConditionsMet(cP, lpRowTableSchedule.never, false, true);
            
                    // All checks done.
                    if (doContinue) {
                        thisRef._adapter.log.debug(`Schedule for zone '${lpRowTableSchedule.name}' is meeting conditions`);
                        isHit = true;
                        break;
                    } else {
                        thisRef._adapter.log.debug(`Schedule for zone '${lpRowTableSchedule.name}' is NOT meeting conditions`);
                    }
                }

                if (isHit) {
                    thisRef._adapter.log.debug(`Trigger is matching a schedule.`);
                    return true;
                } else {
                    thisRef._adapter.log.debug(`Trigger is not matching a schedule, so no further action at this point.`);
                    return false;
                }
            
                
            } catch (error) {
                thisRef._adapter.log.error(`[verifyIfScheduleConditionsTrue()] ${error}`);
                return false;
            }

        }

    }

    /**
     * For an activated trigger, get the according rows of schedule table.
     * Concept
     * 1. Loop thru tables "Motion Sensors" and "Other Devices" if trigger state is found.
     * 2. Once found:
     *    a) Check in table "Zones", id value in "Triggers" is existing
     *    b) If yes: 
     *         1)  Get "zone name" from table "Zones"
     *         2)  Check table "Schedules" if zone is existing
     *         3)  If it exists, add schedule table row to result array
     * 
     * @param {string} trigger            Either state path of device that was triggered, or timer trigger name
     * @param {string} what               'statePath' for a State Path, or 'timeName' for name of a time trigger
     * @return {Promise<array>}           Array: rows from Schedule table, which are associated with the trigger.
     */
    async getSchedulesOfTrigger(trigger, what) {

        try {

            // First, get all trigger names (both motion sensors and other device)
            const triggerNames = [];
            if (what == 'statePath') {
                const triggerTableRows = this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices); // combine both arrays since same structure
                for (const lpTriggerTableRow of triggerTableRows) {
                    if (lpTriggerTableRow.active && (trigger == lpTriggerTableRow.stateId) ) {
                        triggerNames.push(lpTriggerTableRow.name);
                    }
                }
            } else if (what == 'timeName') {
                for (const lpRow of this._adapter.config.tableTriggerTimes) {
                    if (lpRow.active && (trigger == lpRow.name) ) {
                        triggerNames.push(lpRow.name);
                    }
                }
            } else {
                this._adapter.log.error(`[getSchedulesOfTrigger] Wrong parameter for what provided: ${what}`);
                return [];
            }

            // Next, check the table "Zones" for any rows containing this trigger name in column triggers
            const finalScheduleRows = [];
            for (const lpName of triggerNames) {
                for (const lpRowTableZones of this._adapter.config.tableZones) {
                    if (lpRowTableZones.active && lpRowTableZones.triggers && Array.isArray(lpRowTableZones.triggers)) {
                        /** @type {array} */
                        const triggers = lpRowTableZones.triggers;
                        if ( (triggers.includes(lpName) ) ) {
                            /**
                             * We need to go to the table schedules. We use the zone name, in which we found the trigger.
                             * Since multiple schedules can be set for one zone, we get all rows containing the zone name into
                             * 'scheduleRows'.
                             */
                            for (const lpRowTableSchedules of this._adapter.config.tableSchedules) {
                                if (lpRowTableSchedules.active && (lpRowTableZones.name == lpRowTableSchedules.name) ) {
                                    finalScheduleRows.push(lpRowTableSchedules);
                                }
                            }
                        }
                    }
                }
            }        

            if(!this.isLikeEmpty(finalScheduleRows)) {
                // length cannot be 0 at this point.
                if (triggerNames.length == 1) {
                    this._adapter.log.debug(`Schedules for '${triggerNames[0]}' successfully found.`);
                } else {
                    this._adapter.log.debug(`Trigger activation ${JSON.stringify(triggerNames)} successfully found.`);
                }
                return finalScheduleRows;
            } else {
                if (triggerNames.length == 0) {
                    // This should actually never happen, since trigger state is subscribed per config table and therefore must be found in config table.
                    this._adapter.log.error(`Trigger activated but not found in admin options trigger tables. Trigger: '${trigger}'`);
                } else if (triggerNames.length == 1) {
                    this._adapter.log.error(`Trigger activation '${triggerNames[0]}' failed: no schedules found in schedule table.`);
                } else {
                    this._adapter.log.error(`Trigger activation ${JSON.stringify(triggerNames)} failed: no schedules found in schedule table.`);
                }
                return [];
            }

        } catch (error) {
            this._adapter.log.error(`[getSchedulesOfTrigger] ${error}`);
            return [];
        }

    }

    /**
     * Check if additional conditions are met (like Public Holiday, etc. -- as set in conditions table).
     * 
     * @param {object} cP   Configuration parameters per getTriggerConfigParam()
     * @param {array}  conditionNames   Array of condition names
     * @param {boolean} allMustMeet    if true: all conditions must be met, if false: one condition is enough
     * @param {boolean} [inverse]      if true: inverse results (true -> false, and vice versa)
     * @return {Promise<boolean>}  True if condition(s) met, false if not. Also return true, if empty conditionNames array
     */
    async asyncAreScheduleConditionsMet(cP, conditionNames, allMustMeet, inverse=false) {

        try {

            // If empty array, we return true, as we need to continue if no conditions are set in the options table.
            if (this.isLikeEmpty(conditionNames) ) {
                this._adapter.log.debug(`${cP.triggerName}: No extra condition(s) in schedule, so we return "true" to continue.`);
                return true;
            }

            let hitCount = 0;

            this._adapter.log.debug(`${cP.triggerName}: Processing conditions '${JSON.stringify(conditionNames)}'`);

            for (const lpConditionName of conditionNames) {

                if (hitCount > 0 && allMustMeet == false) break;
                
                const lpConditionStatePath = this.getOptionTableValue('tableConditions', 'name', lpConditionName, 'conditionState');
                const lpConditionStateValue = this.getOptionTableValue('tableConditions', 'name', lpConditionName, 'conditionValue');

                if(!lpConditionStatePath) {
                    this._adapter.log.error(`asyncAreScheduleConditionsMet(): condition details for '${lpConditionName}' could not be found.`);
                    if (allMustMeet) {break;} else {continue;}
                }

                const lpStateVal = await this.asyncGetForeignStateValue(lpConditionStatePath);
                if (lpStateVal == null) {
                    if (allMustMeet) {break;} else {continue;}
                }


                // Finally, compare the config table state value with the actual state value
                this._adapter.log.debug(`Condition '${lpConditionName}': Options state val = '${lpConditionStateValue}', actual state val = '${lpStateVal}'`);
                if (lpConditionStateValue == lpStateVal) {
                    this._adapter.log.debug(`${cP.triggerName}: Condition '${lpConditionName}' *met*.`);
                    hitCount++;
                    if (allMustMeet) {continue;} else {break;}                
                } else {
                    // No hit, so go out!
                    this._adapter.log.debug(`${cP.triggerName}: Condition '${lpConditionName}' *not* met.`);
                    if (allMustMeet) {break;} else {continue;}                
                }

            }

            let result = false;
            if ( (allMustMeet && ( hitCount == conditionNames.length )) || (!allMustMeet && ( hitCount > 0 )) ) 
                result = true;

            if (inverse) result = !result;

            if(result) {
                this._adapter.log.debug(`${cP.triggerName}: additional conditions check - final result = matching`);
                return true;
            } else {
                this._adapter.log.debug(`${cP.triggerName}: additional conditions check - final result = *not* matching`);
                return false;
            }

        } catch (error) {
            this._adapter.log.error(`[asyncAreScheduleConditionsMet] ${error}`);
            return false;
        }

    }

    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ++++ Adapter initialization
    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    /**
     * Verify adapter configuration table
     * @param {array} toCheckArray    Array of what to check
     * @return {Promise<boolean>}   passed   Returns true if no issues, and false if error(s).
     */
    async asyncVerifyConfig(toCheckArray) {

        try {
            
            let errors = 0;
            let validTriggerCounter = 0;

            // FIRST: Check the config array
            for (const toCheck of toCheckArray) {

                // settings of adapter config table, like of 'tableTargetDevices'
                const lpConfigTableSettings = this._adapter.config[toCheck.tableId]; 

                let activeRowCounter = 0;
            
                if (this.isLikeEmpty(lpConfigTableSettings)) {
                    if(toCheck.tableMustHaveActiveRows) {
                        this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] No rows defined.');
                        errors++;
                    }
                    continue;
                } 
            
                for (let i = 0; i < lpConfigTableSettings.length; i++) {
                    if (!lpConfigTableSettings[i].active) continue;
                    activeRowCounter++;

                    // Returns all object keys starting with 'check_' as array, like ['check_1','check_2']. Or empty array, if not found.
                    const lpCriteriaToCheck = (Object.keys(toCheck).filter(str => str.includes('check_'))); 
                    
                    for (const lpCheckKey of lpCriteriaToCheck) {

                        // lpCheckKey = check_1, or check_2, etc. lpCheckVal = like {id: 'stateId', type:'statePath', deactivateIfError:true }
                        const lpCheckVal = toCheck[lpCheckKey]; 

                        // Config table: the string from config table row, like '0.userdata.0.abc.def', 'true', 'false', 'Play Music', etc.
                        let lpConfigString = lpConfigTableSettings[i][lpCheckVal.id];

                        // +++++++ VALIDATION TYPE: a state path like "0_userdata.0.teststate" +++++++
                        if (lpCheckVal.type == 'statePath') {

                            lpConfigString = lpConfigString.trim();

                            if ( this.isLikeEmpty(lpConfigString) && lpCheckVal.optional) {
                                // Skip if empty state and field is optional
                                continue;
                            }
                            
                            if (!this.isStateIdValid(lpConfigString)) {
                                // State path is not valid
                                this._adapter.log.warn(`[Config Table '${toCheck.tableName}'] ${lpCheckVal.id} - State '${lpConfigString}' is not valid.`);
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            }

                            const lpStateObject = await this._adapter.getForeignObjectAsync(lpConfigString);
                            if (!lpStateObject) {
                                // State does not exist
                                this._adapter.log.warn(`[Config Table '${toCheck.tableName}'] State '${lpConfigString}' does not exist.`);
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            }
                            
                            // We altered lpConfigString, so set to adapter config.
                            lpConfigTableSettings[i][lpCheckVal.id] = lpConfigString;
                            

                        // +++++++ VALIDATION TYPE: stateValue -- a value to be set to a certain state +++++++
                        } else if (lpCheckVal.type == 'stateValue') {

                            const lpStatePath = lpConfigTableSettings[i][lpCheckVal.stateValueStatePath];

                            if ( this.isLikeEmpty(lpStatePath.trim()) || (this.isLikeEmpty(lpConfigString.trim()) && lpCheckVal.optional) ) {
                                // Skip if empty and if is optional. 
                                // We also check if the state path is empty. 
                                continue;
                            }

                            // Remove any brackets at beginning and end
                            lpConfigString = lpConfigString.replace(/^(\[|"|'|`|´)([\s\S]*)(]|"|'|`|´)$/, '$2');
                            
                            // Trim again
                            lpConfigString = lpConfigString.trim();

                            if ( this.isLikeEmpty(lpConfigString)) {
                                continue;
                            }                                                        

                            // We altered lpConfigString, so set to adapter config.
                            this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = lpConfigString;


                            const lpStateObject = await this._adapter.getForeignObjectAsync(lpStatePath);
                            
                            if (!lpStateObject) {
                                // State does not exist
                                this._adapter.log.warn(`[Config Table '${toCheck.tableName}'] State '${lpStatePath}' does not exist.`);
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            } else {
                                // State exists
                                // Verify State Type (like boolean, switch, number)
                                const lpStateType = lpStateObject.common.type;
        
                                if (lpStateType == 'boolean' || lpStateType == 'switch') {
                                    if (lpConfigString != 'true' && lpConfigString != 'false') {
                                        this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] State "' + lpStatePath + '" is expecting boolean (true/false), but you set [' + lpConfigString + ']');
                                        if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                        errors++; activeRowCounter--;
                                        continue;
                                    } else {
                                        if (lpConfigString == 'true') this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = true;
                                        if (lpConfigString == 'false') this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = false;
                                    }
                                } else if (lpStateType == 'number') {
                                    if(! this.isNumber(lpConfigString) ) {
                                        this._adapter.log.warn(`[Config Table ${toCheck.tableName}] State ${lpStatePath} is expecting a number, but you set '${lpConfigString}'.`);
                                        if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                        errors++; activeRowCounter--;
                                        continue;
                                    } else {
                                        this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = parseFloat(lpConfigString);
                                    }
                                } else if (this.isLikeEmpty(lpConfigString)) {
                                    // Let's convert an "like empty" value to an empty string, just to make sure....
                                    this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = '';
                                }
                            }                    
                        // +++++++ VALIDATION TYPE: a number +++++++
                        } else if (lpCheckVal.type == 'number') {

                            const lpNumberToCheck = lpConfigTableSettings[i][lpCheckVal.id];


                            if (this.isLikeEmpty(lpNumberToCheck) && lpCheckVal.optional ) {
                                // Skip if empty and if is optional. 
                                // We also check if the state path is empty. 
                                continue;
                            }

                            if(! this.isNumber(lpNumberToCheck) ) {
                                this._adapter.log.warn(`[Config Table ${toCheck.tableName}] Field ${lpCheckVal.id} is expecting a number, but you set '${lpConfigString}'.`);
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            // check for lower limit, if 'numberLowerLimit' set in toCheck object
                            } else if (! this.isLikeEmpty(lpCheckVal.numberLowerLimit)) {
                                if(parseInt(lpNumberToCheck) < lpCheckVal.numberLowerLimit) {
                                    this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] Number in field "' + lpCheckVal.id + '" is smaller than ' + lpCheckVal.numberLowerLimit + ', this does not make sense at all!');
                                    if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                    errors++; activeRowCounter--;
                                    continue;
                                }
                            // check for upper limit, if 'numberUpperLimit' set in toCheck object
                            } else if (! this.isLikeEmpty(lpCheckVal.numberUpperLimit)) { 
                                if(parseInt(lpNumberToCheck) < lpCheckVal.numberUpperLimit) {
                                    this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] Number in field "' + lpCheckVal.id + '" is greater than ' + lpCheckVal.numberUpperLimit  + ', this does not make sense at all!');
                                    if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                    errors++; activeRowCounter--;
                                    continue;
                                }
                            }
                        // +++++++ VALIDATION TYPE: name (which can also be a drop down with multiple values) +++++++
                        } else if (lpCheckVal.type == 'name') {
                            let lpToCheck = lpConfigTableSettings[i][lpCheckVal.id];
                            
                            // trim
                            if(typeof lpToCheck == 'string') lpToCheck = lpToCheck.trim();

                            // Handle forbidden state path chars
                            if(typeof lpToCheck == 'string' && lpCheckVal.removeForbidden) {
                                const forbidden = this.forbiddenCharsInStr(lpToCheck, this.forbiddenStatePaths);
                                if (forbidden) {
                                    // We have forbidden state paths
                                    this.logExtendedInfo(`[Config Table '${toCheck.tableName}'] Field value '${lpToCheck}' contains forbidden character(s) '${forbidden}', so we remove from string.`);
                                    lpToCheck = lpToCheck.replace(this.forbiddenStatePaths, '');
                                }
                            }

                            if(this.isLikeEmpty(lpToCheck) ) {
                                this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] Field "' + lpCheckVal.id + '" is empty.');
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            }
                            
                            // We altered lpToCheck, so set to adapter config.
                            lpConfigTableSettings[i][lpCheckVal.id] = lpToCheck;


                        // +++++++ VALIDATION TYPE: time and timeCron +++++++
                        // -- We test for both "time" and "timeCron".
                        } else if (lpCheckVal.type.substring(0, 4) == 'time') {
                            const lpToCheck = lpConfigTableSettings[i][lpCheckVal.id];
                            let isValidTime = false;
                            if (this.getTimeInfoFromAstroString(lpToCheck, false) ) {
                                isValidTime = true;
                            } else if (lpCheckVal.type == 'timeCron' && this.isCronScheduleValid(lpToCheck.trim())) {
                                isValidTime = true;
                            }
                            if (!isValidTime) {
                                this._adapter.log.warn(`[Config Table '${toCheck.tableName}'] No valid time in field '${lpCheckVal.id}': '${lpConfigString}'`);
                                if (lpCheckVal.deactivateIfError) lpConfigTableSettings[i].active = false;
                                errors++; activeRowCounter--;
                                continue;
                            }
                        }    

                    }
                    if(toCheck.isTriggerTable) validTriggerCounter++;

                }

                if (activeRowCounter == 0  && toCheck.tableMustHaveActiveRows && !toCheck.isTriggerTable) {
                    this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] No rows defined.');
                    errors++;
                } 


                // We altered table variable, so set into adapter config
                this._adapter.config[toCheck.tableId] = lpConfigTableSettings;

            }
            if (validTriggerCounter == 0) {
                this._adapter.log.warn('No active and valid trigger defined in any trigger table.');
                errors++;                    
            }



            // SECOND: Certain table values must be unique.
            // TODO: Add to g_tableValidation
            const uniqueCheckObjects = [
                // name: for logging only, column: the table to check, rows: the adapter config table rows
                { name:'Trigger Tables Motion/Other: Names',        column:'name',          rows:this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices) },
                { name:'Target device table: Names',                column:'name',    rows:this._adapter.config.tableTargetDevices },
                { name:'Zones table: Names',                    column:'name',      rows:this._adapter.config.tableZones },
                { name:'Conditions table: Names',                   column:'name', rows:this._adapter.config.tableConditions },
                { name:'Trigger Tables Motion/Other: State Paths',  column:'stateId',       rows:this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices) },
            ];
            for (const lpCheckObj of uniqueCheckObjects) {
                if (!this.isLikeEmpty(lpCheckObj.rows)) {
                    const allValues = [];
                    for (const lpRow of lpCheckObj.rows) {
                        if(lpRow.active) {
                            allValues.push(lpRow[lpCheckObj.column]);
                        }
                    }
                    if ( !this.isArrayUnique(allValues) ) {
                        this._adapter.log.error(`${lpCheckObj.name} must be unique. You cannot use same string more than once here.`);
                        errors++;
                    }
                }
            }


            // FINALIZE
            if (errors == 0) {
                return true;
            } else {
                this._adapter.log.warn(`[Config Verification] ${errors} error(s) found while verifying your adapter configuration.`);
                return false;
            }

        } catch (error) {
            this._adapter.log.error(`[asyncVerifyConfig] : ${error}`);
            return false;
        }
    }


    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ++++ Generic Adapter functions - tailored to this adapter
    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    /**
     * Verify acknowledge (ack) once a state was changed.
     * 
     * In General: Any state changes of states will be ignored, if acknowledge (ack) = false.
     * The reason is that adapters confirm states by the acknowledge "ack" flag (setting to true).
     * 
     * Exception 1: States under javascript.x/0_userdata.0: For states created by users under javascript.x/0_userdata.0, this behavior can be changed in the adapter options.
     * Exception 2: States under smartcontrol.x.: ack:false only.
     * 
     * @param {string}                        statePath   - State Path
     * @param {ioBroker.State|null|undefined} stateObject - State object
     * @return {boolean}                      false if state change shall be ignored due to the ack, otherwise true.
     * 
     */
    isAckPassing(statePath, stateObject) {

        if(!stateObject || !statePath) return false;

        if (statePath.startsWith('javascript.') || statePath.startsWith('0_userdata.0') ) {
            // For states under javascript.x and 0_userdata.0:
            if (!this._adapter.config.triggerStatesAck || this._adapter.config.triggerStatesAck == 'false') {
                if (stateObject.ack == false) {
                    return true;
                } else {
                    return false;
                }
        
            } else if (this._adapter.config.triggerStatesAck == 'true') {
                if (stateObject.ack == true) {
                    return true;
                } else {
                    return false;
                }
            } else {
                // any (ack: true or false)
                return true;
            }        
        } else if (statePath.startsWith(`smartcontrol.${this._adapter.instance}.`)) {
            // Any states under this adapter instance, we require ack = false;
            if (stateObject.ack == false) {
                return true;
            } else {
                return false;
            }
        } else {
            // For any other adapter state changes, we require ack = true
            if (stateObject.ack == true) {
                return true;
            } else {
                return false;
            }
        }

    }


    /**
     * Stop all timers
     */
    stopAllTimers() {
        // loop through objects by for...in
        for (const timerType in this._timers) {
            // timerType is e.g. 'motion'
            for (const timerName in this._timers[timerType]) {
                this._adapter.log.debug('Stopping timer: ' + timerName);
                clearTimeout(this._timers[timerType][timerName]);
                this._timers[timerType][timerName] = null;
            }
        }   
    }

    /**
     * Stop all schedules
     */
    stopAllSchedules() {
        // loop through objects by for...in
        let counter = 0;
        for (const lpScheduleName in this._schedules) {
            this._adapter.log.debug('Cancelling schedule: ' + lpScheduleName);
            this._schedules[lpScheduleName].cancel();
            counter++;
        }
        this._adapter.log.debug(`(${counter}) trigger schedules cancelled...`);

    }    



    /**
     * Checks if a cron string like xxx is valid or not.
     * Source:  "Test if schedule is valid" - https://github.com/node-schedule/node-schedule/issues/296#issuecomment-269971152
     * Read:    https://stackoverflow.com/questions/35817080/node-requiring-module-inside-function
     * 
     * @param {string} str  String to check, so like '0 22 * * 1-5'
     * @return {boolean}  true if we have a valid cron string, false if not.
     */
    isCronScheduleValid(str) {

        // node-schedule uses cron-parser, so we can simply require it here without adding to package.json
        const cronParser = require('cron-parser');
        try {
            cronParser.parseExpression(str);
        } catch (error) {
            // handle the parse error
            return false;
        }
        // success
        return true;
            
    }


    /**
     * Logs information to ioBroker log.
     * If "extendedInfoLog" in adapter settings is disabled, log level is debug.
     * @param {string}   msg    The log message
     */
    logExtendedInfo(msg) {
        if(this._adapter.config.extendedInfoLog) {
            this._adapter.log.info(msg);
        } else {
            this._adapter.log.debug(msg);
        }
    }

    /**
     * Retrieves a value of an admin option table
     * @param {string}  tableId          The id of the table
     * @param {string}  identifierId     The column id of the identifier
     * @param {string}  identifierName   Like 'Hallway', 'Bathroom'
     * @param {string}  resultId         The column id of the value we need
     * @return {*}                       The value, or undefined if nothing found.
     */
    getOptionTableValue(tableId, identifierId, identifierName, resultId) {
        for (const tableRow of this._adapter.config[tableId]) {
            if (tableRow.active) {
                if (tableRow[identifierId] == identifierName) {
                    // We got a hit
                    return tableRow[resultId];
                } else {
                    // no hit
                    continue;
                }
            } else {
                //this._adapter.log.warn(`[getOptionTableValue] Config Table '${tableId}', row '${identifierName}' is not active.`);
                continue;
            }
        }
        // Nothing found, return undefined
        return undefined;
    }



    /**
     * Check if current day is within the mon-sun options as set in schedules tables.
     * 
     * @param {object}  row   The "Schedule" table row which was triggered.
     * @param {number}  ts    The timestamp to check.
     * @return {boolean}      True if matching, false if not.
     */
    scheduleIsWeekdayMatching(row, ts) {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const lpWeekdayGiven = getWeekDayString(ts);
        for (const lpDay of days) {
            if (lpWeekdayGiven == null) {
                this._adapter.log.error(`[scheduleIsWeekdayMatching()] Unable to calculate day of week for given timestamp '${ts}'`);
                return false;
            } else if ( (row[lpDay] == true) && (lpDay == lpWeekdayGiven) ) {
                this._adapter.log.debug(`Current weekday '${lpWeekdayGiven}' *is* matching schedule of '${row.name}'.`);
                return true;
            }
        }        
        // There was no hit, so we return false.
        this._adapter.log.debug(`Current weekday '${lpWeekdayGiven}' is *not* matching schedule of '${row.name}'.`);
        return false;

        /**
         * get the week day of a string.
         * Source: https://stackoverflow.com/a/17964373
         * @param {*} date object or time stamp or string that is recognized by the Date.parse() method
         * @return {string|null}   day of week as string, or null if not found.
         */
        function getWeekDayString(date) {
            const dayOfWeek = new Date(date).getDay();    
            return isNaN(dayOfWeek) ? null : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];
        }

    }


    /**
     * Check if a timestamp is within two times.
     *
     * @param {number} tsGiven  Timestamp to be checked if between start and end time
     * @param {string} start    Start time, like '18:30', or 'sunrise, or 'sunset+30'
     * @param {string} end      End time
     * @param {string} ofWhat   Typically zone name. For logging purposes only.
     * @return {boolean}        true if within times, and false if not.
     */
    scheduleIsTimeStampWithinPeriod(tsGiven, start, end, ofWhat) {

        const tsStart = this.getTimeInfoFromAstroString(start, true).timestamp;
        let tsEnd = this.getTimeInfoFromAstroString(end, true).timestamp;
        const localStart = new Date(tsStart).toLocaleString();
        let localEnd = new Date(tsEnd).toLocaleString();
        const localGiven = new Date(tsGiven).toLocaleString();

        // Validate input
        if (tsStart == 0 || tsEnd == 0 ) {
            this._adapter.log.error(`Schedule times (start: '${start}', end: '${end}) of '${ofWhat}' are not valid.`);
            return false;
        }

        // Message
        this._adapter.log.debug(`Start: '${start}'='${localStart}', end: '${end}'='${localEnd}'. To check if in between: '${localGiven}'`);

        // Check if we are exceeding midnight.
        if ( (tsStart >= tsEnd) && (this._adapter.config.exceedMidnight) ) {
            // We need to exceed over midnight.
            tsEnd = tsEnd + (1000*3600*24);
            localEnd = new Date(tsEnd).toLocaleString();
            this._adapter.log.debug(`Start time > End time, but option 'Exceed Midnight' activated, so we add 24h to the end time. New end time: '${end}'='${localEnd}'`);
        }

        if(tsStart >= tsEnd) {
            this._adapter.log.warn(`Error: Start time '${start}' is greater than end time '${end}) of '${ofWhat}'.`);
            return false;            
        }

        // Start comparing
        if ( (tsGiven >= tsStart) && (tsGiven <= tsEnd) ) {
            // We have a hit
            this._adapter.log.debug(`Current time *is* within schedule times (start: '${start}', end: '${end}) of '${ofWhat}'.`);
            return true;
        } else {
            // Not within schedule time
            this._adapter.log.debug(`Current time is *not* within schedule times (start: '${start}', end: '${end}) of '${ofWhat}'.`);
            return false;
        }

    }

    /**
     * Get the timestamp of an astro name.
     * 
     * @param {string} astroName            Name of sunlight time, like "sunrise", "nauticalDusk", etc.
     * @param {number} latitude             Latitude
     * @param {number} longitude            Longitude
     * @param {number} [offsetMinutes=0]    Offset in minutes
     * @return {number}                     Timestamp of the astro name
     */
    getAstroNameTs(astroName, latitude, longitude, offsetMinutes=0) {

        try {
            let ts = this._sunCalc.getTimes(new Date(), latitude, longitude)[astroName];
            if (!ts || ts.getTime().toString() === 'NaN') {
                this._adapter.log.warn(`[getAstroNameTs] No time found for [${astroName}].`);
                return 0;
            }
            ts = this.roundTimeStampToNearestMinute(ts);
            ts = ts + (offsetMinutes * 60 * 1000);
            return ts;
        } catch (error) {
            this._adapter.log.error(`[getAstroNameTs] ${error}`);
            return 0;
        }

    }


    /**
     * Get the time stamp of a time string, like '23:30', 'goldenHourEnd', or 'goldenHourEnd+30'
     * Supports times like 'h:ss'/'hh:ss', and also astro names.
     * Astro names can also have an additional offset in minutes, so like "sunriseEnd-40" or "sunriseEnd+120".
     * 
     * @param {string}   input          the input string
     * @param {boolean}  [getFullResult=false]  if false: returns true if a valid time provided, and false if not.
     *                                          if true: Empty object if nothing found, or object with details.
     * @return {boolean|object}                 Return value
     */
    getTimeInfoFromAstroString(input, getFullResult=false) {

        const currentDateTime = new Date(); // Date object of current date/time

        input = input.replace(/\s/g,''); // remove all white spaces

        const returnObject = {
            full: input,
            timestamp: 0,
            isAstro: false,
            astroName: '',
            astroHasOffset: false,
            astroOffsetMinutes: 0,
        };

        const matchTime = input.match(/^(\d{1,2})(:)(\d{2})$/);
        const matchAstroName = input.match(/^(sunriseEnd|sunrise|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nauticalDusk|nightEnd|nadir|night|nauticalDawn|dawn)$/g);
        const matchAstroWithOffset = input.match(/^(sunriseEnd|sunrise|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nauticalDusk|nightEnd|nadir|night|nauticalDawn|dawn)(-|\+)(\d{1,3})$/);

        if (matchTime != null) {
            // Time like "19:35" found. Convert to timestamp by using current date
            
            const hour = parseInt(matchTime[1]);
            const min = parseInt(matchTime[3]);

            if ( (input != '24:00') && (hour < 0 || hour > 23 || min < 0 || min > 60 ) ) {
                returnObject.full = '';
            } else {

                returnObject.timestamp = new Date(
                    currentDateTime.getFullYear(),
                    currentDateTime.getMonth(),
                    currentDateTime.getDate(),
                    hour, // hours
                    min, // minutes
                ).getTime();
            }
        } else {
            if (matchAstroName != null) {
                // Astro found, with no offset
                returnObject.astroName = input;
                returnObject.isAstro = true;
                returnObject.timestamp = this.getAstroNameTs(input, this.latitude, this.longitude);
            } else if (matchAstroWithOffset != null) {
                // Astro found, with offset
                returnObject.isAstro = true;
                returnObject.astroHasOffset = true;
                returnObject.astroName = matchAstroWithOffset[1];
                returnObject.astroOffsetMinutes = parseInt(matchAstroWithOffset[3]);
                if(matchAstroWithOffset[2] == '-') {
                    returnObject.astroOffsetMinutes = returnObject.astroOffsetMinutes * (-1);
                }
                returnObject.timestamp = this.getAstroNameTs(returnObject.astroName, this.latitude, this.longitude, returnObject.astroOffsetMinutes);
            } else {
                // Nothing found
                returnObject.full = '';
            }
        }


        if (!getFullResult) {
            if (!returnObject.full) {
                return false;
            } else {
                return true;
            }
        } else {
            return returnObject;
        }

    }




    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ++++ Generic Adapter functions - independent from this adapter
    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


    /**
     * Error Message to Log. Handles error object being provided.
     * 
     * @param {string} msg               (intro) message of the error
     * @param {*}      [error=undefined]  Optional: Error object or string
     */
    dumpError(msg, error=undefined) {
        if (!error) {
            this._adapter.log.error(msg);
        } else {
            if (typeof error === 'object') {
                if (error.stack) {
                    this._adapter.log.error(`${msg} – ${error.stack}`);
                } else if (error.message) {
                    this._adapter.log.error(`${msg} – ${error.message}`);
                } else {
                    this._adapter.log.error(`${msg} – ${JSON.stringify(error)}`);
                }
            } else if (typeof error === 'string') {
                this._adapter.log.error(`${msg} – Message: ${error}`);
            } else {
                this._adapter.log.error(`[dumpError()] : wrong error argument: ${JSON.stringify(error)}`);
            }
        }
    }


    /**
     * Restart the adapter instance.
     * Source: https://github.com/foxriver76/ioBroker.xbox/blob/275e03635d657e7b18762166b4feca96fc4b1b1c/main.js#L630
     */
    /*
    async asyncRestartAdapter() {
        
        try {
        
            const resultObject = await this._adapter.getForeignObjectAsync('system.adapter.' + this._adapter.namespace);
            if (resultObject) {
                await this._adapter.setForeignObjectAsync('system.adapter.' + this._adapter.namespace, resultObject);
                return;
            } else {
                this._adapter.log.error(`[asyncRestartAdapter()]: getForeignObjectAsync() No object provided from function.`);
                return;
            }

        } catch (error) {
            this._adapter.log.error(`[asyncRestartAdapter()]: ${error}`);
            return;
        }
        
    }
    */

    /** 
     * Check if a state exists 
     * @param {string}   str                State path
     * @param {boolean}  [isForeign=false]  true if a foreign state, false if a state of this adapter
     * @return {Promise<boolean>} 
     */
    async asyncStateExists (str, isForeign=false) {

        try {
            let ret;
            if (isForeign) {
                ret = await this._adapter.getForeignObjectAsync(str);
            } else {
                ret = await this._adapter.getObjectAsync(str);
            }
            
            if (ret == undefined) {
                return false;
            } else {
                return true;
            }
        } catch (error) {
            this._adapter.log.error(`[asyncStateExists] : ${error}`);
            return false;
        }

    }

    /**
     * Checks if an ioBroker state id (path) string is valid. 
     * NOTE: This does not verify if the state is existing. It does just some basic checks if the path looks good-
     * 
     * @param {string}   str     String to validate
     * @return {boolean}         true/false of validation result
     */
    isStateIdValid(str) {

        // String?
        if (!str || typeof str !== 'string') return false;

        // If string length < 5 chars (minimum state length is 5, assuming this is a valid state: 'x.0.a'
        if(str.length < 5) return false;

        // If forbidden chars
        if (this.forbiddenStatePaths.test(str)) return false;

        // If no instance number with a leading and trailing dot "."
        if (!/\.\d+\./.test(str)) return false;

        // If spaces at beginning or end
        if (str.startsWith(' ') || str.endsWith(' ')) return false;

        // If dots at beginning or end
        if (str.startsWith('.') || str.endsWith('.')) return false;

        // All passed
        return true;

    }


    /**
     * Create States, either under adapter instance or anywhere.
     * TODO: Better error handling (callback: function (err, _obj) ) for set(Foreign)ObjectNotExistsAsync and set(Foreign)StateAsync
     * 
     * @param {object|array}  statesToCreate    Object like {statePath:'0_userdata.0.motionHallway', commonObject:{name:'Motion', type:'boolean', read:true, write:true, role:'state', def:false }
     *                                          You can pass multiple objects via array of these objects.
     * @param {boolean}       [isForeign=false] False: creates states under adapter instance, if true: creates states anywhere.
     *                                          WARN: use the "true" flag carefully!
     * @return {Promise<boolean>}               false if errors caught, otherwise true.
     */
    async asyncCreateStates(statesToCreate, isForeign=false) {

        try {

            // Convert to array if it is an object, since we allow both
            if(!Array.isArray(statesToCreate)) statesToCreate = [statesToCreate];

            for (const lpStateToCreate of statesToCreate) {
                
                // Check parameters
                if (!lpStateToCreate.statePath || !lpStateToCreate.commonObject) {
                    this._adapter.log.error(`asyncCreateForeignStates(): invalid parameter provided to function`);
                    return false;
                }

                // Create new state. 
                // While set(Foreign)ObjectNotExistsAsync takes care if state does not exist, we still check as we also set values afterwards.
                if (isForeign && ! await this.asyncStateExists(lpStateToCreate.statePath, true)) {
                    await this._adapter.setForeignObjectNotExistsAsync(lpStateToCreate.statePath, {type:'state', common:lpStateToCreate.commonObject, native: {}});
                } else if(!isForeign && ! await this.asyncStateExists(lpStateToCreate.statePath, false)) {
                    await this._adapter.setObjectNotExistsAsync(lpStateToCreate.statePath, {type:'state', common:lpStateToCreate.commonObject, native: {}});
                } else {
                    // State already exists.
                    continue;
                }

                // Set default value
                const def = lpStateToCreate.commonObject.def;
                const type = lpStateToCreate.commonObject.type;
                let initialDefault;
                if (def !== undefined) {
                    initialDefault = def;
                } else {
                    if(type === 'number')  initialDefault = 0;
                    if(type === 'boolean') initialDefault = false;
                    if(type === 'string')  initialDefault = '';
                    if(type === 'array')   initialDefault = [];
                    if(type === 'object')  initialDefault = {};
                }       
                if (isForeign) {
                    await this._adapter.setForeignStateAsync(lpStateToCreate.statePath, initialDefault, false);
                } else {
                    await this._adapter.setStateAsync(lpStateToCreate.statePath, initialDefault, false);
                }                
                this._adapter.log.debug(`State '${lpStateToCreate.statePath}' created.`);

            }

            return true;
            

        } catch (error) {
            this._adapter.log.error(`[asyncCreateForeignStates()] ${error}`);
            return true;
        }

    }


    /**
     * Get value of a foreign state.
     * 
     * @param {string}      statePath   Full path to state, like 0_userdata.0.other.isSummer
     * @return {Promise<*>}             State value if successful, or null if not.
     */
    async asyncGetForeignStateValue(statePath) {

        try {
            // Check state existence
            const lpStateObject = await this._adapter.getForeignObjectAsync(statePath);

            if (!lpStateObject) {
                throw(`State '${statePath}' does not exist.`);
            } else {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const lpStateValueObject = await this._adapter.getForeignStateAsync(statePath);
                if (! this.isLikeEmpty(lpStateValueObject)) {
                    return lpStateValueObject.val;
                } else {
                    throw(`Unable to retrieve info from state '${statePath}'.`);
                }
            }
        } catch (error) {
            this.dumpError(`[asyncGetForeignStateValue]`, error);
            return null;
        }

    }

    /**
     * Returns a value as configured in Administration Settings of ioBroker
     * @param {string}  what     Options like: city, country, longitude, latitude, language, tempUnit, 
     *                                         currency, dateFormat, isFloatComma, licenseConfirmed, 
     *                                         defaultHistory, activeRepo, diag
     *                           To see all options, use: log('All options: ' +  JSON.stringify(getObject('system.config').common));
     * @return {Promise<*>}      The option. Will be undefined if value is not set.
     */
    async asyncGetSystemConfig(what) {

        try {
            const config = await this._adapter.getForeignObjectAsync('system.config');
            if (this.isLikeEmpty(config.common[what])) {
                this._adapter.log.warn(`[asyncGetSystemConfig] System config for [${what}] not found.`);
                return;
            } else {
                return config.common[what];
            }
        } catch (error) {
            this._adapter.log.error(`[asyncGetSystemConfig] ${error}`);
            return;
        }

    }



    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    // ++++ Generic JS functions - independent from adapter
    // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    /**
     * Converts a given timestamp into European time. E.g. '9:03pm and 17 seconds' -> '21:03:17'
     * Requires function zeroPad().
     * @param   {object}   ts                 Timestamp
     * @param   {boolean}  [noSeconds=false]  if true, seconds will not be added. Result is '21:03' 
     * @return  {string}    Date in European date/time as String
     */
    timestampToTimeString(ts, noSeconds=false) {

        if(noSeconds) ts = this.roundTimeStampToNearestMinute(ts);
        const inputDate = new Date(ts);        
        
        if (noSeconds) {
            return this.zeroPad(inputDate.getHours(), 2) + ':' + this.zeroPad(inputDate.getMinutes(), 2);
        } else {
            return this.zeroPad(inputDate.getHours(), 2) + ':' + this.zeroPad(inputDate.getMinutes(), 2) + ':' + this.zeroPad(inputDate.getSeconds(), 2);
        }

    }


    /**
     * Rounds the given timestamp to the nearest minute
     * Inspired by https://github.com/date-fns/date-fns/blob/master/src/roundToNearestMinutes/index.js
     * 
     * @param {number}  ts   a timestamp
     * @return {number}      the resulting timestamp
     */
    roundTimeStampToNearestMinute(ts) {

        const date = new Date(ts);
        const minutes = date.getMinutes() + date.getSeconds() / 60;
        const roundedMinutes = Math.floor(minutes);
        const remainderMinutes = minutes % 1;
        const addedMinutes = Math.round(remainderMinutes);
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            roundedMinutes + addedMinutes
        ).getTime();

    }



    /**
     * Gets the time left of 'const xxx = setTimeout()', where xxx is the timer id.
     * 
     * @author  Mic-M <https://github.com/Mic-M/>
     * @version 0.1 (30 June 2020)
     * 
     * @param {object} timerId - The timer object 'xxx' when executing a 'const xxx = setTimeout()'
     * @return {number}  The time remaining of the setTimeout(). Returns -1, if not or no longer running, never run, or object not even set.
     * 
     */
    getTimeoutTimeLeft(timerId) {

        try {

            // Return -1 if timer object is undefined/null or if timer is not running
            if (!timerId || timerId._destroyed) return -1;

            const dummyTimer = setTimeout(() => {}, 0);               // We need a dummy timer to get the current number of ms when the node.js session was started
            const currMsAfterNodeJsStart = dummyTimer['_idleStart'];  // _idleStart is the number of milliseconds since the node.js session was started.
            clearTimeout(dummyTimer);                                 // clear dummy timer, just in case.

            const elapsed   = currMsAfterNodeJsStart - timerId._idleStart;     // for how many milliseconds is timer already running?
            let   remaining = timerId._idleTimeout - elapsed; // remaining time in ms
            if (remaining < 0 ) remaining = -1;  // Just in case, should be already caught by timerObject._destroyed

            return remaining;

        } catch (error) {
            this._adapter.log.error('[getTimeoutTimeLeft()] :: ' + error);
            return -1;
        }   

    }




    /**
     * Checks whether variable is number
     * isNumber ('123'); // true  
     * isNumber ('123abc'); // false  
     * isNumber (5); // true  
     * isNumber ('q345'); // false
     * isNumber(null); // false
     * isNumber(undefined); // false
     * isNumber(false); // false
     * isNumber('   '); // false
     * @source https://stackoverflow.com/questions/1303646/check-whether-variable-is-number-or-string-in-javascript
     * @param {any} n     Variable, die zu prüfen ist auf Zahl
     * @return {boolean}  true falls Zahl, false falls nicht.
     */
    isNumber(n) { 
        return /^-?[\d.]+(?:e-?\d+)?$/.test(n); 
    }


    /**
     * Remove certain (forbidden) chars from a string
     * @param {string} str                  - The input string
     * @param {RegExp} regex                - Regex of chars to be removed, like /[\][*,;'"`<>\\?]/g
     * @param {boolean} [cleanSpaces=false] - Optional: trim and remove replace multiple spaces with single space
     * @return {array} Array with two elements: [0]: the resulting string, [1]: message if str was altered or empty string if no changes applied
     */
    strCharsRemove(str, regex, cleanSpaces=false) {
        let correctedMsg = '';
        let result = str;
        if (result.match(regex)) {
            result = result.replace(regex, '');
            correctedMsg += 'removed certain chars;';
        }
        if (cleanSpaces) {
            // remove multiple spaces
            if (result.match(/  +/g)) {
                result = result.replace(/ +/g, ' '); // remove multiple spaces
                correctedMsg += 'removed multiple spaces;';
            }
            // remove spaces from the start and end
            if (result.startsWith(' ') || result.endsWith(' ')) {
                result = result.trim();
                correctedMsg += 'remove spaces from start and/or end;';
            }
        }
        return [result, correctedMsg];
    }

    /**
     * Remove duplicates from an array of objects by key
     * https://stackoverflow.com/a/58437069
     * 
     * @param {array} givenArray
     * @param {string}  key             key which value must be unique.
     * @param {boolean} [all=false]     if true: unique by all properties of the object, if false: unique by just the key value
     */
    uniqueArrayObjectByKey(givenArray, key, all=false) {

        if (all) {
            return givenArray.filter((v,i,a)=>a.findIndex(t=>(JSON.stringify(t) === JSON.stringify(v)))===i);
        } else {
            return givenArray.filter((v,i,a)=>a.findIndex(t=>(t[key] === v[key]))===i);
        }

    }    

    /**
     * Remove Duplicates from Array
     * @source https://stackoverflow.com/questions/23237704/nodejs-how-to-remove-duplicates-from-array
     * @param  {array} inputArray        Array to process
     * @return {array}                  Array without duplicates.
     */
    uniqueArray(inputArray) {
        return inputArray.filter(function(elem, pos) {
            return inputArray.indexOf(elem) == pos;
        });
    }


    /**
     * Check if an array contains duplicate values
     * https://stackoverflow.com/a/34192063
     * 
     * @param {*} myArray   - The given array
     * @return {boolean}    - true if it is unique, false otherwise.
     */
    isArrayUnique(myArray) {
        return myArray.length === new Set(myArray).size;
    }


    /**
     * Checks if Array or String is not undefined, null or empty.
     * Array, object, or string containing just white spaces or >'< or >"< or >[< or >]< is considered empty
     * 18-Jun-2020: added check for { and } to also catch empty objects.
     * 08-Sep-2019: added check for [ and ] to also catch arrays with empty strings.
     * @param  {any}  inputVar   Input Array or String, Number, etc.
     * @return {boolean} True if it is undefined/null/empty, false if it contains value(s)
     */
    isLikeEmpty(inputVar) {
        if (typeof inputVar !== 'undefined' && inputVar !== null) {
            let strTemp = JSON.stringify(inputVar);
            strTemp = strTemp.replace(/\s+/g, ''); // remove all white spaces
            strTemp = strTemp.replace(/"+/g, '');  // remove all >"<
            strTemp = strTemp.replace(/'+/g, '');  // remove all >'<
            strTemp = strTemp.replace(/\[+/g, '');  // remove all >[<
            strTemp = strTemp.replace(/\]+/g, '');  // remove all >]<
            strTemp = strTemp.replace(/\{+/g, '');  // remove all >{<
            strTemp = strTemp.replace(/\}+/g, '');  // remove all >}<
            if (strTemp !== '') {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    }

    /**

    * Pad a number with leading zeros, like 7 => '007' if 3 places.
    * @param  {string|number}  num     Input number
    * @param  {number}         digits  Number of digits
    * @return {string}         The result
    */
    zeroPad(num, digits) {
        const zero = digits - num.toString().length + 1;
        return Array(+(zero > 0 && zero)).join('0') + num;        
    } 

    /**
     * Check string against a forbidden chars regex
     * Mic-M
     * 
     * @param {string} str      - the input string
     * @param {RegExp} regex    - the regular expression, like: /[\][*,;'"`<>\\?]/g
     * @return {boolean|string} - returns false if nothing found, or all forbidden chars found space separated as string, like '[ ] , ? *'
     */
    forbiddenCharsInStr(str, regex) {

        let result = str.match(regex);
        if (result) {
            result = this.uniqueArray(result);
            let returnStr = '';
            for (const lpCharForbidden of result) {
                returnStr = returnStr + ' ' + lpCharForbidden;
            }
            return (returnStr.trim());
        } else {
            return false;
        }
    
    }




}



module.exports = Library;
