'use strict';
/* eslint-disable no-inner-declarations -- // cite: *prior to ES6*, a function declaration is only allowed in the first level of a program or the body of another function */

/**
 * @class   Trigger
 * @desc    For handling of triggers and their associated target devices. 
 *          Every instance of this class is a specific trigger (motion sensor/'other device'/time trigger)
 * @author  Mic-M <https://github.com/Mic-M/ioBroker.smartcontrol>
 * @license MIT
 * 
 * Initial Properties:
 *    ---Generic Properties---
 *    {string}  triggerName              Name of Trigger
 *    {string}  triggerTableId           table name: 'tableTriggerDevices', 'tableTriggerMotion', or 'tableTriggerTimes'
 *    {string}  triggerStatePath         State Path of Trigger, if a state
 *    {string}  triggerStateVal          Trigger state value from Options Table
 *    {string}  triggerIsToggle          Trigger is a toggle, so isToggle is true in tableTriggerDevices
 *    {boolean} targetOff                If true, targets will be switched off, and not on.
 *    ---Motion Trigger---
 *    {boolean} triggerIsMotion          Is trigger a motion sensor?
 *    {boolean} motionNotIfManual        if true: motion trigger should not set timeout if target device was turned on previously without a motion trigger.
 *    {number}  motionDuration           Duration (timer) in seconds for motion sensor
 *    {string}  motionBriStatePath       State Path of brightness state
 *    {number}  motionBriThreshold       Threshold of brightness
 *    {object}  motionTimer              Timer object for motion to switch targets off
 *    ---Time Trigger---
 *    {boolean} triggerIsTime            Is trigger a time trigger?
 *    {string}  triggerTime              If time trigger: time like '42 * * * *' or 'sunset+30'
 *    {array}   triggerTmAdditionCond    Array of additional condition names for "Must be fulfilled"
 *    {boolean} triggerTmAddCondAll      if true: all conditions must be met, if false: at least one condition must be met
 *    {string}  triggerTmNever           Array of additional condition names for "Never" which shall not be 
 *    {boolean} triggerTmNeverAll        if true: all conditions must be met, if false: at least one condition must be met
 *
 * Properties set by this._asyncUpdateCurrentActiveZones()
 *    {array}   zoneNames                All zone names that were triggered and meet all conditions
 *    {object}  zoneTargetNames          All target device names per zone, like {Hallway:['Hallway Light'], Bath:['Light', 'Radio Bath']}
 *                                       NOTE: Motion Trigger - If target was already turned on previously by a non-motion trigger: 
 *                                             We will remove that device to not schedule timer, if motionNotIfManual
 * 
 */
class Trigger {

    /**
     * Constructor
     *
     * @param {object} adapter - ioBroker adapter instance object
     * @param {string} triggerName    - Name of trigger.
     */
    constructor(adapter, triggerName) {
        this.adapter = adapter;
        this.triggerName = triggerName;
        this.zoneOffTimer = null;
        this._init();
    }

    /**
     * Set properties (retrieving from adapter configuration)
     */
    _init() {

        try {

            this.triggerStatePath = undefined; // set below accordingly if state
            this.triggerStateVal = undefined;  // set below accordingly if state
            this.triggerIsMotion = false;      // set to true below, if motion
            this.triggerIsToggle = false;      // set to true below, if tableTriggerDevices.isToggle=true
            this.targetOff = false;            // set to true below, if activated in other devices or time trigger table

            /**
             * Get all triggered table rows and set properties accordingly.
             */
            const result = { row: {}, tableId: '' };
            for (const lpTable of ['tableTriggerDevices', 'tableTriggerMotion', 'tableTriggerTimes']) {
                for (const lpRow of this.adapter.config[lpTable]) {
                    if (lpRow.active && lpRow.name == this.triggerName) {
                        result.row = lpRow;
                        result.tableId = lpTable;
                        break;
                    }
                }
                if (result.index > -1) break;
            }

            switch (result.tableId) {

                case 'tableTriggerDevices':
                    this.triggerTableId = result.tableId;
                    this.triggerStatePath = result.row.stateId;
                    this.triggerStateVal = result.row.stateVal;
                    this.triggerIsToggle = result.row.isToggle;
                    this.targetOff = result.row.targetOff;
                    break;

                case 'tableTriggerMotion':
                    this.triggerTableId = result.tableId;
                    this.triggerIsMotion = true;
                    this.motionTimer = null;
                    this.triggerStatePath = result.row.stateId;
                    this.triggerStateVal = true; // is always true for motion sensors to indicate if on
                    this.motionNotIfManual = result.row.notIfManual;

                    if (result.row.duration && parseInt(result.row.duration) > 0) {
                        this.motionDuration = parseInt(result.row.duration);
                    } else {
                        this.motionDuration = 0;
                    }
                    if (result.row.briThreshold && parseInt(result.row.briThreshold) > 0 && result.row.briStateId && result.row.briStateId.length > 5) {
                        this.motionBriStatePath = result.row.briStateId;
                        this.motionBriThreshold = result.row.briThreshold;
                    } else {
                        this.motionBriStatePath = '';
                        this.motionBriThreshold = 0;
                    }
                    break;

                case 'tableTriggerTimes':
                    this.triggerTableId = result.tableId;
                    this.triggerIsTime = true;
                    this.targetOff = result.row.targetOff;
                    this.triggerTime = result.row.time;
                    this.triggerTmAdditionCond = result.row.additionalConditions;
                    this.triggerTmAddCondAll = result.row.additionalConditionsAll;
                    this.triggerTmNever = result.row.never;
                    this.triggerTmNeverAll = result.row.neverAll;
                    break;

                default:
                    throw (`No active trigger '${this.triggerName}' found in any trigger table.`);
            }

        } catch (error) {
            this.adapter.x.helper.dumpError('_init()]', error);
        }

    }

