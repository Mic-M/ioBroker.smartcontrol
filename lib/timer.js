'use strict';

/**
 * @class       MyTimer
 * @description Find out time remaining, stop timer easily, check status (running yes/no)
 *              Inspired by https://stackoverflow.com/questions/3144711/
 * @author      Mic-M <https://github.com/Mic-M/>
 * @license 	MIT License
 * @version     0.1
 */
class MyTimer {

    /**
     * Constructor
     * @param    {string}    label      The name(label) of the timer for ease of identification
     * @param    {number}    delay      Delay in milliseconds
     * @param    {function}  callback   Function to be executed after the delay
     */
    constructor(label, delay, callback) {
        this._label = label;        // Timer label/name
        this._delay = delay;        // Delay in milliseconds
        this._callback = callback;  // Function to be executed after the delay
        this._id = null;            // The setTimeout() id
        this._startTime = null;     // Timestamp of start time
        this._remainingTime = 0;    // Remaining time in ms
        this._isRunning = false;    // Status if timer is currently running or not.
    }
    
    start() {
        this._remainingTime = this._delay;
        if (this._id) clearTimeout(this._id);
        this._id = null;
        this._isRunning = true;
        this._startTime = Date.now();
        this._id = setTimeout(this._callback, this._remainingTime);
    }

    stop() {
        this._isRunning = false;
        if (this._id) clearTimeout(this._id); 
        this._id = null;
        this._remainingTime = 0;
    }

    getTimeLeft() {
        if (this._isRunning && this._callback && this._id && this._startTime) {
            clearTimeout(this._id);
            this._isRunning = false;
            this._remainingTime -= Date.now() - this._startTime;
            this.start();
            return this._remainingTime;
        } else {
            return 0;
        }
    }

    isRunning() {
        return this._isRunning;
    }

}

module.exports = MyTimer;