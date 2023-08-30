const I2C_Dir_SDAin_SCLin = 0x00;
const I2C_Dir_SDAin_SCLout = 0x01;
const I2C_Dir_SDAout_SCLout = 0x03;
const I2C_Dir_SDAout_SCLin = 0x02;
const I2C_Data_SDAhi_SCLhi = 0x03;
const I2C_Data_SDAlo_SCLhi = 0x01;
const I2C_Data_SDAlo_SCLlo = 0x00;
const I2C_Data_SDAhi_SCLlo = 0x02;
const SDA_LO_SCL_LO = 0x00
const SDA_IN_SCL_IN = 0x00
const SDA_IN_SCL_OUT = 0x01
const SDA_OUT_SCL_IN = 0x02
const SDA_OUT_SCL_OUT = 0x03
// MPSSE clocking commands
const MSB_FALLING_EDGE_CLOCK_BYTE_IN = 0x24;
const MSB_RISING_EDGE_CLOCK_BYTE_IN = 0x20;
const MSB_FALLING_EDGE_CLOCK_BYTE_OUT = 0x11;
const MSB_DOWN_EDGE_CLOCK_BIT_IN = 0x26;
const MSB_UP_EDGE_CLOCK_BYTE_IN = 0x20;
const MSB_UP_EDGE_CLOCK_BYTE_OUT = 0x10;
const MSB_RISING_EDGE_CLOCK_BIT_IN = 0x22;
const MSB_FALLING_EDGE_CLOCK_BIT_OUT = 0x13

class I2C {
    #device = null
    #clock_divider = 0x00C8
    #addr = 0xFF
    #buf = []

    setStart() {
        // SDA 1 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_IN_SCL_IN)
        }
        // SDA 0 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_IN)
        }
        // SDA 0 SCL 0
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_OUT)
        }
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_IN_SCL_OUT)
        }
    }

    setStop() {
        // SDA 0 SCL 0
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_OUT)
        }
        // SDA 0 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_IN)
        }
        // SDA 1 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_IN_SCL_IN)
        }
    }
    async open(addr) {
        if (this.#device) {
            return false
        }
        this.#device = await FTDI.openDevice("A")
        if (!this.#device) {
            return false
        }
        this.#device.resetDevice()
        if (this.#device.status.rx_queue_bytes != 0) {
            await this.#device.read(this.#device.status.rx_queue_bytes)
        }
        this.#device.setLatencyTimer(16)
        this.#device.setUSBParameters(65535, 65535)
        this.#device.setTimeouts(1000, 1000)
        this.#device.setBitMode(0x00, FTDI.FT_BITMODE_RESET)
        this.#device.setBitMode(0x00, FTDI.FT_BITMODE_MPSSE)
        await this.#device.write(Uint8Array.from([0xAA]))
        while (this.#device.status.rx_queue_bytes == 0) {
        }
        const response = await this.#device.read(this.#device.status.rx_queue_bytes)
        if (response[0] != 0xFA || response[1] != 0xAA) {
            console.log("Нет синхранизации с MPPSE")
            this.close()
            return false
        }
        await this.#device.write(Uint8Array.from([0x8A, 0x97, 0x8C])) // spi 0x8D i2c 0x8C
        await this.#device.write(Uint8Array.from([0x80, 0x03, 0x13, 0x86, (this.#clock_divider & 0xFF), ((this.#clock_divider >> 8) & 0xFF)]))
        await this.#device.write(Uint8Array.from([0x85]))
        this.#addr = addr
        console.log("Синхранизации с MPPSE")
        return true
    }
    writeByte(val) {
        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_OUT_SCL_OUT)

        this.#buf.push(MSB_FALLING_EDGE_CLOCK_BYTE_OUT)
        this.#buf.push(0x00)
        this.#buf.push(0x00)
        this.#buf.push(val)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(MSB_RISING_EDGE_CLOCK_BIT_IN)
        this.#buf.push(0x00)

        this.#buf.push(0x87)
    }

    readByte(ask = false) {
        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(MSB_RISING_EDGE_CLOCK_BYTE_IN)
        this.#buf.push(0x00)
        this.#buf.push(0x00)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_OUT_SCL_OUT)

        this.#buf.push(MSB_FALLING_EDGE_CLOCK_BIT_OUT)
        this.#buf.push(0x00)
        this.#buf.push(ask ? 0x00 : 0xFF)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(0x87)
    }

    async readRegister(addr) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.setStart()
        this.writeByte((this.#addr << 1) | 1)
        this.readByte(false)
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        while (this.#device.status.rx_queue_bytes < 4) {
        }
        const result = await this.#device.read(this.#device.status.rx_queue_bytes)
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            console.log(result)
            console.log((result[0] & 1) != 0, (result[1] & 1) != 0, (result[2] & 1) != 0)
            return null
        }
        return result[3]
    }

    async writeRegister(addr, val) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.writeByte(val)
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        while (this.#device.status.rx_queue_bytes < 3) {
        }
        const result = await this.#device.read(this.#device.status.rx_queue_bytes)
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            console.log(result)
            return false
        }
        return true
    }

    async readFIFO(addr) {
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.setStart()
        this.writeByte((this.#addr << 1) | 1)
        this.readByte(true)
        this.readByte(true)
        this.readByte(true)
        this.readByte(true)
        this.readByte(true)
        this.readByte(true)
        this.readByte(false)
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        while (this.#device.status.rx_queue_bytes < 9) {
        }
        const result = await this.#device.read(this.#device.status.rx_queue_bytes)
        if (!result || (result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            console.log('error')
            return false
        }
        //console.log(result)
        console.log(result[3], result[4], result[5], result[6], result[7], result[8] , result[9])
    }
}

module.exports = I2C