    /**
     * Set all target devices for all zones
     * Note: No need to remove duplicates, this is being taken care of by asyncVerifyConfig() function.
     * @fires _asyncSetTargetDevices_processZone()
     */
    async asyncSetTargetDevices() {

        try {

            await this._asyncUpdateCurrentActiveZones(); // update current active zone properties
            if (!this.zoneNames || !this.zoneTargetNames) return;

            // Timer zoneOn (delay for switching zone on)
            for (const lpZoneName of this.zoneNames) {
                clearTimeout(this.adapter.x.timersZoneOn[lpZoneName]);
                this.adapter.x.timersZoneOn[lpZoneName] = null;
                const zoneOnSecs = parseInt(this.adapter.getOptionTableValue('tableZones', 'name', lpZoneName, 'onAfter'));
                if (!zoneOnSecs || zoneOnSecs < 1) {
                    this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${lpZoneName}' No 'On after x sec' time is set, so we do not set such delay (timer).`);
                    this._asyncSetTargetDevices_processZone(lpZoneName);
                } else {
                    this.adapter.x.timersZoneOn[lpZoneName] = setTimeout(() => {
                        this._asyncSetTargetDevices_processZone(lpZoneName);
                    }, zoneOnSecs * 1000);
                }
            }

        } catch (error) {
            this.adapter.x.helper.dumpError('[asyncSetTargetDevices]', error);
        }

    }


