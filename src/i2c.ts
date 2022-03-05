
/** @license original source: https://github.com/ros2jsguy/mpu6050-motion-data/blob/081986/src/rpio-i2c-helper.ts */

import rpio from 'rpio'

// TODO - repalce this constant with actual enum type returned from
// rpio.i2cWriteXXX() once the typescript definitions have been
// udpated, https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/rpio
const I2C_SUCCESS = 0 // I2cStatusCode.OK
type I2C_RESULT = typeof I2C_SUCCESS

type BitPos = 0|1|2|3|4|5|6|7
type BitLength = 1|2|3|4|5|6|7|8

type ZeroTo<To extends number, Result extends any[]= []>
	= Result['length'] extends To
		? Result[number]
		: ZeroTo<To, [...Result, Result['length']]>
type _Pow2<T extends number, R1 extends any[] = [any], R2 extends any[] = []> =
	R2['length'] extends T
		? R1
		: [..._Pow2<T, [...R1, ...R1], [...R2, any]>]
type Pow2<T extends number> =
	_Pow2<T>['length'] extends number
		? _Pow2<T>['length']
		: never
export type Bits<Length extends BitLength> = ZeroTo<Pow2<Length>>

export type Bit = Bits<1>
export type Byte = Bits<8>

type AvailableLength<Position extends BitPos> =
	Position extends 0 ? 1 :
	Position extends 1 ? 1|2 :
	Position extends 2 ? 1|2|3 :
	Position extends 3 ? 1|2|3|4 :
	Position extends 4 ? 1|2|3|4|5 :
	Position extends 5 ? 1|2|3|4|5|6 :
	Position extends 6 ? 1|2|3|4|5|6|7 :
	Position extends 7 ? BitLength :
	never

/**
This class copy from @ros2jsguy mpu6050-motion-data: https://github.com/ros2jsguy/mpu6050-motion-data/blob/0819863463db455c88a37b94c9280dba9a5118b2/src/rpio-i2c-helper.ts  
(* but not compatible.)

usage.  
```typescript
    enum Register1 {
       INT_STATUS   = 0x3A,
       ACCEL_XOUT_H = 0x3B,
       TEMP_OUT_H   = 0x41,
       GYRO_XOUT_H  = 0x43,
    }
    const mpu6050 = new I2CDevice<Register1>({
       deviceAddr: 0x68
    })
    mpu6050.readBit(Register1.ACCEL_XOUT_H, 1)
    mpu6050.readBit(Register1.ACCEL_XOUT_H + 2, 1) // allow unknown address 
```
or
```typescript  
  const Register2 = Object.freeze({
       INT_STATUS   : 0x3A,
       ACCEL_XOUT_H : 0x3B,
       TEMP_OUT_H   : 0x41,
       GYRO_XOUT_H  : 0x43,
  } as const)
  type ValueOf<T extends Object> = T[keyof T]
  const mpu9050 = new I2CDevice<ValueOf<typeof Register2>>({
       deviceAddr: 0x68
  })
  mpu9050.readBit(Register2.ACCEL_XOUT_H, 1)
  mpu9050.readBit(Register2.ACCEL_XOUT_H + 2, 1) // disallow unknown address
```
 */
export class I2CDevice<Register extends number> {
	/** I2C slave device address */
	private deviceAddr: number
	/** I2C baudRate */
	private baudRate: number
	
	/** data sent to device */
	private regBuffer: Buffer 
	/** data received from device */
	private dataBuffer: Buffer

	private regView: DataView
	private dataView: DataView

	constructor(
		{ deviceAddr, baudRate = 100_000, regBufferSize = 4, dataBufferSize = 42 }:
		{ deviceAddr: number, baudRate?: number, regBufferSize?: number, dataBufferSize?: number }
	) {
		// configure RPIO
		// TODO - i2c should be setup/shutdown externally as i2c may have multiple slave devices
		rpio.i2cBegin()
		rpio.i2cSetBaudRate(baudRate)

		this.deviceAddr = deviceAddr
		this.baudRate = baudRate
		
		const regArrayBuffer = new ArrayBuffer(regBufferSize)
		const dataArrayBuffer = new ArrayBuffer(dataBufferSize)
		this.regView = new DataView(regArrayBuffer)
		this.dataView = new DataView(dataArrayBuffer)
		this.regBuffer = Buffer.from(regArrayBuffer)
		this.dataBuffer = Buffer.from(dataArrayBuffer)
	}

	shutdown(): void {
		// TODO revise - see note above
		rpio.i2cEnd()
	}

	/** Read a single bit from an 8-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @param bitNum Bit position to read (0-7)
	 * @returns Status bit value
	 */
	readBit(regAddr: Register, bitNum: BitPos): Bit {
		const b = this.readByte(regAddr)
		return  ((b & (1 << bitNum)) >> bitNum) as Bit
	}

	/** Read multiple bits from an 8-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @param bitStart First bit position to read (0-7)
	 * @param length Number of bits to read (not more than 8)
	 * @returns The bits read
	 */
	readBits<Position extends BitPos, Length extends AvailableLength<Position>>(regAddr: Register, bitStart: Position, length: Length): Bits<Length> {
		let b = this.readByte(regAddr)
		const mask = ((1 << length) - 1) << (bitStart - length + 1)
		b &= mask
		b >>= (bitStart - length + 1)
		return b as Bits<Length>
	}

