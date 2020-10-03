'use strict';
/**
 * @desc    Define adapter constants, which will be available in adapter class instance
 * @author  Mic-M <https://github.com/Mic-M/ioBroker.smartcontrol>
 * @license MIT
 */

module.exports = {
    forbiddenStatePaths: /[\][*,;'"`<>\\?]/g, // Source: https://github.com/ioBroker/ioBroker.js-controller/blob/master/lib/adapter.js - Version 3.1.6
    astroTimes:          ['nightEnd', 'nauticalDawn', 'dawn', 'sunrise', 'sunriseEnd', 'goldenHourEnd', 'solarNoon', 'goldenHour', 'sunsetStart', 'sunset', 'dusk', 'nauticalDusk', 'night', 'nadir'],
    astroTimesGerman:    ['Ende der Nacht', 'Nautische Morgendämmerung', 'Morgendämmerung', 'Sonnenaufgang', 'Ende des Sonnenaufgangs', 'Ende der goldenen Stunde', 'Mittag', 'Goldene Abendstunde', 'Start des Sonnenuntergangs', 'Sonnenuntergang', 'Dämmerung Abends', 'Nautische Dämmerung Abends', 'Start der Nacht', 'Mitternacht'],
    configTableValidation: [
        {
            tableName: 'Target Devices',
            tableId: 'tableTargetDevices',
            tableMustHaveActiveRows: false,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'onState', type:'statePath', deactivateIfError:true },
            check_3: {id: 'onValue', type:'stateValue', stateValueStatePath:'onState', deactivateIfError:true },
            check_4: {id: 'offState', type:'statePath', deactivateIfError:true },
            check_5: {id: 'offValue', type:'stateValue', stateValueStatePath:'offState', deactivateIfError:true },
            check_6: {id: 'onAfter', type:'number', numberLowerLimit: 0, deactivateIfError:true, optional:true },            
        },
        {
            tableName: 'Targets: Enums',
            tableId: 'tableTargetEnums',
            tableMustHaveActiveRows: false,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'enumId', type:'name', deactivateIfError:true},
            check_3: {id: 'onValue', type:'name', deactivateIfError:true },
            check_5: {id: 'offValue', type:'name', deactivateIfError:true },
        },
        {
            tableName: 'Conditions',
            tableId: 'tableConditions',
            tableMustHaveActiveRows: false,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'conditionState', type:'statePath', deactivateIfError:true },
            check_3: {id: 'conditionValue', type:'stateValue', stateValueStatePath:'conditionState', deactivateIfError:true },
        },
        {
            tableName: 'Triggers: Motion Sensors',   // Name of table, just for logging purposes
            tableId: 'tableTriggerMotion',
            tableMustHaveActiveRows: false,
            isTriggerTable: true,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'stateId', type:'statePath', deactivateIfError:true },
            check_4: {id: 'duration', type:'number', numberLowerLimit: 0, deactivateIfError:true, optional:true },
            check_5: {id: 'briStateId', type:'statePath', deactivateIfError:true, optional:true },
            check_6: {id: 'briThreshold', type:'number', deactivateIfError:true, optional:true },
        },
        {
            tableName: 'Triggers: Other Devices',
            tableId: 'tableTriggerDevices',
            tableMustHaveActiveRows: false,
            isTriggerTable: true,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'stateId', type:'statePath', deactivateIfError:true },
            check_3: {id: 'stateVal', type:'stateValue', stateValueStatePath:'stateId', deactivateIfError:true },
        },
        {
            tableName: 'Triggers: Times',
            tableId: 'tableTriggerTimes',
            tableMustHaveActiveRows: false,
            isTriggerTable: true,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'time', type:'timeCron', deactivateIfError:true },
            check_3: {id: 'additionalConditions', type:'name', deactivateIfError:true, removeForbidden:true, optional:true },
            check_4: {id: 'never', type:'name', deactivateIfError:true, removeForbidden:true, optional:true },


        },
        {
            tableName: 'Zones',
            tableId: 'tableZones',
            tableMustHaveActiveRows: true,
            check_1: {id: 'name', type:'name', deactivateIfError:true, removeForbidden:true },
            check_2: {id: 'triggers', type:'name', deactivateIfError:true, removeForbidden:true },
            check_3: {id: 'targets', type:'name', deactivateIfError:true, removeForbidden:true },
            check_4: {id: 'onAfter', type:'number', numberLowerLimit: 0, deactivateIfError:true, optional:true },
            check_5: {id: 'offAfter', type:'number', numberLowerLimit: 0, deactivateIfError:true, optional:true },
            check_6: {id: 'targetsOverwrite', type:'overwrite'}, // special for tableZones
        },
        {
            // Special for sub "table" for each Zone
            tableName: 'Zone Execution',
            tableId: 'tableZoneExecution',
            tableMustHaveActiveRows: true,
            check_1: {id: 'start', type:'time', deactivateIfError:true },
            check_2: {id: 'end', type:'time', deactivateIfError:true },
            check_3: {id: 'additionalConditions', type:'name', deactivateIfError:true, removeForbidden:true, optional:true },
            check_4: {id: 'never', type:'name', deactivateIfError:true, removeForbidden:true, optional:true },
        },
    ],

    testStates: [
        {statePath:'Test.trigger.Bathroom_motion',         commonObject:{name:'Bathroom Motion', type:'boolean', read:true, write:true, role:'button', def:false} },
        {statePath:'Test.trigger.Bathroom_wall-switch',    commonObject:{name:'Bathroom Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.trigger.Hallway1_motion',         commonObject:{name:'Hallway Motion', type:'boolean', read:true, write:true, role:'button', def:false} },
        {statePath:'Test.trigger.Hallway2_motion',         commonObject:{name:'HallwayMotion', type:'boolean', read:true, write:true, role:'button', def:false} },
        {statePath:'Test.trigger.Hallway1_wall-switch',    commonObject:{name:'Hallway Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.trigger.Hallway2_wall-switch',    commonObject:{name:'Hallway Wall Switch', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.trigger.RelaxPersonSitting',      commonObject:{name:'Relax Area: Someone sitting on sofa', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.brightness.Bathroom_bri',         commonObject:{name:'Bathroom Brightness', type:'number', read:true, write:true, role:'state', def:0} },
        {statePath:'Test.brightness.Hallway1_bri',         commonObject:{name:'Hallway Brightness 1', type:'number', read:true, write:true, role:'state', def:0} },
        {statePath:'Test.brightness.Hallway2_bri',         commonObject:{name:'Hallway Brightness 2', type:'number', read:true, write:true, role:'state', def:0} },
        {statePath:'Test.light.Bathroom',                  commonObject:{name:'Bathroom Light', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.light.Hallway',                   commonObject:{name:'Hallway Light', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.light.RelaxAreaCeiling',          commonObject:{name:'Relax Area Light', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.light.RelaxAreaWall',             commonObject:{name:'Relax Area Light', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.radio.Bathroom',                  commonObject:{name:'Bath Radio Station (String)', type:'string', read:true, write:true, role:'state', def:''} },
        {statePath:'Test.radio.Bathroom_pause',            commonObject:{name:'Bath Radio Pause', type:'boolean', read:true, write:true, role:'button', def:false} },
        {statePath:'Test.condition.isHolidayToday',        commonObject:{name:'Condition: is Holiday Today?', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.condition.isAnyonePresent',       commonObject:{name:'Condition: is Anyone Present?', type:'boolean', read:true, write:true, role:'state', def:false} },
        {statePath:'Test.condition.isFrontDoorLocked',     commonObject:{name:'Condition: is Front Door locked?', type:'boolean', read:true, write:true, role:'state', def:false} },
    ],
        
};