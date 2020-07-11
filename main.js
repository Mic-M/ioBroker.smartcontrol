'use strict';
/**
 * ioBroker Smart Control Adapter
 *
 * @github  https://github.com/Mic-M/ioBroker.smartcontrol
 * @forum   https://forum.iobroker.net/topic/33691/planung-neuer-adapter-licht-raumsteuerung-und-mehr/14
 * @author  Mic-M <iob.micm@gmail.com>
 * @license MIT
 * 
 */


/**
 * Globals
 */
const utils      = require('@iobroker/adapter-core');            // Adapter core module
const g_Schedule = require('node-schedule');                     // https://github.com/node-schedule/node-schedule
const g_SunCalc  = require('suncalc2');                          // SunCalc
const g_Library  = require(__dirname + '/lib/smartcontrol.js');  // SmartControl Library Class
let   g_midnightSchedule = null;                                 // Schedule for every midnight
let   lib        = null;                                         // the Library class instance (being assigned later)


/**
 * Adapter Configuration Input Validation of Tables
 */
const g_tableValidation = [
    {
        tableName: 'Target Devices',
        tableId: 'tableTargetDevices',
        tableMustHaveActiveRows: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
        check_2: {id: 'onState', type:'statePath', deactivateIfError:true },
        check_3: {id: 'onValue', type:'stateValue', stateValueStatePath:'onState', deactivateIfError:true },
        check_4: {id: 'offState', type:'statePath', deactivateIfError:true },
        check_5: {id: 'offValue', type:'stateValue', stateValueStatePath:'offState', deactivateIfError:true },
    },    
    {
        tableName: 'Conditions',
        tableId: 'tableConditions',
        tableMustHaveActiveRows: false,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'conditionState', type:'statePath', deactivateIfError:true },
        check_3: {id: 'conditionValue', type:'stateValue', stateValueStatePath:'conditionState', deactivateIfError:true },
    },
    {
        tableName: 'Triggers: Motion Sensors',   // Name of table, just for logging purposes
        tableId: 'tableTriggerMotion',
        tableMustHaveActiveRows: false,
        isTriggerTable: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'stateId', type:'statePath', deactivateIfError:true },
        check_3: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
        check_4: {id: 'duration', type:'number', numberLowerLimit: 2, deactivateIfError:true },
        check_5: {id: 'briStateId', type:'statePath', deactivateIfError:true, optional:true },
        check_6: {id: 'briThreshold', type:'number', deactivateIfError:true, optional:true },
    },
    {
        tableName: 'Triggers: Other Devices',
        tableId: 'tableTriggerDevices',
        tableMustHaveActiveRows: false,
        isTriggerTable: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'stateId', type:'statePath', deactivateIfError:true },
        check_3: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
    },
    {
        tableName: 'Triggers: Times',
        tableId: 'tableTriggerTimes',
        tableMustHaveActiveRows: false,
        isTriggerTable: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'time', type:'timeCron', deactivateIfError:true },
    },

    {
        tableName: 'Zones',
        tableId: 'tableZones',
        tableMustHaveActiveRows: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'triggers', type:'name', deactivateIfError:true },
        check_3: {id: 'targets', type:'name', deactivateIfError:true },
    },    
    {
        tableName: 'Schedules',
        tableId: 'tableSchedules',
        tableMustHaveActiveRows: true,
        check_1: {id: 'name', type:'name', deactivateIfError:true },
        check_2: {id: 'start', type:'time', deactivateIfError:true },
        check_3: {id: 'end', type:'time', deactivateIfError:true },
    },

];

class SmartControl extends utils.Adapter {

    /**
     * Constructor
     * 
     * @param {Partial<utils.AdapterOptions>} [options={}]  Adapter Options
     * 
     */
    constructor(options) {
        super( {...options, name: 'smartcontrol'} ); // to access the object's parent
        this.on('ready',        this._asyncOnReady.bind(this));
        this.on('stateChange',  this._asyncOnStateChange.bind(this));
        this.on('unload',       this._onUnload.bind(this));
    }

