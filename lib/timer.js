'use strict';

/**
 * @class       MyTimer
 * @description Find out time remaining, stop timer easily, check status (running yes/no)
 *              Inspired by https://stackoverflow.com/questions/3144711/
 * @author      Mic-M <https://github.com/Mic-M/>
 * @license 	MIT License
 * @version     0.1.0
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
        this._isRunning = false;    // Status if timer is currently running or not.
    }
    
    start() {
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
        if (this._isRunning && this._id && this._startTime) {
            const remaining = this._delay - (Date.now() - this._startTime);
            this._isRunning = false;
            clearTimeout(this._id);
            this.start();
            return remaining;
        } else {
            return 0;
        }
    }

    isRunning() {
        return this._isRunning;
    }

}

module.exports = MyTimer;