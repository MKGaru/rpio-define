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
	chargeLED: {
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
	io.axis.fetch()
	
}, 100)