    /**
     * Called once ioBroker databases are connected and adapter received configuration.
     */
    async _asyncOnReady() {

        try {

            /**
             * Add Smart Control lib
             */
            lib = await new g_Library(this, g_SunCalc, g_Schedule);

            /**
             * For adapter testers: create test states
             */
            const where = 'Test.';
            const statesToCreate = [
                {statePath:where+'trigger.Bathroom_motion',         commonObject:{name:'Bathroom Motion', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.Bathroom_wall-switch',    commonObject:{name:'Bathroom Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.Hallway1_motion',         commonObject:{name:'Hallway Motion', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.Hallway2_motion',         commonObject:{name:'HallwayMotion', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.Hallway1_wall-switch',    commonObject:{name:'Hallway Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.Hallway2_wall-switch',    commonObject:{name:'Hallway Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'trigger.RelaxPersonSitting',      commonObject:{name:'Relax Area: Someone sitting on sofa', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'brightness.Bathroom_bri',         commonObject:{name:'Bathroom Brightness', type:'number', read:true, write:true, role:'state', def:0} },
                {statePath:where+'brightness.Hallway1_bri',         commonObject:{name:'Hallway Brightness 1', type:'number', read:true, write:true, role:'state', def:0} },
                {statePath:where+'brightness.Hallway2_bri',         commonObject:{name:'Hallway Brightness 2', type:'number', read:true, write:true, role:'state', def:0} },
                {statePath:where+'light.Bathroom',                  commonObject:{name:'Bathroom Light', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'light.Hallway',                   commonObject:{name:'Hallway Light', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'light.RelaxAreaCeiling',          commonObject:{name:'Relax Area Light', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'light.RelaxAreaWall',             commonObject:{name:'Relax Area Light', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'radio.Bathroom',                  commonObject:{name:'Bath Radio Station (String)', type:'string', read:true, write:true, role:'state', def:''} },
                {statePath:where+'radio.Bathroom_pause',            commonObject:{name:'Bath Radio Pause', type:'boolean', read:true, write:true, role:'button', def:false} },
                {statePath:where+'condition.isHolidayToday',        commonObject:{name:'Condition: is Holiday Today?', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'condition.isAnyonePresent',       commonObject:{name:'Condition: is Anyone Present?', type:'boolean', read:true, write:true, role:'state', def:false} },
                {statePath:where+'condition.isFrontDoorLocked',     commonObject:{name:'Condition: is Front Door locked?', type:'boolean', read:true, write:true, role:'state', def:false} },
            ];           

            await lib.asyncCreateStates(statesToCreate);


            /**
             * Get latitude/longitude from ioBroker admin main configuration.
             */
            lib.latitude = await lib.asyncGetSystemConfig('latitude');
            lib.longitude = await lib.asyncGetSystemConfig('longitude');
            if (!lib.latitude || !lib.longitude) {
                this.log.warn('Latitude/Longitude is not defined in ioBroker main configuration, so you will not be able to use Astro functionality for schedules.');
            }

            /**
             * Create smartcontrol.x.info.astroTimes states.
             */
            if (lib.latitude && lib.longitude) {
                if (! await lib.asyncCreateAstroStates()) {
                    throw(`We were not able to create ${this.namespace}'.info.astroTimes.xxx' states. Please check your log and configuration. You will not be able to use this adapter without fixing the issues.`);
                }
            }

            /**
             * Validate Adapter Admin Configuration
             */
            if (await lib.asyncVerifyConfig(g_tableValidation)) {
                lib.logExtendedInfo('Adapter admin configuration successfully validated...');
            } else {
                throw('Adapter admin configuration validation failed --> Please check your configuration. You will not be able to use this adapter without fixing the issues.');
            }

            /**
             * Create smartcontrol.x.targetDevices.xxx states.
             */
            if (! await lib.asyncCreateTargetDevicesStates()) {
                throw(`We were not able to create ${this.namespace}'.targetDevices.xxx' states. Please check your log and configuration. You will not be able to use this adapter without fixing the issues.`);
            }

            /**
             * Create smartcontrol.x.options.xxx states
             */
            if (! await lib.asyncCreateOptionStates()) {
                throw(`We were not able to create ${this.namespace}'.options.xxx' states. Please check your log and configuration. You will not be able to use this adapter without fixing the issues.`);
            }

            /**
             * Update option states. Required if admin options were changed and saved (which restarts adapter).
             */
            await lib.updateOptionStatesFromConfig();


            /**
             * == STATE SUBSCRIPTION ==
             * 1-Subscribe to all smartcontrol.x.targetDevices states
             * 2-Subscribe to all on/off states of tableTargetDevices
             */
            lib.logExtendedInfo('Subscribing to all target devices states...');
            // smartcontrol.x.targetDevices states
            await this.subscribeStatesAsync('targetDevices.*');

            // on/off states of tableTargetDevices
            for (const lpRow of this.config.tableTargetDevices) {
                if (lpRow.active) {
                    await this.subscribeForeignStatesAsync(lpRow.onState);
                    await this.subscribeForeignStatesAsync(lpRow.offState);
                }
            }

            /**
             * == STATE SUBSCRIPTION ==
             * Subscribe to all state changes of 'smartcontrol.x.options.x.x.active'
             */
            await this.subscribeStatesAsync('options.*.active');

            /**
             * == STATE SUBSCRIPTION ==
             * Subscribe to all trigger state changes
             */
            lib.logExtendedInfo('Subscribing to all trigger states...');
            // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
            for (const lpRow of this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices)) {
                if (lpRow.active) {
                    const statePath = lpRow.stateId; // like '0_userdata.0.motion-sensor.Bathroom.motion' 
                    await this.subscribeForeignStatesAsync(statePath); // Info: we already validated in asyncVerifyConfig() if state exists
                }
            }

          
            /**
             * == STATE SUBSCRIPTION ==
            * Subscribe to all tableTargetDevices state changes - "off" states only.
             */
            /*
             lib.logExtendedInfo('Subscribing to all target device off states...');
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
            lib.scheduleTriggerTimes();

            /**
             * Re-schedule all trigger times every midnight. Also, refresh astro states.
             * This is required since we are supporting astro times (suncalc)
             */            
            g_midnightSchedule = g_Schedule.scheduleJob('0 0 * * *', () => {
                lib.scheduleTriggerTimes();
                if (lib.latitude && lib.longitude) lib.refreshAstroStatesAsync();
                this.log.info(`Re-scheduling time triggers for updating astro times and updating 'info.astroTimes.' states.`);
            });

        } catch (error) {
            lib.dumpError('Error', error);
            return;
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

            if (stateObject) {

                // State was changed
                this.log.debug(`Subscribed state '${statePath}' changed, new value: [${stateObject.val}] (ack: ${stateObject.ack})`);

                // Check acknowledge (ack)
                if ( ! await lib.isAckPassing(statePath, stateObject)) {
                    this.log.debug(`Subscribed state '${statePath}' change: ack '${stateObject.ack}' is not meeting conditions per isAckPassing()`);
                    return;
                }

                /**
                 * State Change: smartcontrol.0.options.XXX.XXX.active
                 */
                if (statePath.startsWith(`${this.namespace}.options.`) && statePath.endsWith('.active')) {
                    this.log.debug(`State '${statePath}' change --> execute handleStateChangeOptionsActive()`);
                    lib.handleStateChangeOptionsActive(statePath, stateObject);
                } 
                /**
                 * State Change: smartcontrol.0.targetDevices.xxx
                 */                
                else if (statePath.startsWith(`${this.namespace}.targetDevices.`)) {
                    this.log.debug(`State '${statePath}' change --> execute handleStateChangeTargetDevices()`);
                    lib.handleStateChangeTargetDevices(statePath, stateObject);
                } 
                /**
                 * State Change: tableTargetDevices: on/off states
                 */
                else if (
                    (lib.getOptionTableValue('tableTargetDevices', 'onState', statePath, 'name') != undefined)
                    || (lib.getOptionTableValue('tableTargetDevices', 'offState', statePath, 'name') != undefined)
                ) {                    
                    this.log.debug(`State '${statePath}' change --> execute handleStateChangeTargetForeignTargets()`);
                    lib.handleStateChangeTargetForeignTargets(statePath, stateObject);
                }
                /**
                 * State Change: Triggers, so tableTriggerMotion or tableTriggerDevices
                 */                    
                else if (
                    (lib.getOptionTableValue('tableTriggerMotion', 'stateId', statePath, 'name') != undefined)
                    || (lib.getOptionTableValue('tableTriggerDevices', 'stateId', statePath, 'name') != undefined)
                ) {
                    this.log.debug(`State '${statePath}' change --> execute asyncTriggerActivated()`);
                    lib.asyncTriggerActivated(statePath, stateObject);
                }
                /**
                 * State Change: Everything else
                 */
                else {
                    this.log.debug(`State '${statePath}' is subscribed and currently changed, but no action defined in this function to proceed with this state change, which can be fine!`);
                }

            } else {
                /**
                 * The state was deleted
                 */
                // this.log.debug(`state ${id} was deleted.`);
            }

        } catch (error) {
            lib.dumpError('[_asyncOnStateChange]', error);
        }

    }

    /**
     * Initialized by Class constructor and called once adapter shuts down.
     * Callback must be called under any circumstances!
     * @param {() => void} callback
     */
    _onUnload(callback) {
        try {
            lib.stopAllTimers();
            lib.stopAllSchedules();
            if(g_midnightSchedule != null) g_midnightSchedule.cancel();
            this.log.info('Stopping adapter instance successfully proceeded...');
            callback();
        } catch (error) {
            lib.dumpError('Error while stopping adapter', error);
            callback();
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