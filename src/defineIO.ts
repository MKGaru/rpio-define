import rpio from 'rpio'

type BasePortDescriptor = {
	pin: number,
}

type DigitalInDescriptor = BasePortDescriptor & {
	type: 'digital' | typeof Boolean,
	mode?: 'input' | typeof rpio.INPUT | 'inputpullup',
	callback?: (pin: number) => void,
	edge?: 'rising' | 'falling' | 'both' | typeof rpio.POLL_HIGH | typeof rpio.POLL_LOW | typeof rpio.POLL_BOTH
}
type DigitalOutDescriptor = BasePortDescriptor & {
	type: 'digital' | typeof Boolean,
	mode?: 'output' | typeof rpio.OUTPUT | 'outputopendrain',
	default?: boolean,
}
type DigitalPortDescriptor = DigitalOutDescriptor | DigitalInDescriptor

/** [pulse value] or [angle and pulse]  */
type ServoRangeDefine = number | {
	angle: number,
	pulse: number,
}
type ServoPortDescriptor = BasePortDescriptor & {
	type: 'servo',
	default?: number,
	min?: ServoRangeDefine,
	max?: ServoRangeDefine,
	offset?: number,
}
type PWMPortDescriptor = BasePortDescriptor & {
	type: 'pwm',
	default?: number,
	min?: number,
	max?: number,
	hz?: // 19.2MHz / (2**(0～12))
		19_200_000 |
		 9_600_000 |
		 4_800_000 |
		 2_400_000 |
		 1_200_000 |
		   600_000 |
		   300_000 |
		   150_000 |
		    75_000 |
		    37_500 |
		    18_750 |
		     9_375 |
		     4_687.5
	,
}

export type CustomPortDescriptor = <T>(...args: any[]) => {
	type: string,
	get(): T,
	set(value: T): void,
}

type PortDescritpor =
	DigitalPortDescriptor |
	ServoPortDescriptor |
	PWMPortDescriptor |
	ReturnType<CustomPortDescriptor>

type PortDescritpors = {[label: string]: PortDescritpor}

