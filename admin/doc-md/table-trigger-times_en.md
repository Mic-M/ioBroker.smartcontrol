These triggers are activated once the according time is reached.

| Column | Mandatory | Description |
|----------|:------------:|-------|
| ✓        |  Yes   | Enables/disables this table row. If not activated, this table row is ignored by the adapter. In the Adapter Options, under 'FURTHER OPTIONS > Input Validation', you can set that even disabled rows are checked for validity. |
| Name of trigger | Yes | Any trigger name. |
| Time | Yes | Here you can enter a time in hour/minute, like '23:30'. You can also enter an astro name like `sunset` and add an offset in minutes, e.g. `goldenHourEnd+30` or `sunset-60`.<br>The current astro times can be found as info states of this adapter: `smartcontrol.x.info.astroTimes`.<br> You can also use Cron here, e.g. `5 4 * * *`. To easily determine the cron syntax to use, you can use the following website: [Crontab.guru](https://crontab.guru/).<br><br>For hours/minutes (like `23:30`) or astro times (like `sunset`) the execution is every day. In "4. ZONES" you can further limit this accordingly. |
| Additional conditions | No | Here you can enter additional conditions that must be fulfilled additionally, e.g: Someone is present, today is a holiday, grandma is sleeping, etc. |
| ✓✓ | No | For *Additional conditions*: If activated, all conditions must apply ('and'). If disabled, it is enough if one of the conditions applies.<br>If you select only one condition, it doesn't matter if you enable it or not.|
| Never if... | No | Here you can enter additional conditions that must never apply, for example No one at home, radio on, etc. |
| ✓✓ | No | For *Never if...*: If activated, all conditions must apply ('and'). If disabled, it is enough if one of the conditions applies.<br>If you select only one condition, it doesn't matter if you enable it or not.|
| Target off | No | Normally, the target devices are switched on when the triggering occurs (1. TARGET DEVICES > 'State to switch device on' / 'Value for on'). If you activate this option, the state is not turned on but off (1. TARGET DEVICES > 'State to switch device off' / 'Value for off'). |