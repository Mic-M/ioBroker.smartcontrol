'use strict';

// https://forum.iobroker.net/topic/33691/planung-neuer-adapter-licht-raumsteuerung-und-mehr/14

// !! ISSUE Adapter Admin Config: https://github.com/ioBroker/ioBroker.admin/issues/590


// The adapter-core module gives you access to the core ioBroker functions you need to create an adapter
const utils = require('@iobroker/adapter-core');

// More global variables
const g_SunCalc = require('suncalc2');                    // SunCalc
const g_Library = require(__dirname + '/lib/library.js'); // Library Class
const g_Timer   = require(__dirname + '/lib/timer.js');     // MyTimer Class
let   lib       = null;                                   // the library class


// Adapter Configuration Input Validation of Tables
const g_tableValidation = [
    {
        tableName: 'Triggers: Motion Sensors',   // Name of table, just for logging purposes
        tableId: 'tableTriggerMotion',
        check_1: {id: 'stateId', type:'statePath', deactivateIfError:true },
        check_2: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
        check_3: {id: 'duration', type:'number', numberLowerLimit: 2, deactivateIfError:true },
        check_5: {id: 'briStateId', type:'statePath', deactivateIfError:true },
        check_4: {id: 'briThreshold', type:'number', deactivateIfError:true },
    },
    {
        tableName: 'Triggers: Other Devices',
        tableId: 'tableTriggerDevices',
        check_1: {id: 'stateId', type:'statePath', deactivateIfError:true },
        check_2: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
    },
    {
        tableName: 'Target Devices',
        tableId: 'tableTargetDevices',
        check_1: {id: 'onState', type:'statePath', deactivateIfError:true },
        check_2: {id: 'onValue', type:'stateValue', stateValueStatePath:'onState', deactivateIfError:true },
        check_3: {id: 'offState', type:'statePath', deactivateIfError:true },
        check_4: {id: 'offValue', type:'stateValue', stateValueStatePath:'offState', deactivateIfError:true },
    },    
    {
        tableName: 'Rooms',
        tableId: 'tableRooms',
        check_1: {id: 'triggers', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'targets', type:'notEmpty', deactivateIfError:true },
    },    
    {
        tableName: 'Conditions',
        tableId: 'tableConditions',
        check_1: {id: 'conditionState', type:'statePath', deactivateIfError:true },
        check_2: {id: 'conditionValue', type:'stateValue', stateValueStatePath:'conditionState', deactivateIfError:true },
    },
    {
        tableName: 'Schedules',
        tableId: 'tableSchedules',
        check_1: {id: 'roomName', type:'notEmpty', deactivateIfError:true },
        check_2: {id: 'start', type:'time', deactivateIfError:true },
        check_3: {id: 'end', type:'time', deactivateIfError:true },
    },

];


class SmartControl extends utils.Adapter {

    /**
     * Basic Adapter constructor stuff
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({    // to access the object's parent
            ...options,
            name: 'smartcontrol',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Called once ioBroker databases are connected and adapter received configuration.
     */
    async onReady() {

        // Add our libs
        lib = new g_Library(this, g_SunCalc, g_Timer);

        // Get latitude/longitude from ioBroker admin main configuration.
        lib.latitude = await lib.asyncGetSystemConfig('latitude');
        lib.longitude = await lib.asyncGetSystemConfig('longitude');
        if (!lib.latitude || !lib.longitude) {
            this.log.warn('Latitude/Longitude is not defined in ioBroker main configuration, so you will not be able to use Astro functionality for schedules.');
        }

        // Validate Adapter Admin Configuration
        if (await lib.asyncVerifyConfig(g_tableValidation) == false) return;

        // Subscribe to Trigger States
        this.subscribeToTriggerStates();

        // Initialize Timers
        lib.initializeMotionSensorTimers();



    }

    /**
     * Subscribing to all Trigger states (both motion sensors and other devices tables)
     */
    async subscribeToTriggerStates() {

        lib.logInfo('Subscribing to all trigger states...');

        // We subscribe to triggers: Motion
        for (const lpRow of this.config.tableTriggerMotion) {
            if (lpRow.active) {
                const statePath = lpRow.stateId; // like '0_userdata.0.motion-sensor.Bathroom.motion' 
                this.subscribeForeignStates(statePath); // we validated in asyncVerifyConfig() if state exists
            }
        }

        // We subscribe to triggers: Other devices
        for (const lpRow of this.config.tableTriggerDevices) {
            if (lpRow.active) {
                const statePath = lpRow.stateId; // like '0_userdata.0.motion-sensor.Bathroom.motion' 
                this.subscribeForeignStates(statePath); // we validated in asyncVerifyConfig() if state exists
            }
        } 

    }


    /**
     * Called thru onStateChange() once a subscribed state changes.
     * ---------------------------------------------------------------------------
     * !! -> https://forum.iobroker.net/topic/34019/frage-zu-subscribeforeignstates-ack
     * 
     * @param {string} statePath   State Path
     */
    async myOnStateChange(statePath) {

        // For an activated trigger, get the according rows of schedule table.
        const scheduleRows = await lib.getSchedulesOfTriggerDevice(statePath);
        if(lib.isLikeEmpty(scheduleRows)) return;

        // Verify if schedule conditions are met
        if (! await lib.verifyIfScheduleConditionsTrue(scheduleRows)) return;

        // Schedule conditions met, so let's switch devices and set timers accordingly.
        if (! await lib.asyncSwitchTargetDevices(scheduleRows, statePath)) return;

        
    }



    // ================================================================================================================================
    // ================================================ GENERIC ADAPTER STUFF PROVIDED BY ADAPTER CREATOR =============================
    // ================================================================================================================================

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        lib.stopAllTimers();
        try {
            this.log.info('Stopping adapter instance successfully proceeded.');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.myOnStateChange(id); // Added by Mic-M
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.debug(`state ${id} was deleted.`);
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