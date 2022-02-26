[![npm version](https://badge.fury.io/js/rpio-define.svg)](https://badge.fury.io/js/rpio-define)

[WIP] rpio-define
=========================
Modern style define GPIO for RaspberryPi.

Install
-------------------------
Install the latest using npm:
```bash
npm install rpio rpio-define
```

Usage example
-------------------------
```javascript
const rpio = require('rpio')
const { defineIO } = require('rpio-define')

rpio.init({ mapping: 'gpio' })

const io = defineIO({
    powerLED: {
      pin: 5,
      type: Boolean,
      default: true,
    },
    chargeLED: {
      pin: 6,
      type: Boolean,
    },
    button: {
      pin:16,
      type: Boolean,
      mode: 'input',
      callback() {
        // chargeLED on while button push
        io.chargeLED = io.button
      },
    }
})
```

Quickstart
-------------------------

All these examples use the gpio numbering (1-27) and assume that the example is started with:

```javascript
const rpio = require('rpio')
const { defineIO } = require('rpio-define')

rpio.init({ mapping: 'gpio' })

const io = defineIO({
    // pin assign here.
})
```

### Read a pin
Setup "button switch" pin GPIO22 for read-only input and print its current value:

```javascript
const io = defineIO({
  button: {
    pin: 22,
    type: Boolean,
    mode: 'input'
  }
})

console.log(`Button state is currently ${io.button ? 'on' : 'off'}`)
```

### Blink an LED
Blink an LED attached to GPIO23 a few times:

```javascript
const io = defineIO({
  led: {
    pin: 23,
    type: Boolean,
    mode: 'output',
  }
})

async function task(times) {
  const pause = (msec) => new Promise(res => setTimeout(res, msec))
  for (let i = 0; i< times; i++) {
    io.led = true
    await pause(1 * 1000) // On for 1second
    io.led = false
    await pause(0.5 * 1000) // Off for 0.5 second 
  }
}
task(5)
```

### Poll a button switch for events
Configure the internal pullup resistor on GPIO22 and watch the pin for pushes on an attached button switch:

```javascript
const io = defineIO({
  button: {
    pin: 22,
    type: Boolean,
    mode: 'inputpullup',
    callback(pin) {
       /*
        * Wait for a small period of time to avoid rapid changes which
        * can't all be caught with the 1ms polling frequency.  If the
        * pin is no longer down after the wait then ignore it.
        */
       setTimeout(() => {
         if (!io.button) return
         console.log(`Button pressed on pin ${pin}`)
       }, 20)
    },
    edge: 'falling', // 'falling' = rpio.POLL_LOW , 'rising' = rpio.POLL_HIGH, 'both' = rpio.POLL_BOTH
  }
})
```

API
----------------------------
###  Digital output
| mode/value      | true    | false          |
|-----------------|---------|----------------|
| Output          | HIGH    | LOW            |
| OutputOpenDrain | LOW     | HighImpedance  |

```javascript
const io = defineIO({
  led: { // led is any unique name
    pin: 13,
    type: Boolean, // Boolean | 'digital'
    mode: 'output', // 'output' | rpio.OUTPUT | 'outputopendrain'
    default: true, // [optional] If true, GPIO is output as HIGH (LOW during OpenDrain) from initial.
  }
})

setTimeout(() => {
  io.led = false
}, 5 * 1000)
```

### Digital input
| mode/Voltage    | HIGH    | LOW    |
|-----------------|---------|--------|
| Input           | true    | false  |
| InputPullUp     | false   | true   |

```javascript
const io = defineIO({
  button: { // button is any unique name
    pin: 13, // gpio or physical pin number (depend rpio mapping option)
    type: Boolean, // Boolean | 'digital'
    mode: 'input', // 'input' | 'inputpullup'
    callback(pin) {}, // [optional] callback on pin input state changed
    edge: 'both' // [optional] callback edge timing, 'falling' = rpio.POLL_LOW | 'rising' = rpio.POLL_HIGH | 'both' = rpio.POLL_BOTH
  }
})

console.log(`Button state is currently ${io.button ? 'on' : 'off'}`)
```

### Servo

```javascript
const io = defineIO({
  yaw: { // yaw is any unique name
    pin: 13,
    type: 'servo',
    min: { // [optional] default value: 500 , set pulse width (μsec)
      pulse: 600, // minimum pulse width (μsec)
      angle: -45, // minimum angle at degree
    },
    max: { // [optional] default value: 2400, set pulse width (μsec)
      pulse: 2400, // maximum pulse width (μsec)
      angle: 225, // maximum angle at degree
    },
    default: 0, // [optional] initial angle (degree)
    offset: 0, // [optional] offset agnle
  }
})

io.yaw = 90
```

