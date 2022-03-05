[WIP] rpio-define
=========================
[![npm version](https://badge.fury.io/js/rpio-define.svg)](https://badge.fury.io/js/rpio-define)

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
const { defineIO, DigitalOutput, DigitalInput } = require('rpio-define')

rpio.init({ mapping: 'gpio' })

const io = defineIO({
    powerLED: DigitalOutput({
      pin: 5,
      default: true,
    }),
    chargeLED: DigitalOutput({
      pin: 6,
    }),
    button: DigitalInput({
      pin:16,
      callback() {
        // chargeLED on while button push
        io.chargeLED = io.button
      },
    })
})
```

Quickstart
-------------------------

All these examples use the gpio numbering (1-27) and assume that the example is started with:

```javascript
const rpio = require('rpio')
const { defineIO, DigitalOutput, DigitalInput } = require('rpio-define')

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

or ( These are equivalent )

```javascript
const io = defineIO({
  button: DigitalInput({
    pin: 22,
  })
})

console.log(`Button state is currently ${io.button ? 'on' : 'off'}`)
```

### Blink an LED
Blink an LED attached to GPIO23 a few times:

```javascript
const io = defineIO({
  led: DigitalOutput({
    pin: 23,
  })
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
  button: DigitalInput({
    pin: 22,
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
  })
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

### Custom Driver

```javascript
/**
 *  define simple driver for i²c 12bit DAC MCP4725
 *  @param descriptor {{ address: number, min?: number, max?: number }}
 */
function MCP4725(descriptor) {
  if (typeof descriptor.min == 'undefined') descriptor.min = 0
  if (typeof descriptor.max == 'undefined') descriptor.max = 1
  rpio.i2cBegin()

  return {
    type: 'mcp4725',
    get() {
      const register = Buffer.alloc(6)
      rpio.i2cSetSlaveAddress(descriptor.address)
      rpio.i2cSetBaudRate(100_000)
      rpio.i2cRead(register, 6)
      const data = Array.from(register)
      const dacValue = (data[1] << 4) + (data[2] >> 4)
      return dacValue / 4095 * (descriptor.max - descriptor.min) + descriptor.min
    },
    /** @param value {number} */
    set(value) {
      value = Math.min(descriptor.max, Math.max(descriptor.min, value))
      rpio.i2cSetSlaveAddress(descriptor.address)
      rpio.i2cSetBaudRate(100_000)
      const output = (value - descriptor.min) / (descriptor.max - descriptor.min) * 4095
      const command = [
        0x60,
        output >> 4,
        (output & 0b1111) << 4
      ]
      rpio.i2cWrite(Buffer.from(command))
    }
  }
}

const io = defineIO({
  dac: MCP4725({
    address: 0x60,
  })
})

io.dac = 0.5 // normalized value
```
