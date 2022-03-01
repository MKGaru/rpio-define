const rpio = require('rpio')

const Registers = Object.freeze({
	INT_BYPASS: 0x37,

	ACCEL_OUT: 0x3B,
	TEMP_OUT: 0x41,
	GYRO_OUT: 0x43,
	
	PWR_MGMT_1: 0x6B,
})

const GYRO_SCALER = (1 / 131) //Datasheet Section 6.1
const ACCEL_SCALER = (1 / 16384) //Datasheet Section 6.2
const TEMP_SCALER = (1 / 340)
const RAD_TO_DEG = (360 / (2 * Math.PI))

/**
 *  @param descriptor {{ address: number }}
 */
function MPU6050(descriptor) {
	rpio.i2cBegin()

	const arrayBuffer = new ArrayBuffer(
		2 * 3 +
		2 +
		2 * 3
	)
	const buffer = Buffer.from(arrayBuffer)
	const accelView = new DataView(arrayBuffer, 0, 6)
	const tempView = new DataView(arrayBuffer, 6, 2)
	const gyroView = new DataView(arrayBuffer, 8, 6)

	const port = {
		enable() {
			rpio.i2cSetBaudRate(100_000)
			rpio.i2cSetSlaveAddress(descriptor.address)
			// https://shizenkarasuzon.hatenablog.com/entry/2019/02/16/162647
			
			port.reset()
			port.fetch()
		},
		reset() {
			rpio.i2cSetBaudRate(100_000)
			rpio.i2cSetSlaveAddress(descriptor.address)
			rpio.i2cWrite(Buffer.from([
				Registers.PWR_MGMT_1,
				0b1000000,
			]))
			rpio.msleep(150)
			rpio.i2cWrite(Buffer.from([
				Registers.PWR_MGMT_1,
				0
			]))
		},
		fetch() {
			rpio.i2cSetBaudRate(100_000)
			rpio.i2cSetSlaveAddress(descriptor.address)
			rpio.i2cReadRegisterRestart(
				// @ts-ignore // https://github.com/jperkin/node-rpio/blob/52ae5/src/rpio.cc#L366
				Buffer.from([Registers.ACCEL_OUT]),
				buffer,
			)
		},
		get temp() {
			return tempView.getInt16(0) * TEMP_SCALER + 36.53
		},
		accel: {
			get x() {
				return accelView.getInt16(2 * 0) * ACCEL_SCALER
			},
			get y() {
				return accelView.getInt16(2 * 1) * ACCEL_SCALER
			},
			get z() {
				return accelView.getInt16(2 * 2) * ACCEL_SCALER
			}
		},
		gyro: {
			get x() {
				return gyroView.getInt16(2 * 0) * GYRO_SCALER
			},
			get y() {
				return gyroView.getInt16(2 * 1) * GYRO_SCALER
			},
			get z() {
				return gyroView.getInt16(2 * 2) * GYRO_SCALER
			}
		},
		get roll() {
			return Math.atan2(port.accel.y, port.accel.z) * RAD_TO_DEG
		},
		get pitch() {
			return Math.atan(-port.accel.x / Math.sqrt(port.accel.y ** 2, port.accel.z ** 2)) * RAD_TO_DEG
		}
	}
	return {
		type: 'mpu6050',
		value: port
	}
}

module.exports = MPU6050
