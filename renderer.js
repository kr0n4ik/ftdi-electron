const FTDI = require('ftdi-d2xx')
const $ = require("jquery")
/*
Памятка
0х11 запись байта MSB_FALLING_EDGE_CLOCK_BYTE_OUT
0х13 запись бита
0x24 чтение байта
0x22 MSB_RISING_EDGE_CLOCK_BIT_IN
*/

const registers = [
    {
        "title": "Mode configuration",
        "addr": 0x09,
        "set": 0x00,
        "write": true
    }
]

class I2C {
    #device = null
    #clock_divider = 0x00C8
    #addr = 0xFF
    #buf = []
    constructor() {

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
            return false
        }
        await this.#device.write(Uint8Array.from([0x8A, 0x97, 0x8C])) // spi 0x8D i2c 0x8C
        await this.#device.write(Uint8Array.from([0x80, 0x03, 0x13, 0x86, (this.#clock_divider & 0xFF), ((this.#clock_divider >> 8) & 0xFF)]))
        await this.#device.write(Uint8Array.from([0x85]))
        this.#addr = addr
        console.log("Синхранизации с MPPSE")
        return true
    }

    close() {
        if (this.#device) {
            this.#device.close()
        }
    }

    async writeRegister(addr, val) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.start()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.writeByte(val)
        this.stop()
        await this.#device.write(Uint8Array.from(this.#buf))
        while (this.#device.status.rx_queue_bytes < 3) {
        }
        const result = await this.#device.read(this.#device.status.rx_queue_bytes)
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            return false
        }
        return true
    }

    async readRegister(addr) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.start()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.start()
        this.writeByte((this.#addr << 1) | 1)
        this.readByte()
        this.stop()
        await this.#device.write(Uint8Array.from(this.#buf))
        while (this.#device.status.rx_queue_bytes < 5) {
        }
        const result = await this.#device.read(this.#device.status.rx_queue_bytes)
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0 || (result[3] & 1) != 1) {
            return null
        }
        return result[3] >> 1
    }

    async readFIFO(addr, count = 1) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.start()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.start()
        this.writeByte((this.#addr << 1) | 1)
        for (let i = 0; i < count; i++) {
            this.readByte()  
        }
        this.stop()
        await this.#device.write(Uint8Array.from(this.#buf))
        const result = await this.#device.read(63)
        console.log(result)
    }

    async writeByte(val) {
        this.#buf.push(0x11)
        this.#buf.push(0x00)
        this.#buf.push(0x00)
        this.#buf.push(val)
        this.#buf.push(0x80)
        this.#buf.push(0x00)
        this.#buf.push(0x11)
        this.#buf.push(0x22)
        this.#buf.push(0x00)
        this.#buf.push(0x87)
        this.#buf.push(0x80)
        this.#buf.push(0x02)
        this.#buf.push(0x13)
    }

    async readByte() {
        this.#buf.push(0x80)
        this.#buf.push(0x00)
        this.#buf.push(0x11)
        this.#buf.push(0x24)
        this.#buf.push(0x00)
        this.#buf.push(0x00)
        this.#buf.push(0x22)
        this.#buf.push(0x00)
        this.#buf.push(0x87)
        this.#buf.push(0x80)
        this.#buf.push(0x02)
        this.#buf.push(0x13)
    }

    start() {
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x03)
            this.#buf.push(0x13)
        }
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x01)
            this.#buf.push(0x13)
        }
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x00)
            this.#buf.push(0x13)
        }
    }

    stop() {
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x00)
            this.#buf.push(0x13)
        }
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x01)
            this.#buf.push(0x13)
        }
        for (let loop = 0; loop < 4; loop++) {
            this.#buf.push(0x80)
            this.#buf.push(0x03)
            this.#buf.push(0x13)
        }
    }
}

const i2c = new I2C()

async function testI2C() {
    console.log(await i2c.readRegister(0xFE))
    console.log(await i2c.readRegister(0xFF))
}




$(document).ready(() => {
    $("#init").click(async () => {
        if (i2c.open(0x57)) {
            $("#info").html("Перешли в MPPSE")
        }
    })
    $("#close").click(() => {
        if (i2c) {
            i2c.close()
            $("#info").html("Зарыли соеденение")
        }
    })
    $("#test").click(() => {
        i2c.readFIFO(0x07, 30)
    })
    $("#testi2c").click(() => {
        testI2C()
    })
    $("button.rw").on("click", async function () {
        const parent = $(this).parent("td").parent("tr")
        const addr = parent.find("td:eq(9)").html().trim()
        const r = $(this).html().trim() == 'R'
        if (r) {
            const val = await i2c.readRegister(Number(addr))
            parent.find("td:eq(1)").find("input").val(((val & 1 << 7) != 0) ? 1 : 0)
            parent.find("td:eq(2)").find("input").val(((val & 1 << 6) != 0) ? 1 : 0)
            parent.find("td:eq(3)").find("input").val(((val & 1 << 5) != 0) ? 1 : 0)
            parent.find("td:eq(4)").find("input").val(((val & 1 << 4) != 0) ? 1 : 0)
            parent.find("td:eq(5)").find("input").val(((val & 1 << 3) != 0) ? 1 : 0)
            parent.find("td:eq(6)").find("input").val(((val & 1 << 2) != 0) ? 1 : 0)
            parent.find("td:eq(7)").find("input").val(((val & 1 << 1) != 0) ? 1 : 0)
            parent.find("td:eq(8)").find("input").val(((val & 1 << 0) != 0) ? 1 : 0)
            parent.find("td:eq(10)").find("input").val(val)
        } else {
            let val = Number(parent.find("td:eq(10)").find("input").val() || 0x00)
            console.log(val)
            await i2c.writeRegister(Number(addr), val)
        }
    })
})