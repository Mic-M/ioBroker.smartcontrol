You can select **Execute always**, then the zone will simply always execute if any previously defined conditions are met.<br> However, if you want to define more conditions, you should deactivate this option. Then a table with the following options will appear:

| Column | Mandatory | Description |
|----------|:------------:|-------|
| ![image](https://github.com/Mic-M/ioBroker.smartcontrol/blob/master/admin/doc-md/img/check_box-24px.svg?raw=true) |  Yes   | Enables/disables this table row. If not activated, this table row is ignored by the adapter. In the Adapter Options, under 'FURTHER OPTIONS > Input Validation', you can set that even disabled rows are checked for validity. |
| Name of zone | Yes | Any zone name. |
| Start/End | Yes | As soon as a trigger triggers, the current time must be within this time period in order for the target devices to be switched.<br>You can enter a time in hours/minutes here, such as `08:25` or `23:30`. You can also enter an astro name like `sunset` and add an offset in minutes, e.g. `goldenHourEnd+30` or `sunset-60`. <br>The current astro times can be found as info states in this adapter: `smartcontrol.x.info.astroTimes`.<br>A start time of e.g. `sunset` and an end time of e.g. `03:00` (i.e. beyond midnight) is also possible. |
| Mon-Sun | Yes | Targets are switched if these weekdays apply. |
| Additional conditions | No | Here you can enter additional conditions that must be fulfilled additionally, e.g: Someone is present, today is a holiday, grandma is sleeping, etc. |
| ![image](https://github.com/Mic-M/ioBroker.smartcontrol/blob/master/admin/doc-md/img/done_all-24px.svg?raw=true) | No | For *Additional conditions*: If activated, all conditions must apply ('and'). If disabled, it is enough if one of the conditions applies.<br>If you select only one condition, it doesn't matter if you enable it or not. |
| Never switch on if... | No | Here you can enter additional conditions that must never apply, e.g: No one at home, radio on, etc. |
| ![image](https://github.com/Mic-M/ioBroker.smartcontrol/blob/master/admin/doc-md/img/done_all-24px.svg?raw=true) | No | For *Never switch on if...*: If activated, all conditions must apply ('and'). If disabled, it is enough if one of the conditions applies.<br>If you select only one condition, it doesn't matter if you enable it or not. |
