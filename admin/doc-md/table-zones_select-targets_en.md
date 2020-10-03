Double click or hit F2 on a selected target device to set individual values.<br>
<details>
  <summary style="padding-bottom:-20px">Further explanation (click me)</summary> <!-- Header -->
  <!-- Markdown Collapsible Section - We must have an empty line below -->


### Examples
 * **{** `val:Radio Chillout, delay:20` **}**
 * **{** `delay:30` **}**
 * **{** `val:true` **}**

### Explanation
 * **val**: This overwrites *Value for 'on'* of *1. TARGET DEVICES*.
 * **delay**: Delayed switch-on in seconds. This switches on the target device with a delay when the zone is activated. <br>*Example use case*: Switch on a power plug immediately, wait 30 seconds and then switch on the TV (e.g. because it does not react to IR commands before) and dim the light in the TV corner after 50 seconds.

#### Please note
This function has been extended with adapter version 0.5.3, in previous versions you could only set a new target value with **{** `new target value` **}**. Please change this occasionally to **{** `val:new target value` **}**, i.e. add the prefix `val:`. In newer adapter versions `val:` will be required for it to continue to work.

</details>