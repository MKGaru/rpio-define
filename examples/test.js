const rpio = require('rpio')
const { defineIO } = require('../lib/defineIO')

const MCP4725 = require('./drivers/MCP4725')
const MPU6050 = require('./drivers/MPU6050')

rpio.init({
	gpiomem: false,
	mapping: 'gpio',
})

const io = defineIO({
	powerLED: {
		pin: 5,
		type: Boolean,
		default: true,
	},
	stateLED: {
		pin: 6,
		type: Boolean,
	},
	dac: MCP4725({
		address: 0x60,
	}),
	axis: MPU6050({
		address: 0x68,
	})
})

io.axis.enable()

setInterval(() => {
	// read device motion from i²c
	io.axis.fetch()
	const roll = io.axis.roll
	// stateLED on if device roll over 30 degree
	io.stateLED = roll > 30
	// dacWrite value
	io.dac = roll / 180

	console.log(io.axis.roll, io.axis.pitch)
}, 100)
