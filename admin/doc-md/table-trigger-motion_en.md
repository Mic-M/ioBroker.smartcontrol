Here you can enter your motion sensors. You can also optionally define brightness states and according thresholds.

| Column | Mandatory | Description |
|----------|:------------:|-------|
| ✓        |  Yes   | Enables/disables this table row. If not activated, this table row is ignored by the adapter. In the Adapter Options, under 'FURTHER OPTIONS > Input Validation', you can set that even disabled rows are checked for validity. |
| Name of motion sensor | Yes | Any name for the motion sensor.
| State of motion sensor | Yes | states for motion sensor|
| Sec | No | After this number of seconds (and no further motion detected in the meantime), the target devices will be turned off.<br>To disable: Leave blank or set to 0.<br>Further info: As soon as the motion sensor states is set to `false`, i.e. no more motion is detected any longer, a timer starts with the seconds specified here. After these seconds have elapsed, the target devices defined in the respective zone(s) will be switched off. If a new motion occurs (motion sensor state to `true`) while the timer is running, the timer will be cleared and the target devices will remain on.
| (icon: timer off) | No | If this option is enabled, no off timer will be set for the target devices that were already on. Use case: [see forum post](https://forum.iobroker.net/post/433871).|
| State of brightness | No | state that reflects the current brightness.|
| Threshold | No | Threshold value for the brightness. If the current brightness of 'State of brightness' is greater than this number, the motion is ignored.<br>Please also note the option *Do not verify brightness if zone is on* under 'FURTHER OPTIONS > Motion sensors'.|