    /**
     * Set all target devices: Process zone - Start
     * @param {string} zoneName - Name of zone
     */
    async _asyncSetTargetDevices_processZone(zoneName) {


        try {

            if (!this.zoneNames || !this.zoneTargetNames) return;

            /**
             * Prepare: If Motion Sensor triggered - verify brightness if bri is set
             */
            if (this.triggerIsMotion && !this.adapter.x.helper.isLikeEmpty(this.motionBriStatePath) && this.adapter.x.helper.isNumber(this.motionBriThreshold) && parseInt(this.motionBriThreshold) > 0) {

                if (this.adapter.config.motionIgnoreBriIfZoneOn && this.adapter.x.zonesIsOn[zoneName]) {
                    // Disregard Brightness if zone is on (if this.adapter.config.motionIgnoreBriIfZoneOn == true)
                    this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${zoneName}' is on and new motion detected, therefore, we disregard any current brightness.`);
                } else {
                    // Verify brightness
                    const briStateObjCurr = await this.adapter.x.helper.asyncGetForeignState(this.motionBriStatePath); // {val: false, ack: true, ts: 1591117034451, …}
                    const briStateValCurrent = briStateObjCurr.val;
                    if (this.adapter.x.helper.isLikeEmpty(briStateValCurrent) || !this.adapter.x.helper.isNumber(briStateValCurrent) || parseInt(briStateValCurrent) < 0) {
                        // Bri not valid, so disregard bri and continue
                        this.adapter.log.debug(`Trigger [${this.triggerName}] Brightness of ${briStateValCurrent} of ${this.motionBriStatePath} is not valid. State Value: [${briStateValCurrent}]. Therefore, bri will be disregarded and we continue.`);
                    } else if (parseInt(briStateValCurrent) < parseInt(this.motionBriThreshold)) {
                        // continue
                        this.adapter.log.debug(`Trigger [${this.triggerName}] Brightness of ${briStateValCurrent} is < threshold of ${this.motionBriThreshold}, so we continue.`);
                    } else {
                        // Brightness condition is not met!
                        this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] activated but current brightness of ${briStateValCurrent} is >= threshold of ${this.motionBriThreshold} -> Motion disregarded.`);
                        return; // go out
                    }
                }
            } else if (this.triggerIsMotion) {
                this.adapter.log.debug(`Trigger [${this.triggerName}] - no brightness defined for this motion sensor, so continue and do not use bri as an additional criterion.`);
            }


            /**
             * -- Main --
             * Loop thru the target device names and switch accordingly.
             * Code supports delay, therefore, implementation is different as if we would not have this support (like processing all devices, then call finalize(), etc.)
             */
            const lSwitchedDevices = [];
            const lAlreadyOnDevices = [];
            const lDelayedDevices = [];
            const lDelaySecs = []; // for each device, delay to turn on, e.g. [0, 10]
            let onOff = 'on'; // for toggle

            // get delay ('onAfter')
            const targetsOverwrite = this.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'targetsOverwrite'); // like: {'Hallway.Light':{val:'new val', delay:10}, 'Hallway.Radio':{val:'Radio XYZ'}}

            let counterDevicesProcessed = 0; // Once all processed, we will call a function
            for (const lpTargetDeviceName of this.zoneTargetNames[zoneName]) {

                let delay = this.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, 'onAfter');
                if (delay !== undefined && this.adapter.x.helper.isNumber(delay) && parseInt(delay) > 0) {
                    delay = parseInt(delay);
                } else {
                    delay = 0;
                }
                lDelaySecs.push(delay);

                // Targets overwrite: state value, and delay
                let overwriteValue = null;
                if (targetsOverwrite && targetsOverwrite[lpTargetDeviceName]) {
                    if (!this.adapter.x.helper.isLikeEmpty(targetsOverwrite[lpTargetDeviceName].val)) {
                        overwriteValue = targetsOverwrite[lpTargetDeviceName].val;
                    }
                    if (targetsOverwrite[lpTargetDeviceName].delay!==undefined 
                        && this.adapter.x.helper.isNumber(targetsOverwrite[lpTargetDeviceName].delay) 
                        && parseInt(targetsOverwrite[lpTargetDeviceName].delay) > -1) {
                        delay = parseInt(targetsOverwrite[lpTargetDeviceName].delay);
                    }
                }


                /**
                 * let's call function switchTargetDevice()
                 */
                // Timer (delay) to switch device on
                if (delay > 0) lDelayedDevices.push(lpTargetDeviceName);
                clearTimeout(this.adapter.x.timersZoneDeviceOnDelay[zoneName+'_'+ lpTargetDeviceName]);
                this.adapter.x.timersZoneDeviceOnDelay[zoneName+'_'+ lpTargetDeviceName] = null;

                if (delay > 0) {
                    // set timeout
                    this.adapter.x.timersZoneDeviceOnDelay[zoneName+'_'+ lpTargetDeviceName] = setTimeout(()=>{ switchTargetDeviceAsync(this); }, delay * 1000);
                } else {
                    // call right away
                    await switchTargetDeviceAsync(this);
                }

                /**
                 * Function switchTargetDevice
                 * @param {object} that - this
                 */
                async function switchTargetDeviceAsync(that) {

                    try {
                        
                        if (!that.zoneTargetNames) return;

                        counterDevicesProcessed++; // +1

                        // If target device should be switched off, and not on, per config in trigger table
                        // Will be overwritten later if toggle is activated
                        if (that.targetOff) onOff = 'off';
        
                        // Toggle
                        if (that.triggerIsToggle) {
                            // If we have Toggle, we are using the ON state/value to check.
                            const onState = that.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, 'onState');
                            const onVal = that.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, 'onValue');
                            const currentStateVal = await that.adapter.x.helper.asyncGetForeignStateValue(onState);
                            if (currentStateVal == null) throw (`Could not get current state value for '${onState}' of device '${lpTargetDeviceName}'`);
                            if (onVal == currentStateVal) {
                                onOff = 'off';
                            } else {
                                onOff = 'on';
                            }
                        }
        
                        // Get option values.
                        const lpTargetState = that.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, onOff + 'State');
                        let lpTargetVal = that.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, onOff + 'Value');
                        const noTargetCheckStr = (onOff == 'on') ? 'noTargetOnCheck' : 'noTargetOffCheck';
                        const doNotCheckTarget = that.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetDeviceName, noTargetCheckStr);
        
                        if (lpTargetState == undefined || lpTargetVal == undefined) {
                            throw (`Unable to retrieve target '${onOff}' state/value for target device '${lpTargetDeviceName}'`);
                        }
        
                        // Overwrite target values if according value is set in Zones table
                        if (onOff == 'on' && overwriteValue !== null) {
                            lpTargetVal = overwriteValue;
                        }
        
                        // Let's get current state value
                        let currentStateVal;
                        if (!doNotCheckTarget) {
                            currentStateVal = await that.adapter.x.helper.asyncGetForeignStateValue(lpTargetState);
                            if (currentStateVal == null) {
                                throw (`Could not get current state value for '${lpTargetState}' of device '${lpTargetDeviceName}'`);
                            }
                        }
        
                        // Set target state.
                        // Note: Verification of the state value and conversion as needed was performed already by asyncVerifyConfig()
                        // Check if device is already on.
                        if (doNotCheckTarget || (!doNotCheckTarget && (currentStateVal != lpTargetVal))) {
                            
                            // Set state
                            await that.adapter.setForeignStateAsync(lpTargetState, { val: lpTargetVal, ack: false });
                            //if (delay == 0) lSwitchedDevices.push(lpTargetDeviceName);
                            lSwitchedDevices.push(lpTargetDeviceName);
                            if (that.motionNotIfManual) {
                                if (that.triggerIsMotion) {
                                    // triggered by motion, so add to that.adapter.x.motionTriggeredDevices
                                    if (that.adapter.x.motionTriggeredDevices.indexOf(lpTargetDeviceName) == -1) {
                                        that.adapter.x.motionTriggeredDevices.push(lpTargetDeviceName);
                                    }
                                } else {
                                    //Triggered by NON-motion, so remove from that.adapter.x.motionTriggeredDevices
                                    that.adapter.x.motionTriggeredDevices = that.adapter.x.helper.arrayRemoveElementByValue(that.adapter.x.motionTriggeredDevices, lpTargetDeviceName);
                                }
                            }
                            // set json log to smartcontrol.x.info.log.switchedTargetDevices.json
                            that.adapter.x.helper.setJsonLog('switchedTargetDevices', {
                                time: that.adapter.x.helper.dateToLocalIsoString(new Date()),
                                name: lpTargetDeviceName,
                                objectId: lpTargetState,
                                value: lpTargetVal,
                                triggerName: that.triggerName,
                                ts: Date.now(),
                            });

                        } else {
                            // do not set target state
                            // if (delay == 0) lAlreadyOnDevices.push(lpTargetDeviceName);
                            lAlreadyOnDevices.push(lpTargetDeviceName);
                        }

                        if (counterDevicesProcessed == that.zoneTargetNames[zoneName].length) { 

                            /**
                             * All devices processed, so we continue here
                             */
                            if (!that.zoneTargetNames || !that.zoneNames) return;

                            /**
                             * Motion Trigger: If target was already turned on previously by a non-motion trigger: do not schedule timer.
                             * Also, provide some log info in logMotion
                             */
                            let logMotion = '';
                            if (that.triggerIsMotion && that.motionDuration && that.motionDuration > 0) {
                                const lRemovedDevices = [];
                                if (that.motionNotIfManual) {
                                    for (const lpTargetDevice of lAlreadyOnDevices) {
                                        if (that.adapter.x.motionTriggeredDevices.indexOf(lpTargetDevice) > -1) {
                                            // Device was already on and motion triggered before.
                                        } else {
                                            // Device was already on, but NO motion triggered before.
                                            // Therefore, we will exclude device from the timer
                                            that.zoneTargetNames[zoneName] = that.adapter.x.helper.arrayRemoveElementByValue(that.zoneTargetNames[zoneName], lpTargetDevice);
                                            lRemovedDevices.push(lpTargetDevice);
                                        }
                                    }
                                }
                                if (that.zoneTargetNames[zoneName].length < 1) {
                                    logMotion = `No motion timer will be set to turn off since device(s) turned on manually before.`;
                                } else {
                                    if (lRemovedDevices.length == 0) {
                                        logMotion = `Timer of ${that.motionDuration}s will be set to turn off once no more motion recognized.`;
                                    } else {
                                        logMotion = `Timer of ${that.motionDuration}s will be set to turn off once no more motion recognized. Limited to '${that.zoneTargetNames[zoneName].toString()}'. ${lRemovedDevices.toString()} were turned on manually before.`;
                                    }
                                }
                            }


                            /**
                             * Set "always off after" timer if set in Table Zones.
                             */
                            if (that.triggerIsToggle && onOff == 'off') {
                                // Toggle is activated and zone is turned off, so kill/delete the timer.
                                const zoneOffTimeLeft = that.adapter.x.helper.getTimeoutTimeLeft(that.adapter.x.timersZoneOff[zoneName]);
                                if (zoneOffTimeLeft > -1) {
                                    that.adapter.log.debug(`Trigger [${that.triggerName}] Zone '${zoneName}': Turn off 'always off' timer, since still running ${(zoneOffTimeLeft / 1000).toFixed(0)} seconds and toggle trigger triggered to turn off.`);
                                    clearTimeout(that.adapter.x.timersZoneOff[zoneName]);
                                    that.adapter.x.timersZoneOff[zoneName] = null;
                                }

                            } else {
                                if (that.triggerIsMotion && (that.zoneTargetNames[zoneName].length < 1)) {
                                    that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}], Zone '${that.zoneNames.toString()}': no 'always off after' timer set since device(s) turned on manually before.`);
                                } else {
                                    that.asyncSetZoneTimer_zoneOff(zoneName);
                                }
                            }

                            // Set "Zone is on" status
                            that.adapter.x.zonesIsOn[zoneName] = true;

                            /**
                             * JSON log for info.log.zoneActivations.json
                             */
                            const alwaysOff = parseInt(that.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'offAfter'));
                            that.adapter.x.helper.setJsonLog('zoneActivations', {
                                ts: Date.now(),
                                time: that.adapter.x.helper.dateToLocalIsoString(new Date()),
                                zone: zoneName,
                                trigger: that.triggerName,
                                targetsAll: that.zoneTargetNames[zoneName].toString(),
                                targetsAllDelays: JSON.stringify(lDelaySecs),
                                targetsSet: lSwitchedDevices.toString(),
                                targetsSkipped: lAlreadyOnDevices.toString(),
                                motionTimer: (that.motionDuration) ? that.motionDuration : 0,
                                alwaysOffTimer: (isNaN(alwaysOff)) ? 0 : alwaysOff,
                            });

