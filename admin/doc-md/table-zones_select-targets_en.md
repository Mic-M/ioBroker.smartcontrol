Double click or hit F2 on a selected target device to set individual values.<br>
<details>
  <summary style="padding-bottom:-20px">Further explanation (click me)</summary> <!-- Header -->
  <!-- Markdown Collapsible Section - We must have an empty line below -->


### Examples
 * **{** `val:Radio Chillout, delay:20` **}**
 * **{** `delay:30` **}**
 * **{** `val:true` **}**

### Explanation
 * **val**: Overwrites *Value for 'on'* of *1. TARGET DEVICES*.
 * **delay**: Overwrites *Delay for switching target device on* of *1. TARGET DEVICES* by the number of seconds set. To deactivate, use `delay:0`. <br>*Example use case*: Switch on a power plug immediately, wait 30 seconds and then switch on the TV (e.g. because it does not react to IR commands before) and dim the light in the TV corner after 50 seconds.

#### Please note
This function was extended with adapter version 0.5.3, in the previous versions you could only set a new target value with e.g. **{** `Radio Chillout` **}**. This is still supported by the adapter. So if you only want to overwrite the target value you can simply enter **{** `Radio Chillout` **}** instead of **{** `val:Radio Chillout` **}**. But if you also want to set a **delay** you have to enter **{** `val:Radio Chillout, delay:20` **}**. Delay alone, i.e. **{** `delay:20` **}** works too, but then the target value will not be overwritten, of course.

</details>