/* eslint-disable no-irregular-whitespace */
'use strict';

/**
 * @desc    Generic Helper Functions
 * @author  Mic-M <https://github.com/Mic-M/ioBroker.smartcontrol>
 * @license MIT
 */
module.exports = function (adapter) {

    return {

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
                        adapter.log.error(`asyncCreateForeignStates(): invalid parameter provided to function`);
                        return false;
                    }

                    // Create new state. 
                    // While set(Foreign)ObjectNotExistsAsync takes care if state does not exist, we still check as we also set values afterwards.
                    if (isForeign && ! await this.asyncStateExists(lpStateToCreate.statePath, true)) {
                        await adapter.setForeignObjectNotExistsAsync(lpStateToCreate.statePath, {type:'state', common:lpStateToCreate.commonObject, native: {}});
                    } else if(!isForeign && ! await this.asyncStateExists(lpStateToCreate.statePath, false)) {
                        await adapter.setObjectNotExistsAsync(lpStateToCreate.statePath, {type:'state', common:lpStateToCreate.commonObject, native: {}});
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
                        await adapter.setForeignStateAsync(lpStateToCreate.statePath, initialDefault, false);
                    } else {
                        await adapter.setStateAsync(lpStateToCreate.statePath, initialDefault, false);
                    }                
                    adapter.log.debug(`State '${lpStateToCreate.statePath}' created.`);

                }

                return true;
                

            } catch (error) {
                this.dumpError('[asyncCreateForeignStates()]', error);
                return false;
            }

        },

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
                    ret = await adapter.getForeignObjectAsync(str);
                } else {
                    ret = await adapter.getObjectAsync(str);
                }
                
                if (ret == undefined) {
                    return false;
                } else {
                    return true;
                }
            } catch (error) {
                this.dumpError('[asyncStateExists()]', error);
                return false;
            }

        },

        /**
         * Get foreign state value
         * 
         * @param {string}      statePath  - Full path to state, like 0_userdata.0.other.isSummer
         * @return {Promise<*>}            - State value, or null if error
         */
        async asyncGetForeignStateValue(statePath) {
            try {
                const stateObject = await this.asyncGetForeignState(statePath);
                if (stateObject == null) return null; // error thrown already in asyncGetForeignState()
                return stateObject.val;            
            } catch (error) {
                this.dumpError(`[asyncGetForeignStateValue]`, error);
                return null;
            }

        },  

        /**
         * Get foreign state
         * 
         * @param {string}      statePath  - Full path to state, like 0_userdata.0.other.isSummer
         * @return {Promise<object>}       - State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
         */
        async asyncGetForeignState(statePath) {

            try {
                // Check state existence
                const stateObject = await adapter.getForeignObjectAsync(statePath);

                if (!stateObject) {
                    throw(`State '${statePath}' does not exist.`);
                } else {
                    // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                    const stateValueObject = await adapter.getForeignStateAsync(statePath);
                    if (! this.isLikeEmpty(stateValueObject)) {
                        return stateValueObject;
                    } else {
                        throw(`Unable to retrieve info from state '${statePath}'.`);
                    }
                }
            } catch (error) {
                this.dumpError(`[asyncGetForeignState]`, error);
                return null;
            }

        },

        /**
         * Convert date/time to a local ISO string
         * This function is needed since toISOString() uses UTC +0 (Zulu) as time zone.
         * https://stackoverflow.com/questions/10830357/
         * Mic-M, 04/Apr/2020
         * @param {object}  date    Date object
         * @return {string}  string like "2015-01-26T06:40:36.181", without trailing Z (which would represent Zulu time zone)
         */
        dateToLocalIsoString(date) {
            const timezoneOffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
            return (new Date(date.getTime() - timezoneOffset)).toISOString().slice(0, -1);
        },




        /**
         * For given object of enum objects, get the names and associated ids.
         * enumObj.common.name can be either string like 'Living room' or {en:'Living room', de:'Wohnzimmer', ...}
         * @param {object} enumObj - object of multiple enum objects, so return of getEnumAsync('rooms').result or getEnumAsync('functions').result
         * @param {boolean} [allLanguages=false] if true, it will return all languages (in case user changes ioBroker language after saving options), if false, just the current language
         * @return {object|null} resulting object like {'Bathroom': 'enum.rooms.bathroom', 'Bedroom': 'enum.rooms.bedroom'}, or null if nothing found
         */
        enumsGetNamesAndIds(enumObj, allLanguages=false) {

            try {

                const result = {};
                for (const id in enumObj) { // id = like 'enum.rooms.bathroom'
                    const nameObj = enumObj[id].common.name; // either string like 'Living room' or {en:'Living room', de:'Wohnzimmer', ...}
                    if (typeof nameObj === 'string') {
                        result[nameObj] = id;
                    } else if (typeof nameObj === 'object') {
                        if (allLanguages) {
                            for (const lpLang in nameObj) {
                                result[nameObj[lpLang]] = id;
                            }
                        } else {
                            result[nameObj[adapter.x.systemConfig.language]] = id;
                        }
                        
                    } else {
                        adapter.log.warn(`Getting enum room name for '${id}': type for name must be string or object, but is '${typeof nameObj}'.`);
                    }
                }

                if (!this.isLikeEmpty(result)) {
                    return result;
                } else {
                    return null;
                }

            } catch (error) {
                this.dumpError('[enumsGetNamesAndIds]', error);
                return null;
            }

        },

        /**
         * Restart the adapter instance.
         * Source: https://github.com/foxriver76/ioBroker.xbox/blob/275e03635d657e7b18762166b4feca96fc4b1b1c/main.js#L630
         */
        /*
        async asyncRestartAdapter() {
            
            try {
            
                const resultObject = await adapter.getForeignObjectAsync('system.adapter.' + adapter.namespace);
                if (resultObject) {
                    await adapter.setForeignObjectAsync('system.adapter.' + adapter.namespace, resultObject);
                    return;
                } else {
                    adapter.log.error(`[asyncRestartAdapter()]: getForeignObjectAsync() No object provided from function.`);
                    return;
                }

            } catch (error) {
                adapter.log.error(`[asyncRestartAdapter()]: ${error}`);
                return;
            }
            
        },
        */




        /**
         * Verify acknowledge (ack) once a state was changed.
         * 
         * In General: Any state changes of states will be ignored, if acknowledge (ack) = false.
         * The reason is that adapters confirm states by the acknowledge "ack" flag (setting to true).
         * Reference: https://forum.iobroker.net/post/448606
         * 
         * Exception 1: States under javascript.x/0_userdata.0/alias.x: For states created by users, this behavior can be changed in the adapter options.
         * Exception 2: States under smartcontrol.x.: ack:false only.
         * Exception 3: States which are not under a "real" adapter namespace, so like "Messwerte.0". Reason: Several users have created 
         *              own states in the object main tree, like "Messwerte.0". https://forum.iobroker.net/post/461189
         * 
         * @param {string}                          statePath   - State Path
         * @param {ioBroker.State|null|undefined}   stateObject - State object
         * @return {Promise<object>}     {passing: false; msg:'some message'}
         *                               if state change shall be ignored due to the ack (or error occurred), otherwise true.
         * 
         */
        async isAckPassing(statePath, stateObject) {

            try {

                if (!stateObject || !statePath) 
                    return {passing:false, msg:`Unexpected error: isAckPassing() was no valid statePath or stateObject provided.`};

                const namespace = `${statePath.split('.')[0]}.${statePath.split('.')[1]}`; // like sonos.1

                // For any states under this adapter instance (so )smartcontrol.x), we require ack = false;
                // 22-Jul-2020: we allow different adapter instances as well.
                // if (statePath.startsWith(`${adapter.namespace}.`)) {
                if (statePath.match(/^smartcontrol.\d+./)) {
                    if (stateObject.ack == false) {
                        return {passing:true, msg:`Adapter Instance State (${adapter.namespace}) requires ack:false`};
                    } else {
                        return {passing:false, msg:`Adapter Instance State (${adapter.namespace}) requires ack:false`};
                    }
                }

                // Handle User States
                let isUserState = false;
                if (statePath.startsWith('javascript.') || statePath.startsWith('0_userdata.0') || statePath.startsWith('alias.')) isUserState = true;

                if (!isUserState) {
                    // Check if state is under a "real" adapter namespace.
                    const isRealAdapter = await adapter.getForeignObjectAsync(`system.adapter.${namespace}`);
                    if (!isRealAdapter) isUserState = true;
                }

                if (isUserState) {

                    if (!adapter.config.triggerStatesAck || adapter.config.triggerStatesAck == 'false') {
                        if (stateObject.ack == false) {
                            return {passing:true, msg:`User State (${statePath}) requires ack:false per adapter configuration`};
                        } else {
                            return {passing:false, msg:`User State (${statePath}) requires ack:false per adapter configuration`};
                        }
                
                    } else if (adapter.config.triggerStatesAck == 'true') {
                        if (stateObject.ack == true) {
                            return {passing:true, msg:`User State (${statePath}) requires ack:true per adapter configuration`};
                        } else {
                            return {passing:false, msg:`User State (${statePath}) requires ack:true per adapter configuration`};
                        }
                    } else {
                        // any (ack: true or false)
                        return {passing:true, msg:`User State (${statePath}) can be ack:true or ack:false per adapter configuration`};
                    }

                } else {
                    // For any other "real" adapter state changes, we require ack = true
                    if (stateObject.ack == true) {
                        return {passing:true, msg:`"Real" adapter state (${statePath}) requires ack:true`};
                    } else {
                        return {passing:false, msg:`"Real" adapter state (${statePath}) requires ack:true`};
                    }
                }
            
            } catch (error) {
                this.dumpError('[isAckPassing()]', error);
                return {passing:false, msg:`Unexpected error occurred in isAckPassing()`};
            }

        },


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
                
        },

        /**
         * Get the timestamp of an astro name.
         * 
         * @param {string} astroName            Name of sunlight time, like "sunrise", "nauticalDusk", etc.
         * @param {number} [offsetMinutes=0]    Offset in minutes
         * @return {number}                     Timestamp of the astro name
         */
        getAstroNameTs(astroName, offsetMinutes=0) {

            try {
                let ts = adapter.x.mSuncalc.getTimes(new Date(), adapter.x.systemConfig.latitude, adapter.x.systemConfig.longitude)[astroName];
                if (!ts || ts.getTime().toString() === 'NaN') {
                    // Fix night / nightEnd per adapter options.
                    // In northern areas is no night/nightEnd provided in the Summer. 
                    // So we use 0:00 for night and 2:00 for night end as fallback.
                    if (adapter.config.fixNightNightEnd && ['night', 'nightEnd'].includes(astroName) ) {
                        const currDate = new Date(); 
                        const midnightTs = currDate.setHours(24,0,0,0); // is the future midnight of today, not the one that was at 0:00 today
                        switch (astroName) {
                            case 'night':
                                adapter.log.debug(`[getAstroNameTs] No time found for [${astroName}], so we set 00:00 as fallback per adapter config.`);
                                return midnightTs; // midnight - 00:00
                            case 'nightEnd': 
                                adapter.log.debug(`[getAstroNameTs] No time found for [${astroName}], so we set 02:00 as fallback per adapter config.`);
                                return midnightTs + (1000*3600*2); // 02:00
                        }
                    } else {
                        adapter.log.warn(`[getAstroNameTs] No time found for [${astroName}].`);
                        return 0;
                    }
                }

                ts = this.roundTimeStampToNearestMinute(ts);
                ts = ts + (offsetMinutes * 60 * 1000);
                return ts;
            } catch (error) {
                this.dumpError('[getAstroNameTs()]', error);
                return 0;
            }

        },


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
                hoursMins: '', // like '19:35'
                isAstro: false,
                astroName: '',
                astroHasOffset: false,
                astroOffsetMinutes: 0,
            };

            const matchTime = input.match(/^(\d{1,2})(:)(\d{2})$/);
            const matchAstroName = input.match(/^(sunriseEnd|sunrise|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nauticalDusk|nightEnd|nadir|night|nauticalDawn|dawn)$/g);
            const matchAstroWithOffset = input.match(/^(sunriseEnd|sunrise|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nauticalDusk|nightEnd|nadir|night|nauticalDawn|dawn)(-|\+)(\d{1,3})$/);

            if (matchTime != null) {
                // No Astro.
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
                    returnObject.timestamp = this.getAstroNameTs(input);
                } else if (matchAstroWithOffset != null) {
                    // Astro found, with offset
                    returnObject.isAstro = true;
                    returnObject.astroHasOffset = true;
                    returnObject.astroName = matchAstroWithOffset[1];
                    returnObject.astroOffsetMinutes = parseInt(matchAstroWithOffset[3]);
                    if(matchAstroWithOffset[2] == '-') {
                        returnObject.astroOffsetMinutes = returnObject.astroOffsetMinutes * (-1);
                    }
                    returnObject.timestamp = this.getAstroNameTs(returnObject.astroName, returnObject.astroOffsetMinutes);
                } else {
                    // Nothing found
                    returnObject.full = '';
                }
            }

            // Add hourMins string
            returnObject.hoursMins = this.timestampToTimeString(returnObject.timestamp, true);

            // handle '24:00'. We add a full day.
            if (input == '24:00') {
                returnObject.timestamp = returnObject.timestamp + +1000*60*60*24;
                returnObject.hoursMins = '24:00';
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

        },

        /**
         * Converts a given timestamp into European time. E.g. '9:03pm and 45 seconds' -> '21:03:45'
         * @param   {object}   ts                 Timestamp
         * @param   {boolean}  [noSeconds=false]  if true, seconds will not be added. Result is '21:04' (rounded)
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

        },


        /**
         * Checks if time of '08:30' is between '23:00' and '09:00'.
         * Source/inspired by: https://stackoverflow.com/a/24577309
         * 
         * @param {string}    start - start string, like: '23:00', '07:30', 9:15'
         * @param {string}    end   - end string, like: '08:15', '17:23'
         * @param {string}    check - to check, like: '17:25', '9:30'
         * @return {boolean}  true if in between, false if not
         * 
         */
        isTimeBetween (start, end, check) {


            const timeIsBetween = function(start, end, check) {
                return (start.hour <= end.hour) ? check.isGreaterThan(start) && !check.isGreaterThan(end)
                    : (check.isGreaterThan(start) && check.isGreaterThan(end)) || (!check.isGreaterThan(start) && !check.isGreaterThan(end));    
            };
        
            function getTimeObj (timeString) {
                const t = timeString.split(':');
                const returnObject = {};
                returnObject.hour = parseInt(t[0]);
                returnObject.minutes = parseInt(t[1]);
                returnObject.isGreaterThan = function(other) { 
                    return (returnObject.hour > other.hour) || (returnObject.hour === other.hour) && (returnObject.minutes > other.minutes);
                };
                return returnObject;
            }
        
            return timeIsBetween(getTimeObj(start), getTimeObj(end), getTimeObj(check));
        
        },


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
                this.dumpError('[getTimeoutTimeLeft()]', error);
                return -1;
            }   

        },

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

            try {
        
                // First: convert potential Astro start time to "normal", so like 'sunset-30' to '18:30'
                const givenFinal = this.timestampToTimeString(tsGiven, true);
                const startFinal = this.getTimeInfoFromAstroString(start, true).hoursMins;
                const endFinal   = this.getTimeInfoFromAstroString(end, true).hoursMins;

                if (!givenFinal) throw(`givenFinal is undefined. start: '${start}', end: '${end}', ofWhat: '${ofWhat}'`);
                if (!startFinal) throw(`startFinal is undefined. start: '${start}', end: '${end}', ofWhat: '${ofWhat}'`);
                if (!endFinal) throw(`endFinal is undefined. start: '${start}', end: '${end}', ofWhat: '${ofWhat}'`);

                // Next, check if given time is in between
                if (this.isTimeBetween(startFinal, endFinal, givenFinal)) {
                    adapter.log.debug(`'${ofWhat}' - Current time '${givenFinal}' *is* within schedule times (start: '${startFinal}', end: '${endFinal}).`);
                    return true;                
                } else {
                    adapter.log.debug(`'${ofWhat}' - Current time '${givenFinal}' is *not* within schedule times (start: '${startFinal}', end: '${endFinal}).`);
                    return false;                                
                }

            } catch (error) {
                this.dumpError('[scheduleIsTimeStampWithinPeriod]', error);
                return false;
            }
        },

        /**
         * Check if current day is within the mon-sun options as set in Execution table.
         * 
         * @param {object}  row   The "Execution" table row which was triggered.
         * @param {number}  ts    The timestamp to check.
         * @param {string} ofWhat Typically zone name. For logging purposes only.
         * @return {boolean}      True if matching, false if not.
         */
        scheduleIsWeekdayMatching(row, ts, ofWhat) {
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const lpWeekdayGiven = getWeekDayString(ts);
            for (const lpDay of days) {
                if (lpWeekdayGiven == null) {
                    adapter.log.error(`[scheduleIsWeekdayMatching()] Unable to calculate day of week for given timestamp '${ts}'`);
                    return false;
                } else if ( (row[lpDay] == true) && (lpDay == lpWeekdayGiven) ) {
                    adapter.log.debug(`${ofWhat} - Current weekday '${lpWeekdayGiven}' *is* matching Execution table row.`);
                    return true;
                }
            }        
            // There was no hit, so we return false.
            adapter.log.debug(`${ofWhat} - Current weekday '${lpWeekdayGiven}' is *not* matching Execution table row.`);
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

        },

        /**
         * Checks if an ioBroker state id (path) string is valid. 
         * NOTE: This does not verify if the state is existing. It does just some basic checks if the path looks good-
         * 
         * @param {string}   str     String to validate
         * @return {boolean}         true/false of validation result
         */
        isStateIdValid(str) {

            if (!str || typeof str !== 'string') return false; // String?
            if(str.length < 5) return false; // If string length < 5 chars (minimum state length is 5, assuming this is a valid state: 'x.0.a'
            if (adapter.x.constants.forbiddenStatePaths.test(str)) return false; // If forbidden chars
            if (!/\.\d+\./.test(str)) return false; // If no instance number with a leading and trailing dot "."
            if (str.startsWith(' ') || str.endsWith(' ')) return false; // If spaces at beginning or end
            if (str.startsWith('.') || str.endsWith('.')) return false; // If dots at beginning or end
            return true; // All passed
        },

        /**
         * Logs information to ioBroker log.
         * If "extendedInfoLog" in adapter settings is disabled, log level is debug.
         * @param {string}   msg    The log message
         */
        logExtendedInfo(msg) {
            if(adapter.config.extendedInfoLog) {
                adapter.log.info(msg);
            } else {
                adapter.log.debug(msg);
            }
        },

        /**
         * Error Message to Log. Handles error object being provided.
         *
         * @param {string} msg               - (intro) message of the error
         * @param {*}      [error=undefined] - Optional: Error object or string
         */
        dumpError(msg, error=undefined) {
            if (!error) {
                adapter.log.error(msg);
            } else {
                if (typeof error === 'object') {
                    if (error.stack) {
                        adapter.log.error(`${msg} – ${error.stack}`);
                    } else if (error.message) {
                        adapter.log.error(`${msg} – ${error.message}`);
                    } else {
                        adapter.log.error(`${msg} – ${JSON.stringify(error)}`);
                    }
                } else if (typeof error === 'string') {
                    adapter.log.error(`${msg} – ${error}`);
                } else {
                    adapter.log.error(`[dumpError()] : wrong error argument: ${JSON.stringify(error)}`);
                }
            }
        },

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
        },

        /**
         * Checks whether variable is number
         * true:  5, '123'
         * false: '123abc', 'q345', null, undefined, false, '   '
         * @source https://stackoverflow.com/questions/1303646/check-whether-variable-is-number-or-string-in-javascript
         * @param {any} n     Input variable to check
         * @return {boolean}  true if number, false if not.
         */
        isNumber(n) {
            return /^-?[\d.]+(?:e-?\d+)?$/.test(n);
        },


        /**
         * Check a given number against a comparator string, like '>30', '<= 25', etc.
         * @param {any} numToCheck - number to check against comparator
         * @param {string} compStr - comparator, like '>30', '<= 25'
         * @return {object} - Object like {isComparator:true, result:true} - isComparator: if compStr was recognized as comparator, result: true if matching, false if not
         */
        isNumComparatorMatching(numToCheck, compStr) {
            // Check for >=, <=, >, <, != leading a number, so like '>= 3', '<7'
            if (typeof compStr == 'string' && (typeof numToCheck == 'string' || typeof numToCheck == 'number')) {
                const matchComparator =compStr.match(/^(>=|<=|>|<|!=|<>)\s?(\d{1,})$/);
                if (matchComparator != null) {
                    // String like ">= 30" found.
                    const operand = matchComparator[1];
                    const compNum = parseFloat(matchComparator[2]);
                    if (operand == '>=' && Number(numToCheck) >= compNum) {
                        return {isComparator:true, result:true};
                    } else if (operand == '<=' && Number(numToCheck) <= compNum) {
                        return {isComparator:true, result:true};
                    } else if (operand == '>' && Number(numToCheck) > compNum) {
                        return {isComparator:true, result:true};
                    } else if (operand == '<' && Number(numToCheck) < compNum) {
                        return {isComparator:true, result:true};
                    } else if ((operand == '!=' || operand == '<>' ) && Number(numToCheck) != compNum) {
                        return {isComparator:true, result:true};
                    } else {
                        return {isComparator:true, result:false};
                    }
                } else {
                    return {isComparator:false, result:false};
                }

            } else {
                return {isComparator:false, result:false};
            }
        },


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
        },



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
        },


        /**
         * Check if an array contains duplicate values
         * https://stackoverflow.com/a/34192063
         *
         * @param {*} myArray   - The given array
         * @return {boolean}    - true if it is unique, false otherwise.
         */
        isArrayUnique(myArray) {
            return myArray.length === new Set(myArray).size;
        },

        /**
         * Removing Array element(s) by input value. 
         * @param {array}   arr             the input array
         * @param {string}  valRemove       the value to be removed
         * @param {boolean} [exact=true]    OPTIONAL: default is true. if true, it must fully match. if false, it matches also if valRemove is part of element string
         * @return {array}  the array without the element(s)
         */
        arrayRemoveElementByValue(arr, valRemove, exact=true) {

            const arrGiven = [...arr]; // copy array

            for ( let i = 0; i < arrGiven.length; i++){ 
                if (exact) {
                    if ( arrGiven[i] === valRemove) {
                        arrGiven.splice(i, 1);
                        i--;
                    }
                } else {
                    if (arrGiven[i].indexOf(valRemove) != -1) {
                        arrGiven.splice(i, 1);
                        i--;
                    }
                }
            }
            return arrGiven;
        },

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

        },




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

        },

        /**
         * Pad a number with leading zeros, like 7 => '007' if 3 places.
         * @param  {string|number}  num     Input number
         * @param  {number}         digits  Number of digits
         * @return {string}         The result
         */
        zeroPad(num, digits) {
            const zero = digits - num.toString().length + 1;
            return Array(+(zero > 0 && zero)).join('0') + num;        
        },

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
        
        },

    };
};