                            // Finalize
                            if (lSwitchedDevices.length > 0) {
                                if (lAlreadyOnDevices.length < 1) {
                                    that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}] activated Zone '${zoneName}'. Turned ${onOff}: ${lSwitchedDevices.toString()}.`);
                                } else {
                                    that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}] activated Zone '${zoneName}'. Turned ${onOff}: ${lSwitchedDevices.toString()}. Not turned ${onOff} (as already ${onOff}): '${lAlreadyOnDevices.toString()}'`);
                                }
                            } else {
                                if (lAlreadyOnDevices.length > 0) that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}] activated Zone '${zoneName}'. However, device(s) '${lAlreadyOnDevices.toString()}' not turned ${onOff} as these are already ${onOff}.`);
                            }
                            if (lDelayedDevices.length > 0) that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}] Following device(s) will be switched ${onOff} later, since a delay was set: ${lDelayedDevices.toString()}.`);
                            if (logMotion) that.adapter.x.helper.logExtendedInfo(`Trigger [${that.triggerName}] Zone '${zoneName}': ${logMotion}`);

                        }

                    } catch (error) {
                        that.adapter.x.helper.dumpError(`[switchTargetDevice]`, error);
                        return;
                    }

                }

            }


        } catch (error) {
            this.adapter.x.helper.dumpError(`[_asyncSetTargetDevices_processZone]`, error);
            return;
        }
    }


    /**
     * Set timeout to switch devices of a zone off for zoneOff timer
     *  @param {string} zoneName   - Zone Name
     */
    async asyncSetZoneTimer_zoneOff(zoneName) {

        try {

            const zoneOffSecs = parseInt(this.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'offAfter'));
            if (!zoneOffSecs || zoneOffSecs < 1) {
                this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${zoneName}' No 'Always off after' time is set, so we do not set such timer.`);
                return;
            }

            // Get current target devices info
            const targets = await this._asyncGetTargetDevicesInfoOfZone(zoneName);

            // First: clear timers. Note: we use timeLeft since we need this anyways for log.
            const timeLeft = this.adapter.x.helper.getTimeoutTimeLeft(this.adapter.x.timersZoneOff[zoneName]);
            if (timeLeft > -1) {
                clearTimeout(this.adapter.x.timersZoneOff[zoneName]);
                this.adapter.x.timersZoneOff[zoneName] = null;
            }

            // Set timer
            this.adapter.x.timersZoneOff[zoneName] = setTimeout(() => {
                this._asyncSetZoneTimer_doOnTimeout(zoneName, 'Zone always off', targets, zoneOffSecs);
            }, zoneOffSecs * 1000);

            // Some log
            if (timeLeft > -1) {
                this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] 'zoneOff' ${zoneOffSecs}s timer still running ${(timeLeft / 1000).toFixed(0)}s. We stop it and set new to ${zoneOffSecs}s.`);
            } else {
                this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] 'zoneOff' ${zoneOffSecs}s timer for zone '${zoneName}' initially started.`);
            }

        } catch (error) {
            this.adapter.x.helper.dumpError(`[asyncSetZoneTimer_zoneOff]`, error);
            return;
        }

    }


    /**
     * Set timeout to switch devices of a zone off, if a motion sensor was triggered and switch off time (duration) is provided.
     *  @param {string} zoneName   - Zone Name
     */
    async asyncSetZoneTimer_motion(zoneName) {

        try {

            // Go out if no duration is set
            if (!this.motionDuration || this.motionDuration <= 0) throw (`No motion duration set for ${this.triggerName}.`);

            // Get current target devices info
            const targets = await this._asyncGetTargetDevicesInfoOfZone(zoneName); // {statePaths:[Array of state paths], stateValues: [Array of state values], deviceNames: [Array of device names]}

            if (!targets) {
                // No targets found for ${zoneName}
                return; // We already logged in _asyncGetTargetDevicesInfoOfZone()
            }

            // First: clear timers. Note: we use timeLeft since we need this anyways for log.
            if (this.motionTimer) {
                const timeLeft = this.adapter.x.helper.getTimeoutTimeLeft(this.motionTimer);
                if (timeLeft > -1) {
                    this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${zoneName}': Timer for ${this.triggerName} still running ${(timeLeft / 1000).toFixed(0)} seconds but a new motion from this sensor detected, which is associated to same zone. Therefore, we stop timer and set new.`);
                    clearTimeout(this.motionTimer);
                    this.motionTimer = null;
                }
            }

            // Set timer
            this.motionTimer = setTimeout(() => {
                if (!this.motionDuration) return;
                this._asyncSetZoneTimer_doOnTimeout(zoneName, 'Motion', targets, this.motionDuration);
            }, this.motionDuration * 1000);
            this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] Motion sensor '${this.triggerName}', zone '${zoneName}': No more motion, so we set ${this.motionDuration}s timer.`);

        } catch (error) {
            this.adapter.x.helper.dumpError(`[asyncSetZoneTimer_motion]`, error);
            return;
        }

    }

    /**
     * Check if additional conditions are met (like Public Holiday, etc. -- as set in conditions table).
     * 
     * @param {string} name           - Any name, for logging only 
     * @param {array}  conditionNames - Array of condition names
     * @param {boolean} allMustMeet   - if true: all conditions must be met, if false: one condition is enough
     * @param {boolean} [inverse]     - if true: inverse results (true -> false, and vice versa)
     * @return {Promise<boolean>}     True if condition(s) met, false if not. Also return true, if empty conditionNames array
     */
    async asyncAreScheduleConditionsMet(name, conditionNames, allMustMeet, inverse = false) {

        try {

            // If empty array, we return true, as we need to continue if no conditions are set in the options table.
            if (this.adapter.x.helper.isLikeEmpty(conditionNames)) {
                this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - no conditions defined, so we return "true" to continue.`);
                return true;
            }

            let hitCount = 0;

            this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - check if conditions met: '${JSON.stringify(conditionNames)}'`);
            const notMetConditionNames = [];
            for (const lpConditionName of conditionNames) {

                if (hitCount > 0 && allMustMeet == false) break;

                const lpConditionStatePath = this.adapter.getOptionTableValue('tableConditions', 'name', lpConditionName, 'conditionState');
                const lpConditionStateValue = this.adapter.getOptionTableValue('tableConditions', 'name', lpConditionName, 'conditionValue');

                if (!lpConditionStatePath) {
                    this.adapter.log.error(`asyncAreScheduleConditionsMet(): condition details for '${lpConditionName}' could not be found.`);
                    notMetConditionNames.push(lpConditionName);
                    if (allMustMeet) { break; } else { continue; }
                }

                const lpStateVal = await this.adapter.x.helper.asyncGetForeignStateValue(lpConditionStatePath);
                if (lpStateVal == null) {
                    notMetConditionNames.push(lpConditionName);
                    if (allMustMeet) { break; } else { continue; }
                }

                /**
                 * Finally, compare the config table state value with the actual state value
                 */
                // First: do we have comparator
                const res = this.adapter.x.helper.isNumComparatorMatching(lpStateVal, lpConditionStateValue);
                if (res.isComparator && res.result) {
                    this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - condition '${lpConditionName}' *met* (options val = '${lpConditionStateValue}', actual state val = '${lpStateVal}')`);
                    hitCount++;
                    if (allMustMeet) { continue; } else { break; }

                    // Next: no comparator, so compare directly with ==
                } else if (lpConditionStateValue == lpStateVal) {
                    this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - condition '${lpConditionName}' *met* (options val = '${lpConditionStateValue}', actual state val = '${lpStateVal}')`);
                    hitCount++;
                    if (allMustMeet) { continue; } else { break; }
                } else {
                    // No hit, so go out!
                    this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - condition '${lpConditionName}' *not* met (options val = '${lpConditionStateValue}', actual state val = '${lpStateVal}')`);
                    notMetConditionNames.push(lpConditionName);
                    if (allMustMeet) { break; } else { continue; }
                }

            }

            let result = false;
            if ((allMustMeet && (hitCount == conditionNames.length)) || (!allMustMeet && (hitCount > 0)))
                result = true;

            if (inverse) result = !result;

            if (result) {
                this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - final result: condition matching`);
                return true;
            } else {
                if (!inverse) this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - final result: *not* matching conditions: ${notMetConditionNames.toString()}`);
                if (inverse) this.adapter.log.debug(`Trigger [${this.triggerName}], ${name} - final result: *not* matching conditions`); // to avoid empty 'notMetConditionNames'
                return false;
            }

        } catch (error) {
            this.adapter.x.helper.dumpError('[asyncAreScheduleConditionsMet()]', error);
            return false;
        }

    }

    /**
     * Set/update zoneNames and zoneTargetNames.
     * Call once a trigger that was triggered
     * @return {Promise<boolean>} true if successful, false if errors
     */
    async _asyncUpdateCurrentActiveZones() {

        try {

            /**
             * Get zone names, and zone-specific target names and execution
             * Loop next iteration, if not successful.
             */

            this.zoneNames = Array();   // Zone names that were triggered and which match with a schedule row name
            this.zoneTargetNames = {};  // Target devices per zone, like {Hallway:['Hallway Light'], Bath:['Bath Light', 'Bath Radio']}

            for (const lpRowZones of this.adapter.config.tableZones) {

                // Loop next if item in table "Zones" is not containing any trigger name in column triggers
                if (!(lpRowZones.active && lpRowZones.triggers && Array.isArray(lpRowZones.triggers) && lpRowZones.triggers.includes(this.triggerName))) continue;

                // Add target devices
                this.zoneTargetNames[lpRowZones.name] = lpRowZones.targets;

                // Execution options
                //const executeAlways    =    this.adapter.config.execution[lpRowZones.name].executeAlways;
                const executeAlways = (lpRowZones.executeAlways) ? true : false;
                let tablesZoneExecution = [];
                if (executeAlways) {
                    // we create a dummy to always execute
                    tablesZoneExecution = [{
                        active: true,
                        executeAlways: true // This is a "dummy" key, so that we know to always execute
                    }];
                } else {
                    tablesZoneExecution = (lpRowZones.executionJson) ? JSON.parse(lpRowZones.executionJson) : [];
                }

                for (const lpRow of tablesZoneExecution) {

                    if (lpRow.active) {

                        this.adapter.log.debug(`Trigger [${this.triggerName}] === check schedule conditions ===`);

                        if (lpRow.executeAlways) {
                            this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${lpRowZones.name}' - 'Execute always is activated, so continue'`);
                            this.zoneNames.push(lpRowZones.name);
                        } else {

                            // A few variables / constants
                            const tsCurrent = Date.now();   // the current timestamp
                            let doContinue = true;          // flag if we can continue.

                            // First – check if current time is within the schedule times        
                            if (doContinue) doContinue = this.adapter.x.helper.scheduleIsTimeStampWithinPeriod(tsCurrent, lpRow.start, lpRow.end, lpRowZones.name);

                            // Next, check if current day is within the mon-sun options as set in schedules tables.
                            if (doContinue) doContinue = this.adapter.x.helper.scheduleIsWeekdayMatching(lpRow, tsCurrent, lpRowZones.name);

                            // Next, check additional conditions (like Public Holiday, etc. -- as set in conditions table)
                            if (doContinue) doContinue = await this.asyncAreScheduleConditionsMet('Zone Execution: Additional Conditions', lpRow.additionalConditions, lpRow.additionalConditionsAll);

                            // Next, check conditions "Never if"
                            if (doContinue) doContinue = await this.asyncAreScheduleConditionsMet('Zone Execution: "never if" Conditions', lpRow.never, lpRow.neverAll, true);

                            // All checks done.
                            if (doContinue) {
                                this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${lpRowZones.name}' - execution table row *is* meeting conditions`);
                                /* isHit == true; */
                                this.zoneNames.push(lpRowZones.name); // set matching zone name
                            } else {
                                this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${lpRowZones.name}' - execution table row is *not* meeting conditions`);
                            }
                        }

                    }

                }

            }

            if (this.adapter.x.helper.isLikeEmpty(this.zoneNames) || this.adapter.x.helper.isLikeEmpty(this.zoneTargetNames)) {
                this.adapter.log.debug(`Trigger [${this.triggerName}] Zone(s) will not be activated since no zone found which meets all conditions.`);
                return false;
            } else {
                this.adapter.log.debug(`Trigger [${this.triggerName}] - (${this.zoneNames.length}) rows in Zones table found and assigned execution table rows fetched successfully.`);
                return true;
            }


        } catch (error) {
            this.adapter.x.helper.dumpError('[_asyncUpdateCurrentActiveZones]', error);
            return false;
        }


    }


    /**
     *  @param {string} zoneName   - Name of zone
     *  @param {string} timerTitle - For logging only.
     *  @param {object} targets    - {statePaths:['x', 'y'], stateValues: ['m', 'n'], deviceNames: ['a','b']};
     *  @param {number} secTimer   - Number of seconds of the timer, that was set and now expired. For logging only.
     */
    async _asyncSetZoneTimer_doOnTimeout(zoneName, timerTitle, targets, secTimer) {

        try {

            // First check if tableZones 'Never switch off if...' is met
            const neverOffConditionNames = this.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'neverOff');
            const allMustMeet = this.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'neverOffAll');
            const switchOff = await this.asyncAreScheduleConditionsMet('Zones table - "never switch off if" condition', neverOffConditionNames, allMustMeet, true);
            if (!switchOff) {
                this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] Zone '${zoneName}': Timer '${timerTitle}' ended, but 'Never switch off if...' condition(s) true --> Zone will not be switched off.`);
                return; // go out
            }

            // Set "is Zone on" status to false
            this.adapter.x.zonesIsOn[zoneName] = false;

            // Clear timer 'timersZoneOn'
            clearTimeout(this.adapter.x.timersZoneOn[zoneName]);
            this.adapter.x.timersZoneOn[zoneName] = null;

            const lTargetDevicesSwitchedOff = []; // For Log
            const lManualOnDevices = []; // For log
            for (let i = 0; i < targets.statePaths.length; i++) {

                // All are having same length and association per each element
                const lpStatePath = targets.statePaths[i];
                const lpStateValToSet = targets.stateValues[i];
                const lpTargetName = targets.deviceNames[i];

                // Remove from this.adapter.x.motionTriggeredDevices
                if (this.motionNotIfManual) this.adapter.x.motionTriggeredDevices = this.adapter.x.helper.arrayRemoveElementByValue(this.adapter.x.motionTriggeredDevices, lpTargetName);

                // Check if current value != new value
                const targetOffStateValCurrent = await this.adapter.x.helper.asyncGetForeignStateValue(lpStatePath);
                if (targetOffStateValCurrent == null) {
                    this.adapter.log.error(`Timer '${timerTitle}', trigger '${this.triggerName}', target ${lpTargetName}: - Timeout of '${secTimer}' seconds reached, but could not get current state value of '${lpStatePath}', so unable to turn device off.`);
                    continue;
                }
                if (lpStateValToSet == targetOffStateValCurrent) {
                    this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] Timer '${timerTitle}', target ${lpTargetName}: - Timeout of '${secTimer}' seconds reached, target is already turned off, so not turning off again.`);
                    continue;
                }

                // All passed.
                await this.adapter.setForeignStateAsync(lpStatePath, { val: lpStateValToSet, ack: false });
                lTargetDevicesSwitchedOff.push(lpTargetName);

            }

            // Log
            if (lManualOnDevices.length > 0) {
                this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] Timer '${timerTitle}', target(s) '${lManualOnDevices.toString()}': - Timeout of '${secTimer}' seconds reached, target(s) manually turned on while timer was running, so do not turn off.`);
            }
            if (lTargetDevicesSwitchedOff.length > 0) {
                this.adapter.x.helper.logExtendedInfo(`Trigger [${this.triggerName}] Timer '${timerTitle}', target(s) '${lTargetDevicesSwitchedOff.toString()}': - Turned off per ${secTimer}s timer.`);
            }


        } catch (error) {
            this.adapter.x.helper.dumpError('[asyncSetZoneTimer_doOnTimeout]', error);
            return;
        }

    }

    /**
     * Get target device info for a given zone name. 
     * @param {string} zoneName       - Zone Name
     * @return {Promise<object|null>} - Object: {statePaths:[Array of state paths], stateValues: [Array of state values], deviceNames: [Array of device names]}. null if not found/errors.
     */
    async _asyncGetTargetDevicesInfoOfZone(zoneName) {

        try {

            if (!this.zoneTargetNames || !this.zoneTargetNames[zoneName] || this.adapter.x.helper.isLikeEmpty(this.zoneTargetNames[zoneName])) {
                this.adapter.log.debug(`Trigger [${this.triggerName}] Zone '${zoneName}': No current target devices found for timer to switch devices off, likely because all were turned on manually before`);
                return null;
            }
            const targetDevices = this.zoneTargetNames[zoneName];
            //const targetDevices = this.adapter.getOptionTableValue('tableZones', 'name', zoneName, 'targets');

            // Get all target device state paths and values
            const targets = {
                statePaths: Array(), // Would use [] instead of Array(), but see: https://stackoverflow.com/a/56394664
                stateValues: Array(),
                deviceNames: Array(),
            };

            for (const lpTargetName of targetDevices) {
                // Get target device information
                const targetOffState = this.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetName, 'offState');
                const targetOffVal = this.adapter.getOptionTableValue('tableTargetDevices', 'name', lpTargetName, 'offValue');

                if (targetOffState == undefined || targetOffVal == undefined) {
                    throw (`Unable to retrieve target off state/value for target device '${lpTargetName}' from adapter config.`);
                }

                // Target Off State
                if (await this.adapter.getForeignObjectAsync(targetOffState)) {
                    // State is existing
                    targets.statePaths.push(targetOffState);
                    targets.stateValues.push(targetOffVal);
                    targets.deviceNames.push(lpTargetName);
                } else {
                    // State is not existing
                    this.adapter.log.error(`State '${targetOffState}' of device '${lpTargetName}' does not exist.`);
                }
            }

            // Go out if we actually have no devices to turn off
            if (this.adapter.x.helper.isLikeEmpty(targets.statePaths)) {
                throw (`Zone '${zoneName}': --> No target states found in adapter settings, so no timer will be set to turn off.`);
            }

            return targets;

        } catch (error) {
            this.adapter.x.helper.dumpError(`[asyncGetTargetDevicesInfoOfZone]`, error);
            return null;
        }

    }



}
module.exports = Trigger;