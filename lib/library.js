'use strict';

/**
 * Library
 *
 * @class Library
 * @description Library of various functions.
 * @author Mic-M <https://github.com/Mic-M/>
 * @license MIT License
 * @version 0.1
 */
class Library {

    /**
     * Constructor
     *
     * @param    {object}    adapter        ioBroker adapter object
     * @param    {object}    sunCalc        suncalc
     * @param    {object}    Timer          MyTimer class
     *
     */
    constructor(adapter, sunCalc, Timer) {
        this._adapter = adapter;
        this._sunCalc = sunCalc;
        this._timer = Timer;
        this.latitude = 0;
        this.longitude = 0;
        this._timers = {}; // Here we keep all timers
        this._timers.motion = {};

    }

    /**
     * Stop all timers
     */
    stopAllTimers() {
        // loop through objects by for...in
        for (const timerType in this._timers) {
            // timerType is e.g. 'motion'
            for (const timerName in this._timers[timerType]) {
                this._timers[timerType][timerName].stop();
            }
        }   
    }


    /**
     * Initializes all motion sensor timers.
     */
    initializeMotionSensorTimers() {
        for (const lpMotionRow of this._adapter.config.tableTriggerMotion) {
            if (lpMotionRow.active) {
                if(this._timers) {
                    this._timers.motion[lpMotionRow.name] = new this._timer('Motion: ' + lpMotionRow.name);
                }
            }
        }
    }


    /**
     * Logs information to ioBroker log.
     * If "extendedInfoLog" in adapter settings is disabled, log level is debug.
     * @param {string}   msg    The log message
     */
    logInfo(msg) {
        if(this._adapter.config.extendedInfoLog) {
            this._adapter.log.info(msg);
        } else {
            this._adapter.log.debug(msg);
        }
    }