	/** Read single byte from an 8-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @returns The byte read.
	 */
	readByte(regAddr: Register): Byte {
		const status = this.readBytes(regAddr, 1)
		return this.dataView.getUint8(0) as Byte
	}

	/** Read multiple bytes from an 8-bit device register.
	 * @param regAddr First register regAddr to read from
	 * @param length Number of bytes to read
	 * @returns Buffer containing the read bytes
	 */
	readBytes(regAddr: Register, byteCnt: number): Buffer {
		// set register to read
		this.regView.setUint8(0, regAddr)
		rpio.i2cSetSlaveAddress(this.deviceAddr)
		rpio.i2cSetBaudRate(this.baudRate)
		rpio.i2cWrite(this.regBuffer, 1)

		// read register data
		rpio.i2cRead(this.dataBuffer, byteCnt)
		return this.dataBuffer.subarray(0, byteCnt)
	}

	/** Read single word from a 16-bit device register.
	 * @param regAddr Register regAddr to read from
	 * @return The 16-bit word read.
	 */
	readWord(regAddr: Register): number {
		this.readBytes(regAddr, 2)
		return this.dataView.getUint16(0, false)
	}

	/** 
	 * Write a single bit in an 8-bit device register.
	 * @param regAddr Register regAddr to write to
	 * @param bitNum Bit position to write (0-7)
	 * @param data New bit value to write
	 * @returns Status of operation (0 = success)
	 */
	writeBit(regAddr: Register, bitNum: BitPos, data: Bit): I2C_RESULT {
		let b = this.readByte(regAddr)
		b = (data !== 0) ? (b | (1 << bitNum)) as Byte : (b & ~(1 << bitNum)) as Byte
		this.writeByte(regAddr, b)
		return I2C_SUCCESS
	}

	/** Write multiple bits in an 8-bit device register.
	 * @param regAddr Register regAddr to write to
	 * @param bitStart First bit position to write (0-7)
	 * @param length Number of bits to write (not more than 8)
	 * @param bits Right-aligned value to write
	 * @returns Status of operation (0 = success)
	 */
	 writeBits<Position extends BitPos, Length extends AvailableLength<Position>>(regAddr: Register, bitStart: Position, length: Length, bits: Bits<Length>): I2C_RESULT {
		//      010 value to write
		// 76543210 bit numbers
		//    xxx   args: bitStart=4, length=3
		// 00011100 mask byte
		// 10101111 original value (sample)
		// 10100011 original & ~mask
		// 10101011 masked | value
		let b = this.readByte(regAddr)
		const mask = ((1 << length) - 1) << (bitStart - length + 1)
		let data = bits << (bitStart - length + 1) // bits data into correct position
		data &= mask // zero all non-important bits in data
		b &= ~(mask) // zero all important bits in existing byte
		b |= data // combine data with existing byte
		this.writeByte(regAddr, b as Byte)
		return I2C_SUCCESS
	}

	/** Write single byte to an 8-bit device register.
	 * @param regAddr Register address to write to
	 * @param data New byte value to write
	 * @returns Status of operation (0 = success)
	 */
	writeByte(regAddr: Register, data: Byte): I2C_RESULT {
		// identify register and data to write
		this.dataView.setUint8(0, regAddr)
		this.dataView.setUint8(1, data)

		// write to register
		rpio.i2cSetSlaveAddress(this.deviceAddr)
		rpio.i2cSetBaudRate(this.baudRate)
		rpio.i2cWrite(this.dataBuffer, 2)
		return I2C_SUCCESS
	}

	/** Write multiple bytes to an 8-bit device register.
	 * @param regAddr First register address to write to
	 * @param data Buffer to copy new data from
	 * @returns Status of operation (0 = success)
	 */
	writeBytes(regAddr: Register, data: Buffer|number[]): I2C_RESULT {

		// identify register and data to write
		this.dataView.setUint8(0, regAddr)

		for (let i = 0; i < data.length; i++) {
			this.dataView.setUint8(i + 1, data[i])
		}

		rpio.i2cSetSlaveAddress(this.deviceAddr)
		rpio.i2cSetBaudRate(this.baudRate)
		rpio.i2cWrite(this.dataBuffer, data.length + 1)
		return I2C_SUCCESS
	}

	/** Write 2 byte number to a 16-bit device register.
	 * @param regAddr First register address to write to
	 * @param data Data to copy 
	 * @returns Status of operation (0 = success)
	 */
	writeWord(regAddr: Register, data: number): I2C_RESULT {
		// identify register and data to write
		this.dataView.setUint8(0, regAddr)
		this.dataView.setUint16(1, data, false)

		// write to register
		rpio.i2cSetSlaveAddress(this.deviceAddr)
		rpio.i2cSetBaudRate(this.baudRate)
		rpio.i2cWrite(this.dataBuffer, 3)
		return I2C_SUCCESS
	}
}
