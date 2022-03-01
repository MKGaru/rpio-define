const rpio = require('rpio')

/**
 *  @param descriptor {{ address: number }}
 */
function MCP4725(descriptor) {
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
		/** @param value {number} */
		set(value) {
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

module.exports = MCP4725
