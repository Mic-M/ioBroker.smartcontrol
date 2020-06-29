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
const g_Timer    = require(__dirname + '/lib/timer.js');         // Timer Class
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
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'onState', type:'statePath', deactivateIfError:true },
        check_3: {id: 'onValue', type:'stateValue', stateValueStatePath:'onState', deactivateIfError:true },
        check_4: {id: 'offState', type:'statePath', deactivateIfError:true, optional:true },
        check_5: {id: 'offValue', type:'stateValue', stateValueStatePath:'offState', deactivateIfError:true, optional:true },
    },
    {
        tableName: 'Conditions',
        tableId: 'tableConditions',
        tableMustHaveActiveRows: false,
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'conditionState', type:'statePath', deactivateIfError:true },
        check_3: {id: 'conditionValue', type:'stateValue', stateValueStatePath:'conditionState', deactivateIfError:true },
    },
    {
        tableName: 'Triggers: Motion Sensors',   // Name of table, just for logging purposes
        tableId: 'tableTriggerMotion',
        tableMustHaveActiveRows: false,
        isTriggerTable: true,
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
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
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'stateId', type:'statePath', deactivateIfError:true },
        check_3: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
    },
    {
        tableName: 'Triggers: Times',
        tableId: 'tableTriggerTimes',
        tableMustHaveActiveRows: false,
        isTriggerTable: true,
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'time', type:'timeCron', deactivateIfError:true },
    },

    {
        tableName: 'Rooms/Areas',
        tableId: 'tableAreas',
        tableMustHaveActiveRows: true,
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'triggers', type:'notEmpty', deactivateIfError:true },
        check_3: {id: 'targets', type:'notEmpty', deactivateIfError:true },
    },    
    {
        tableName: 'Schedules',
        tableId: 'tableSchedules',
        tableMustHaveActiveRows: true,
        check_1: {id: 'name', type:'notEmpty', deactivateIfError:true },
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
            lib = await new g_Library(this, g_SunCalc, g_Schedule, g_Timer);

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
             * Validate Adapter Admin Configuration
             */
            if (await lib.asyncVerifyConfig(g_tableValidation)) {
                lib.logInfo('Adapter admin configuration successfully validated...');
            } else {
                throw('Adapter admin configuration validation failed --> Please check your configuration. You will not be able to use this adapter without fixing the issues.');
            }

            /**
             * Create option states if not existing.
             */
            if (! await lib.asyncCreateOptionStates()) {
                throw('We were not able to create option states. Please check your log and configuration. You will not be able to use this adapter without fixing the issues.');
            }

            /**
             * Update option states. Required if admin options were changed.
             */
            await lib.updateOptionStatesFromConfig();

            /**
             * Subscribe to all state changes of 'smartcontrol.x.Options.x.x.active'
             */
            await this.subscribeStatesAsync('Options.*.active');

            /**
             * Subscribe to all trigger state changes
             */
            lib.logInfo('Subscribing to all trigger states...');
            // @ts-ignore -> https://github.com/microsoft/TypeScript/issues/36769
            for (const lpRow of this.config.tableTriggerMotion.concat(this.config.tableTriggerDevices)) {
                if (lpRow.active) {
                    const statePath = lpRow.stateId; // like '0_userdata.0.motion-sensor.Bathroom.motion' 
                    await this.subscribeForeignStatesAsync(statePath); // Info: we already validated in asyncVerifyConfig() if state exists
                }
            }

            /**
             * Schedule all trigger times
             */
            lib.scheduleTriggerTimes();

            /**
             * Re-schedule all trigger times every midnight.
             * This is required since we are supporting astro times (suncalc)
             */            
            g_midnightSchedule = g_Schedule.scheduleJob('0 0 * * *', () => {
                lib.scheduleTriggerTimes();
                this.log.info(`Re-scheduling time triggers for updating astro times.`);
            });


            /**
             * Initialize timers
             */
            lib.initializeMotionSensorTimers();


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

                if (statePath.startsWith(`${this.namespace}.Options.`) && statePath.endsWith('.active')) {

                    // We have an options state like 'smartcontrol.0.Options.Areas.Hallway.active'
                    lib.handleStateChangeOptionsActive(statePath, stateObject);

                } else {

                    // We are having a changed trigger state
                    lib.asyncTargetDeviceTriggered(statePath, stateObject);

                }
              

            } else {
                /**
                 * The state was deleted
                 */
                // this.log.debug(`state ${id} was deleted.`);
            }

        } catch (error) {
            lib.dumpError('Error', error);
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
            g_midnightSchedule.cancel();
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