    /**
     * Set timeout to switch devices off if a motion sensor was triggered and switch off time (duration) is provided.
     * 
     * @param {object} cP   Configuration parameters per getConfigParametersForTriggerState()
     * 
     */
    async setTimerMotionSensor(cP) {

        // Go out if no duration is set
        if (!cP.motionDuration || cP.motionDuration < 0 ) return;

        // Get all target device state paths and values
        const targetDeviceStatePaths = [];
        const targetDeviceStateValues = [];
        const targetDeviceNamesFinal = [];
        for(const lpTargetName of cP.targetDeviceNames) {
            // Get target device information
            const targetOffState = this.getOptionTableValue('tableTargetDevices', 'deviceName', lpTargetName, 'offState');
            const targetOffVal   = this.getOptionTableValue('tableTargetDevices', 'deviceName', lpTargetName, 'offValue');

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

        // Set timeout to turn off all target states once timeout reached.
        this._timers.motion[cP.triggerName] = new this._timer('Motion: ' + cP.triggerName, cP.motionDuration * 1000, async ()=> {

            for (let i = 0; i < targetDeviceStatePaths.length; i++) {
                // All are having same length and association per each element
                const lpStatePath = targetDeviceStatePaths[i];
                const lpStateValToSet  = targetDeviceStateValues[i];
                const lpTargetName = targetDeviceNamesFinal[i];
    
                // Check if device is already off. We do this by checking if current value != new value
                const targetOffStateValCurrent = await this.asyncGetForeignStateValue(lpStatePath);

                if (targetOffStateValCurrent != null) {
                    if (lpStateValToSet != targetOffStateValCurrent) {
                        // current value != new value, so we can execute turning it off
                        // * no need to use await here, since we can continue accordingly.
                        this._adapter.setForeignState(lpStatePath, lpStateValToSet, (err) => {
                            if (!err) {
                                this.logInfo(`Target device '${lpTargetName}' successfully turned off per ${cP.motionDuration}s timer.`);
                            } else {
                                this._adapter.log.error(`Error while setting state '${lpStatePath}' to turn device off (likely due to permission issue). Error: ${err}`);
                            }
                        });                            
                    } else {
                        this.logInfo(`Timeout of '${cP.motionDuration}' seconds reached, but target device '${lpTargetName}' is already turned off, so no action at this point.`);
                    }
                } else {
                    this._adapter.log.error(`Timeout of '${cP.motionDuration}' seconds reached, but could not get current state value of '${lpStatePath}', so unable to turn device off.`);
                }
            }  

        });
        this._timers.motion[cP.triggerName].start();
    }

    /**
     * For given triggerStatePath and associated schedule rows, get all needed values
     * @param {string} triggerStatePath   State Path of the trigger
     * @return {Promise<object|null>}     The return object. We return null in case of errors
     */
    async getConfigParametersForTriggerState(triggerStatePath) {
        
        // The return object
        const cP = {
            triggerStatePath: triggerStatePath,
            // {string}  triggerName            Name of Trigger
            // {string}  triggerStateVal        Trigger state value
            // {boolean} triggerIsMotion        Is trigger a motion sensor?
            // {number}  motionDuration         Duration (timer) is seconds for motion sensor
            // {string}  motionBriStatePath     State Path of brightness state
            // {number}  motionBriThreshold     Threshold of brightness
            // {array}   scheduleRows           The "Schedule" table rows which were triggered.
            // {array}   targetDeviceNames      Target device names
        };

        /**
         * For an activated trigger, get the according rows of schedule table.
         */
        cP.scheduleRows = await this.getSchedulesOfTriggerDevice(triggerStatePath);
        if(this.isLikeEmpty(cP.scheduleRows)) return null;

        /**
         * Triggers - Motion Sensors 
         */
        for (const lpRow of this._adapter.config.tableTriggerMotion) {
            if (lpRow.active && lpRow.stateId == triggerStatePath) {
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
            if (lpRow.active && lpRow.stateId == triggerStatePath) {
                cP.triggerIsMotion = false;
                cP.triggerName = lpRow.name;
                cP.triggerStateVal = lpRow.stateVal;
                break;
            }
        }        

        // Check if we actually found the state path in one of the trigger tables
        if (this.isLikeEmpty (cP.triggerName)) {
            this._adapter.log.error(`State ${triggerStatePath} not found in options trigger tables.`);
            return null;
        }


        /**
         * Get the target device names for all schedule rows matching criteria.
         */
        let allTargetDeviceNames = [];
        for (const lpScheduleRow of cP.scheduleRows) {
            const targetDeviceNames = this.getOptionTableValue('tableRooms', 'roomName', lpScheduleRow.roomName, 'targets');
            if (this.isLikeEmpty(targetDeviceNames)) {
                this._adapter.log.error(`No target devices for room ${lpScheduleRow.roomName} found.`);
                return null;
            }
            allTargetDeviceNames = allTargetDeviceNames.concat(targetDeviceNames);
        }
        allTargetDeviceNames = this.uniqueArray(allTargetDeviceNames); // Remove duplicates
        if(!this.isLikeEmpty(allTargetDeviceNames)) {
            cP.targetDeviceNames = allTargetDeviceNames;
        } else {
            this._adapter.log.error(`No target devices found at all.`);
            return null;
        }        

        // Return result
        return cP;


    }



    /**
     * Switch all target devices.
     * * Note: No need to remove duplicates, this is being taken care of with asyncVerifyConfig() function.
     * TODO: Timer auf "Always off after x secs" setzen
     * TODO: Einbauen:  "Lichter die über einen Schalter vor Bewegungserkennung eingeschaltet wurden, werden nicht erfasst und somit auch nicht automatisch ausgeschalten."
     * 
     * @param {array}  scheduleRows       The "Schedule" table rows which were triggered.
     * @param {string} triggerStatePath   State Path of the trigger
     * @return {Promise<boolean>}                  True if successful, false if not.
     */
    async asyncSwitchTargetDevices(scheduleRows, triggerStatePath) {

        try {

            // Current parameters/options as object. See getConfigParametersForTriggerState() for details.
            const cP = await this.getConfigParametersForTriggerState(triggerStatePath);

            // Loop thru the target device names and switch accordingly.
            for (const lpTargetDeviceName of cP.targetDeviceNames) {

                // Get option values
                const lpTargetOnState = this.getOptionTableValue('tableTargetDevices', 'deviceName', lpTargetDeviceName, 'onState');
                const lpTargetOnVal   = this.getOptionTableValue('tableTargetDevices', 'deviceName', lpTargetDeviceName, 'onValue');

                // Go out if state does not exist.
                if (! await this._adapter.getForeignObjectAsync(lpTargetOnState)) {
                    this._adapter.log.error(`State '${lpTargetOnState}' of device '${lpTargetDeviceName}' does not exist.`);
                    return false;
                }

                // Set target state.
                // * Verification of the state value and conversion as needed was performed already by asyncVerifyConfig()
                // TODO: Would be nice to confirm only if ack:true and provide warning if no ack:true
                await this._adapter.setForeignStateAsync(lpTargetOnState, {val: lpTargetOnVal, ack: false });
                this._adapter.log.info(`Target device '${lpTargetDeviceName}' switched on since a trigger '${cP.triggerName}' was activated.`);

            }
            // Set Motion Sensor timer
            if (cP.triggerIsMotion) await this.setTimerMotionSensor(cP);
            
            // Done.
            return true;

        } catch (error) {
            this._adapter.log.error(`[asyncSwitchTargetDevices] ${error.message}, stack: ${error.stack}`);
            return false;
        }

    }



    /**
     * For an activated trigger, get the according rows of schedule table.
     * Concept
     * 1. Loop thru tables "Motion Sensors" and "Other Devices" if trigger state is found.
     * 2. Once found:
     *    a) Check in table "Rooms/Areas", id value in "Triggers" is existing
     *    b) If yes: 
     *         1)  Get "room name" from table "Rooms/Areas"
     *         2)  Check table "Schedules" if room is existing
     *         3)  If it exists, add schedule table row to result array
     * 
     * @param {string} triggerStatePath   State Path of device that was triggered
     * @return {Promise<array>}           Array: rows from Schedule table, which are associated with the trigger.
     */
    async getSchedulesOfTriggerDevice(triggerStatePath) {

        try {

            // First, get all trigger names (both motion sensors and other device)
            const triggerDeviceNames = [];
            const triggerTableRows = this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices); // combine both arrays since same structure
            for (const lpTriggerTableRow of triggerTableRows) {
                if (lpTriggerTableRow.active && (triggerStatePath == lpTriggerTableRow.stateId) ) {
                    triggerDeviceNames.push(lpTriggerTableRow.name);
                }
            }

            // Next, check the table "Rooms/Areas" for any rows containing this device name in column triggers
            const finalScheduleRows = [];
            for (const lpDeviceName of triggerDeviceNames) {
                for (const lpRowTableRooms of this._adapter.config.tableRooms) {
                    if (lpRowTableRooms.active && lpRowTableRooms.triggers && Array.isArray(lpRowTableRooms.triggers)) {
                        /** @type {array} */
                        const triggers = lpRowTableRooms.triggers;
                        if ( (triggers.includes(lpDeviceName) ) ) {
                            /**
                             * We need to go to the table schedules. We use the room name, in which we found the trigger.
                             * Since multiple schedules can be set for one room/are, we get all rows containing the room name into
                             * 'scheduleRows'.
                             */
                            for (const lpRowTableSchedules of this._adapter.config.tableSchedules) {
                                if (lpRowTableSchedules.active && (lpRowTableRooms.roomName == lpRowTableSchedules.roomName) ) {
                                    finalScheduleRows.push(lpRowTableSchedules);
                                }
                            }
                        }
                    }
                }
            }        

            if(!this.isLikeEmpty(finalScheduleRows)) {
                // length cannot be 0 at this point.
                if (triggerDeviceNames.length == 1) {
                    this.logInfo(`Trigger activation '${triggerDeviceNames[0]}' successfully recognized.`);
                } else {
                    this.logInfo(`Trigger activation ${JSON.stringify(triggerDeviceNames)} successfully recognized.`);
                }
                return finalScheduleRows;
            } else {
                if (triggerDeviceNames.length == 0) {
                    // This should actually never happen, since trigger state is subscribed per config table and therefore must be found in config table.
                    this._adapter.log.error(`Trigger activated but state not found in admin options trigger tables. Trigger state: '${triggerStatePath}'`);
                } else if (triggerDeviceNames.length == 1) {
                    this._adapter.log.error(`Trigger activation '${triggerDeviceNames[0]}' failed: no schedules found in schedule table.`);
                } else {
                    this._adapter.log.error(`Trigger activation ${JSON.stringify(triggerDeviceNames)} failed: no schedules found in schedule table.`);
                }
                return [];
            }

        } catch (error) {
            this._adapter.log.error(`[getSchedulesOfTriggerDevice ${error.message}, stack: ${error.stack}`);
            return [];
        }

    }



    /**
     * Is called once a trigger was activated for a room set in table "Schedule"
     * @param {array}    scheduleRows               An array of all "Schedule" table rows which were triggered (per trigger -> room)
     * @return {Promise<boolean>}                   Return true if schedule conditions met, and false otherwise.
     */
    async verifyIfScheduleConditionsTrue (scheduleRows) {

        try {
            /**
             * Since multiple schedules per room are possible, we loop thru every schedule table row which contains 
             * the room name which was containing the trigger.
             */
            let isHit = false;
            for (const lpRowTableSchedule of scheduleRows) {

                this._adapter.log.debug(`Trigger is associated with following schedule table row: ${JSON.stringify(lpRowTableSchedule)}`);
                // This is what we have as table row: {"active":true,"roomName":"Bathroom Ground Floor","start":"06:00","end":"sunset-20","mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":false,"sun":false,"additionalConditions":[],"never":[]}
        
                // A few variables / constants
                const tsCurrent = Date.now();   // the current timestamp
                let doContinue = true;          // flag if we can continue.
        
                // First – check if current time is within the schedule times        
                if (doContinue) doContinue = this.scheduleIsTimeStampWithinPeriod(tsCurrent, lpRowTableSchedule.start, lpRowTableSchedule.end, lpRowTableSchedule.roomName);
        
                // Next, check if current day is within the mon-sun options as set in schedules tables.
                if (doContinue) doContinue = this.scheduleIsWeekdayMatching(lpRowTableSchedule, tsCurrent);
        
                // Next, check additional conditions (like Public Holiday, etc. -- as set in conditions table)
                if (doContinue) doContinue = await this.asyncAreScheduleConditionsMet(lpRowTableSchedule.additionalConditions, true);
        
                // Next, check conditions "Never if"
                if (doContinue) doContinue = await this.asyncAreScheduleConditionsMet(lpRowTableSchedule.never, false);
        
                // All checks done.
                if (doContinue) {
                    this._adapter.log.debug(`Schedule for room '${lpRowTableSchedule.roomName}' is meeting conditions`);
                    isHit = true;
                    break;
                } else {
                    this._adapter.log.debug(`Schedule for room '${lpRowTableSchedule.roomName}' is NOT meeting conditions`);
                }
            }

            if (isHit) {
                this.logInfo(`Trigger is matching a schedule.`);
                return true;
            } else {
                this.logInfo(`Trigger is not matching a schedule, so no further action at this point.`);
                return false;
            }
         
            
        } catch (error) {
            this._adapter.log.error(`[verifyIfScheduleConditionsTrue] ${error.message}, stack: ${error.stack}`);
            return false;
        }

    }


    /**
     * Check if additional conditions are met (like Public Holiday, etc. -- as set in conditions table).
     * All conditions must be met.
     * 
     * @param {array}  conditionNames   Array of condition names
     * @param {boolean} allMustMeet    if true: all conditions must be met, if false: one condition is enough
     * @param {boolean} [inverse]      if true: inverse results (true -> false, and vice versa)
     * @return {Promise<boolean>}  True if condition(s) met, false if not. Also return true, if empty conditionNames array
     */
    async asyncAreScheduleConditionsMet(conditionNames, allMustMeet, inverse=false) {
        
        this._adapter.log.debug(`+++ START +++ asyncAreScheduleConditionsMet()`);

        // If empty array, we return true, as we need to continue if no conditions are set in the options table.
        if (this.isLikeEmpty(conditionNames) ) {
            this._adapter.log.debug(`No condition(s) in schedule, so we return "true" to continue.`);
            return true;
        }

        let hitCount = 0;

        this._adapter.log.info(`==== Start processing conditions '${JSON.stringify(conditionNames)}' ====`);

        for (const lpConditionName of conditionNames) {

            this._adapter.log.info(`--- Processing condition '${lpConditionName}' ---`);

            if (hitCount > 0 && allMustMeet == false) break;
            
            const lpConditionStatePath = this.getOptionTableValue('tableConditions', 'conditionName', lpConditionName, 'conditionState');
            const lpConditionStateValue = this.getOptionTableValue('tableConditions', 'conditionName', lpConditionName, 'conditionValue');

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
                this._adapter.log.info(`asyncAreScheduleConditionsMet(): Condition '${lpConditionName}' *met*.`);
                hitCount++;
                if (allMustMeet) {continue;} else {break;}                
            } else {
                // No hit, so go out!
                this._adapter.log.info(`asyncAreScheduleConditionsMet(): Condition '${lpConditionName}' *not* met.`);
                if (allMustMeet) {break;} else {continue;}                
            }

        }

        let result = false;
        if ( (allMustMeet && ( hitCount == conditionNames.length )) || (!allMustMeet && ( hitCount > 0 )) ) 
            result = true;

        if (inverse) result = !result;

        if(result) {
            this._adapter.log.info(`asyncAreScheduleConditionsMet() +++ Final Result: matching +++`);
            return true;
        } else {
            this._adapter.log.info(`asyncAreScheduleConditionsMet() +++ Final Result: NOT matching +++`);
            return false;
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
                // State does not exist
                this._adapter.log.error(`State '${statePath}' does not exist.`);
                return null;
            } else {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const lpStateValueObject = await this._adapter.getForeignStateAsync(statePath);
                if (! this.isLikeEmpty(lpStateValueObject)) {
                    return lpStateValueObject.val;
                } else {
                    this._adapter.log.error(`Unable to retrieve info from state '${statePath}'.`);
                    return null;
                }
            }
        } catch (error) {
            this._adapter.log.error(`[asyncGetForeignStateValue] ${error.message}, stack: ${error.stack}`);
            return null;
        }

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
                this._adapter.log.debug(`Current weekday '${lpWeekdayGiven}' *is* matching schedule of '${row.roomName}'.`);
                return true;
            }
        }        
        // There was no hit, so we return false.
        this._adapter.log.debug(`Current weekday '${lpWeekdayGiven}' is *not* matching schedule of '${row.roomName}'.`);
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
     * @param {string} ofWhat   Typically room/area name. For logging purposes only.
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
        this._adapter.log.debug(`tsGiven: '${tsGiven}', tsStart: '${tsStart}', tsEnd: '${tsEnd}'`);
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
            ts = roundTimeStampToNearestMinute(ts);
            ts = ts + (offsetMinutes * 60 * 1000);
            return ts;
        } catch (error) {
            this._adapter.log.error(`[getAstroNameTs] ${error.message}, stack: ${error.stack}`);
            return 0;
        }

        /**
         * Rounds the given timestamp to the nearest minute
         * Inspired by https://github.com/date-fns/date-fns/blob/master/src/roundToNearestMinutes/index.js
         * 
         * @param {number}  ts   a timestamp
         * @return {number}      the resulting timestamp
         */
        function roundTimeStampToNearestMinute(ts) {

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
            this._adapter.log.error(`[asyncGetSystemConfig] ${error.message}, stack: ${error.stack}`);
            return;
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
            this._adapter.log.debug('[func getOptionTableValue] tableRow JSON: ' + JSON.stringify(tableRow));
            this._adapter.log.debug('[func getOptionTableValue] is tableRow active: ' + tableRow.active);
            if (tableRow.active) {
                if (tableRow[identifierId] == identifierName) {
                    // We got a hit
                    return tableRow[resultId];
                } else {
                    // no hit
                }
            } else {
                this._adapter.log.warn(`Config Table '${tableId}', row '${identifierName}', is not active.`);
            }
        }
        // Nothing found, return undefined
        return undefined;
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

        input = input.replace(/\s/g,''); // remove all whitespaces

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
            if (hour < 0 || hour > 23 || min < 0 || min > 60 ) {
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


    /**
     * Verify adapter configuration table
     * @param {array} toCheckArray    Array of what to check
     * @return {Promise<boolean>}   passed   Returns true if no issues, and false if error(s).
     */
    async asyncVerifyConfig(toCheckArray) {

        try {
            
            let errors = 0;

            // FIRST: Check the config array
            for (const toCheck of toCheckArray) {

                const table = this._adapter.config[toCheck.tableId];

                let counter = 0;
            
                if (this.isLikeEmpty(table)) {
                    this._adapter.log.info('[Config Table \'' + toCheck.tableName + '\'] No rows defined.');
                    return false;
                } 
            
                for (let i = 0; i < table.length; i++) {
                    if (table[i].active) {
                        counter++;
            
                        // gibt alle Keys mit 'check_' als Array zurück, also z.B. ['check_1','check_2']. Oder leeres Array [] falls nichts vorhanden
                        const lpCriteriaToCheck = (Object.keys(toCheck).filter(str => str.includes('check_'))); 
                        
                        for (const lpCheckKey of lpCriteriaToCheck) {
            
                            // lpCheckKey = check_1, or check_2, etc. lpCheckVal = like {id: 'stateId', type:'statePath', deactivateIfError:true }
                            const lpCheckVal = toCheck[lpCheckKey]; 
            
                            // like: "duration", "stateVal", etc
                            // const lpValueContent = lpCheckVal.id;
                            
                            // like: 'true', 'false', 'Play Music', etc.
                            const lpTableValue = table[i][lpCheckVal.id];

                            // +++++++ VALIDATION TYPE: a state path like "0_userdata.0.teststate" +++++++
                            if (lpCheckVal.type == 'statePath') {
                                const lpStatePath = table[i][lpCheckVal.id];
                                const lpStateObject = await this._adapter.getForeignObjectAsync(lpStatePath);
                                if (!lpStateObject) {
                                    // State does not exist
                                    this._adapter.log.error(`[Config Table '${toCheck.tableName}'] State '${lpStatePath}' does not exist.`);
                                    if (lpCheckVal.deactivateIfError) table[i].active = false;
                                    errors++;
                                }                        
                            // +++++++ VALIDATION TYPE: Value to be set to a certain state +++++++
                            } else if (lpCheckVal.type == 'stateValue') {
                                const lpStatePath = table[i][lpCheckVal.stateValueStatePath];
                                const lpStateObject = await this._adapter.getForeignObjectAsync(lpStatePath);
                                if (!lpStateObject) {
                                    // State does not exist
                                    this._adapter.log.error(`[Config Table '${toCheck.tableName}'] State '${lpStatePath}' does not exist.`);
                                    if (lpCheckVal.deactivateIfError) table[i].active = false;
                                    errors++;
                                } else {
                                    // State exists
                                    // Verify State Type (like boolean, switch, number)
                                    const lpStateType = lpStateObject.common.type;
            
                                    if (lpStateType == 'boolean' || lpStateType == 'switch') {
                                        if (lpTableValue != 'true' && lpTableValue != 'false') {
                                            this._adapter.log.error('[Config Table \'' + toCheck.tableName + '\'] State "' + lpStatePath + '" is expecting boolean (true/false), but you set [' + lpTableValue + ']');
                                            if (lpCheckVal.deactivateIfError) table[i].active = false;
                                            errors++;
                                        } else {
                                            if (lpTableValue == 'true') this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = true;
                                            if (lpTableValue == 'false') this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = false;
                                        }
                                    } else if (lpStateType == 'number') {
                                        if(! this.isNumber(lpTableValue) ) {
                                            this._adapter.log.error('[Config Table \'' + toCheck.tableName + '\'] State "' + lpStatePath + '" is expecting a number, but you set [' + lpTableValue + ']');
                                            if (lpCheckVal.deactivateIfError) table[i].active = false;
                                            errors++;
                                        } else {
                                            this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = parseFloat(lpTableValue);
                                        }
                                    } else if (this.isLikeEmpty(lpTableValue)) {
                                        // Let's convert an "like empty" value to an empty string, just to make sure....
                                        this._adapter.config[toCheck.tableId][i][lpCheckVal.id] = '';
                                    }
                                }                    
                            // +++++++ VALIDATION TYPE: a number +++++++
                            } else if (lpCheckVal.type == 'number') {
                                const lpNumberToCheck = table[i][lpCheckVal.id];
                                if(! this.isNumber(lpNumberToCheck) ) {
                                    this._adapter.log.error('[Config Table \'' + toCheck.tableName + '\'] Field "' + lpCheckVal.id + '" is expecting a number, but you set [' + lpTableValue + ']');
                                    if (lpCheckVal.deactivateIfError) table[i].active = false;
                                    errors++;
                                // check for lower limit, if 'numberLowerLimit' set in toCheck object
                                } else if (! this.isLikeEmpty(lpCheckVal.numberLowerLimit)) {
                                    if(parseInt(lpNumberToCheck) < lpCheckVal.numberLowerLimit) {
                                        this._adapter.log.error('[Config Table \'' + toCheck.tableName + '\'] Number in field "' + lpCheckVal.id + '" is smaller than ' + lpCheckVal.numberLowerLimit + ', this does not make sense at all!');
                                        if (lpCheckVal.deactivateIfError) table[i].active = false;
                                        errors++;
                                    }
                                // check for upper limit, if 'numberUpperLimit' set in toCheck object
                                } else if (! this.isLikeEmpty(lpCheckVal.numberUpperLimit)) { 
                                    if(parseInt(lpNumberToCheck) < lpCheckVal.numberUpperLimit) {
                                        this._adapter.log.error('[Config Table \'' + toCheck.tableName + '\'] Number in field "' + lpCheckVal.id + '" is greater than ' + lpCheckVal.numberUpperLimit  + ', this does not make sense at all!');
                                        if (lpCheckVal.deactivateIfError) table[i].active = false;
                                        errors++;
                                    }
                                }
                            // +++++++ VALIDATION TYPE: not empty +++++++
                            } else if (lpCheckVal.type == 'notEmpty') {
                                const lpToCheck = table[i][lpCheckVal.id];
                                if(this.isLikeEmpty(lpToCheck) ) {
                                    this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] Field "' + lpCheckVal.id + '" is empty.');
                                    if (lpCheckVal.deactivateIfError) table[i].active = false;
                                    errors++;
                                }
                            // +++++++ VALIDATION TYPE: not empty +++++++
                            } else if (lpCheckVal.type == 'time') {
                                const lpToCheck = table[i][lpCheckVal.id];
                                if(! this.getTimeInfoFromAstroString(lpToCheck, false) ) {
                                    this._adapter.log.error(`[Config Table '${toCheck.tableName}'] No valid time in field '${lpCheckVal.id}': '${lpTableValue}'`);
                                    if (lpCheckVal.deactivateIfError) table[i].active = false;
                                    errors++;
                                }
                            }    


                        }
            
                    }
                }

                if (counter == 0) {
                    this._adapter.log.warn('[Config Table \'' + toCheck.tableName + '\'] No rows defined.');
                    errors++;
                }

                // We altered table variable, so set into adapter config
                this._adapter.config[toCheck.tableId] = table;

            }

            // SECOND: Certain table values must be unique.
            const uniqueCheckObjects = [
                // name: for logging only, column: the table to check, rows: the adapter config table rows
                { name:'Trigger Tables Motion/Other: Names',        column:'name',          rows:this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices) },
                { name:'Target device table: Names',                column:'deviceName',    rows:this._adapter.config.tableTargetDevices },
                { name:'Room/Area table: Names',                    column:'roomName',      rows:this._adapter.config.tableRooms },
                { name:'Conditions table: Names',                   column:'conditionName', rows:this._adapter.config.tableConditions },
                { name:'Trigger Tables Motion/Other: State Paths',  column:'stateId',       rows:this._adapter.config.tableTriggerMotion.concat(this._adapter.config.tableTriggerDevices) },
            ];
            for (const lpCheckObj of uniqueCheckObjects) {
                if (!this.isLikeEmpty(lpCheckObj.rows)) {
                    const allValues = [];
                    for (const lpRow of lpCheckObj.rows) {
                        allValues.push(lpRow[lpCheckObj.column]);
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
                this._adapter.log.error(`[Config Verification] ${errors} error(s) found while verifying your adapter configuration. You must fix all error to be able to use the adapter.`);
                return false;
            }

        } catch (error) {
            this._adapter.log.error(`[asyncVerifyConfig] : ${error.message}, stack: ${error.stack}`);
            return false;
        }
    }




    /** 
     * Check if state exists 
     * @param {string} str  State path
     * @return {Promise<boolean>} 
     */
    async asyncStateExists (str) {

        try {
            const ret = await this._adapter.getForeignObjectAsync(str);
            if (ret == undefined) {
                return false;
            } else {
                return true;
            }
        } catch (error) {
            this._adapter.log.error(`[asyncStateExists] : ${error.message}, stack: ${error.stack}`);
            return false;
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
     * @param {string} str   The input string
     * @param {RegExp} regex Regex of chars to be removed, like /[\][*,;'"`<>\\?]/g
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
     * @param {*} myArray   The given array
     * @return {boolean}    true if it is unique, false otherwise.
     */
    isArrayUnique(myArray) {
        return myArray.length === new Set(myArray).size;
    }


    /**
     * Checks if Array or String is not undefined, null or empty.
     * Array or String containing just white spaces or >'< or >"< or >[< or >]< is considered empty
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
            if (strTemp !== '') {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    }


}



module.exports = Library;
