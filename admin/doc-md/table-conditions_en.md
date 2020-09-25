This table is optional:
<br>Here you enter additional conditions that should (not) apply, e.g: Someone is present, No one is present, Today is a holiday, etc. You can then select these conditions in the corresponding other option tables.

| Column | Mandatory | Description |
|----------|:------------:|-------|
| ✓        |  Yes   | Enables/disables this table row. If not activated, this table row is ignored by the adapter. In the Adapter Options, under 'FURTHER OPTIONS > Input Validation', you can set that even disabled rows are checked for validity. |
| Name of condition | Yes | Enter any name of your condition here, e.g. 'Holiday today'. |
| State of condition | Yes | State for this condition, e.g. `javascript.0.Holiday.isHolidayToday`. |
| State value | Yes | States value of the condition, if it should apply. You can use `true`, `false`, numbers like `144`, or strings. All spaces and quotation marks (like `"`) at the beginning and end are automatically removed. <br>**Note**: You can also use comparison operators `<`, `>`, `>=` and `<=` before numbers, to check for these. |