/** use example

```javascript
    import rpio from 'rpio'
    import { defineIO } from 'rpio-define'

    rpio.init({ mapping: 'gpio' });
    
    const io = defineIO({
        led: {
            pin: 16,
            type: Boolean,
        },
        motor: {
            pin: 12,
            type: 'servo'
        }
    });

    io.led = true;  // LED on!
    setInterval(() => {
        io.led = !io.led; // LED blinking
    }, 1000);
```
*/
export function defineIO<IODescriptor extends PortDescritpors>(descriptors: IODescriptor) {
	const io: {
		[label in keyof IODescriptor]:
			IODescriptor[label] extends DigitalPortDescriptor ? boolean
			: IODescriptor[label] extends ServoPortDescriptor ? number
			: IODescriptor[label] extends PWMPortDescriptor ? number
			: IODescriptor[label] extends ReturnType<CustomPortDescriptor> ? ReturnType<IODescriptor[label]['get']>
			: never
	} = {} as any

	for (const [_key, descriptor] of Object.entries(descriptors)) {
		const key = _key
		const type = typeof descriptor.type == 'string'
			? descriptor.type.toLowerCase()
			: descriptor.type && 'name' in descriptor.type && typeof descriptor.type.name == 'string'
				? descriptor.type.name.toLowerCase()
				: ''
		
		const isDigitalPortDescriptor = (descriptor: PortDescritpor): descriptor is DigitalPortDescriptor =>
			descriptor.type == Boolean || type == 'digital'
		const isServoPortDescriptor = (descriptor: PortDescritpor): descriptor is ServoPortDescriptor =>
			type == 'servo'
		const isPWMPortDescriptor = (descriptor: PortDescritpor): descriptor is PWMPortDescriptor =>
			type == 'pwm'
		
		if (isDigitalPortDescriptor(descriptor)) {
			if (typeof descriptor.mode == 'string') {
				const mode = descriptor.mode.toLowerCase()
				if (mode == 'output')
					descriptor.mode = rpio.OUTPUT
				else if (mode == 'input')
					descriptor.mode = rpio.INPUT
			}
			if (descriptor.mode == undefined)
				descriptor.mode = rpio.OUTPUT
			
			const isDigitalPortOutputDescriptor = (descriptor: DigitalPortDescriptor): descriptor is DigitalOutDescriptor =>
				descriptor.mode == rpio.OUTPUT || descriptor.mode == 'outputopendrain'
			const isDigitalPortInputDescriptor = (descriptor: DigitalPortDescriptor): descriptor is DigitalInDescriptor =>
				descriptor.mode == rpio.INPUT || descriptor.mode == 'inputpullup'
			
			if (isDigitalPortOutputDescriptor(descriptor)) {
				let value = descriptor.default || false
				if (descriptor.mode == rpio.OUTPUT) {
					rpio.mode(descriptor.pin, descriptor.mode, value ? rpio.HIGH : rpio.LOW)
				}
				else {
					rpio.mode(descriptor.pin, rpio.INPUT, rpio.LOW)
					if (descriptor.default) {
						rpio.mode(descriptor.pin, rpio.OUTPUT, rpio.LOW)
					}
				}
				Object.defineProperty(io, key, {
					get() {
						return value
					},
					set(val) {
						value = val
						if (descriptor.mode == rpio.OUTPUT) {
							rpio.write(descriptor.pin, value ? rpio.HIGH : rpio.LOW)
						}
						else if (descriptor.mode == 'outputopendrain') {
							rpio.mode(descriptor.pin, value ? rpio.OUTPUT : rpio.INPUT)
						}
					},
					enumerable: true,
				})
			}
			else if (isDigitalPortInputDescriptor(descriptor)) {
				if (typeof descriptor.callback == 'function') {
					const opt = {
						pin: descriptor.pin,
						mode: descriptor.mode,
						edge: descriptor.edge,
					}
					if (typeof opt.edge == 'string') {
						if (opt.edge == 'rising')
							opt.edge = rpio.POLL_HIGH
						else if (opt.edge == 'falling')
							opt.edge = rpio.POLL_LOW
						else if (opt.edge == 'both')
							opt.edge = rpio.POLL_BOTH
					}
					if (typeof opt.mode == 'undefined')
						// @ts-ignore
						delete opt.mode
					if (typeof opt.edge == 'undefined')
						delete opt.edge
					rpio.poll(descriptor.pin, descriptor.callback, descriptor.edge !== undefined ? opt.edge : rpio.POLL_BOTH)
					Object.defineProperty(io, key, {
						get() {
							const value = !!rpio.read(descriptor.pin)
							return descriptor.mode == rpio.PULL_UP ? !value : value
						},
						enumerable: true,
					})
				}
				else {
					rpio.mode(descriptor.pin, rpio.INPUT, descriptor.mode == 'inputpullup' ? rpio.PULL_UP : rpio.PULL_OFF)
					Object.defineProperty(io, key, {
						get() {
							const value = !!rpio.read(descriptor.pin)
							return descriptor.mode == rpio.PULL_UP ? !value : value
						},
						enumerable: true,
					})
				}
			}
		}
		/* RaspberryPiにはDAC/ADCは標準搭載されていないらしい・・・。残念。
		else if ((descriptor.type == Analog || descriptor.type == Number || type == 'analog')) {
			// [Analog] https://github.com/Moddable-OpenSource/moddable/blob/public/documentation/pins/pins.md#analog
			const scale = typeof descriptor.scale == 'number' ? descriptor.scale : 1
			// ESP32の場合のDigital -> Analog ピン番号読み替え
			// https://github.com/espressif/arduino-esp32/blob/master/cores/esp32/esp32-hal-gpio.c#L27
			const analogPin = descriptor.pin > 7 ? {
				36: 0,
				37: 1,
				38: 2,
				39: 3,
				32: 4,
				33: 5,
				34: 6,
				35: 7,
				//8
				//9
				//4: 10,
				//0: 11,
				//2: 12,
				15: 13,
				13: 14,
				12: 15,
				14: 16,
				27: 17,
				25: 18,
				26: 19
			}[descriptor.pin] : descriptor.pin
			
			const port = new Digital(descriptor.pin, Digital.Input)
			
			// 44や971は実測の最大・最小値 　いったんこの値でキャリブレーション
			let min = 44
			let max = 971
			
			Object.defineProperty(io, key, {
				get() {
					const raw = Analog.read(analogPin)
					if (raw > max) max = raw
					if (raw < min) min = raw
					const value = Math.min(Math.max(raw - min, 0) / (max - min), 1)
					return value * scale
				},
				enumerable: true,
			})
		}
		*/
		else if (isServoPortDescriptor(descriptor)) {
			let value = descriptor.default || 0
			const option = {
				pin: descriptor.pin,
				min: descriptor.min,
				max: descriptor.max
			}
			let minAngle = 0
			let maxAngle = 180
			let offsetAngle = 0
			if (typeof option.min == 'undefined')
				option.min = 500
			if (typeof option.min == 'object') {
				if (typeof option.min.angle == 'number')
					minAngle = option.min.angle
				option.min = option.min.pulse
			}
			if (typeof option.max == 'undefined')
				option.max = 2400
			if (typeof option.max == 'object') {
				if (typeof option.max.angle == 'number')
					maxAngle = option.max.angle
				option.max = option.max.pulse
			}
			if (typeof descriptor.offset == 'number') {
				offsetAngle = descriptor.offset
			}
			const scale = (option.max - option.min) / (maxAngle - minAngle)
			let minPulse = option.min
			if (option.min === undefined)
				delete option.min
			if (option.max === undefined)
				delete option.max
			rpio.open(descriptor.pin, rpio.PWM)
			rpio.pwmSetClockDivider(128) // 1.92MHz / 128 = 150kHz
			rpio.pwmSetRange(descriptor.pin, 3000) // 150kHz / 3000 = 50Hz = 20ms
			const rate = 20000 / 3000 // (20ms = 20,000us) / 3000 = 6.6us 
			Object.defineProperty(io, key, {
				get() {
					return value
				},
				set(val) {
					value = val
					rpio.pwmSetData(descriptor.pin, ((((val - minAngle + offsetAngle) * scale) + minPulse) / rate) | 0)
				},
				enumerable: true,
			})
			// @ts-ignore
			io[key] = value
		}
		/*
		else if (type =='tone' || type == 'pulse') {
			const option = {
				pin: descriptor.pin
			}
			Object.defineProperty(io, key, {
				value(frequency, duration) {
					option.freq = frequency
					const port = new Tone(option)
					port.write(frequency)
					if (duration) {
						Timer.delay(duration)
						port.close()
					} else {
						return () => port.close()
					}
				}
			})
		}
		*/
		else if (isPWMPortDescriptor(descriptor)) {
			let value = descriptor.default || 0
			const opt = {
				pin: descriptor.pin,
				hz: 300_000
			}
			const max = descriptor.max || 1
			if (typeof descriptor.hz == 'number')  opt.hz = descriptor.hz
			rpio.open(opt.pin, rpio.PWM)
			rpio.pwmSetRange(opt.pin, 1023)
			rpio.pwmSetClockDivider(Math.floor((19.2 * 1_000_000) / opt.hz))
			
			Object.defineProperty(io, key, {
				get() {
					return value
				},
				set(val) {
					value = val
					if (max > 1) {
						val /= max
					}
					if (val <= 1) val *= 1023
					rpio.pwmSetData(opt.pin, val)
				},
				enumerable: true,
			})
			// @ts-ignore
			io[key] = value
		}
		else if('get' in descriptor) {
			Object.defineProperty(io, key, {
				get: descriptor.get,
				set: descriptor.set,
				enumerable: true,
			})
		}
	}
	return io
}
Object.freeze(defineIO)
export default defineIO

/* Todo documentation: custom port driver
function MCP4725(descriptor: { address: number }) {
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
			return dacValue / 4095
		},
		set(value: number) {
			rpio.i2cSetSlaveAddress(descriptor.address)
			rpio.i2cSetBaudRate(100_000)
			const output = value * 4095
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
	led: {
		pin: 16,
		type: Boolean,
	},
	motor: {
		pin: 12,
		type: 'servo'
	},
	DAC: MCP4725({
		address: 0x60,
	}),
})
*/
