const FTDI = require('ftdi-d2xx')
const $ = require("jquery")
/*
Памятка
0х11 запись байта MSB_FALLING_EDGE_CLOCK_BYTE_OUT
0х13 запись бита
0x24 чтение байта
0x22 MSB_RISING_EDGE_CLOCK_BIT_IN
*/

let device = null
let buf = []

async function getData() {
    const buf = []
    for (let loop = 0; loop < 5; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x00)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x0b)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }

    buf.push(0x11)
    buf.push(0x00)
    buf.push(0x00)
    buf.push(0x80 | ((0x37 << 1) & 0x7E))
    buf.push(0x24)
    buf.push(0x00)
    buf.push(0x00)

    for (let loop = 0; loop < 5; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x08)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x0b)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }

    await device.write(Uint8Array.from(buf))
    let response = await device.read(1)
    console.log(response)
}

function HighSpeedSetI2CStart() {
    for (let loop = 0; loop < 4; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x03)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x13)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }
    for (let loop = 0; loop < 4; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x01)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x13)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }
    buf.push(0x80)   // команда GPIO для ADBUS
    buf.push(0x00)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
    buf.push(0x13)   
}

function HighSpeedSetI2CStop() {
    for (let loop = 0; loop < 4; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x01)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x13)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }
    for (let loop = 0; loop < 4; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x03)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x13)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }
    buf.push(0x80)   // команда GPIO для ADBUS
    buf.push(0x00)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
    buf.push(0x10) 
}

async function SendByteAndCheckACK(val) {
    buf.push(0x11)
    buf.push(0x00)
    buf.push(0x00)
    buf.push(val)
    buf.push(0x80)
    buf.push(0x00)
    buf.push(0x11)
    buf.push(0x22)
    buf.push(0x00)
    buf.push(0x87)
    await device.write(Uint8Array.from(buf))
    buf = []
    let response = await device.read(1)
    if (!response || (response[0] & 0x01) != 0x00) {
        return false
    }
    buf.push(0x80)
    buf.push(0x02)
    buf.push(0x13)
}

async function SendByteAndCheckNOACK() {
    buf.push(0x80)
    buf.push(0x00)
    buf.push(0x11)
    buf.push(0x24) //MSB_FALLING_EDGE_CLOCK_BYTE_IN
    buf.push(0x00)
    buf.push(0x00)
    buf.push(0x22)
    buf.push(0x00)
    buf.push(0x87)
    await device.write(Uint8Array.from(buf))
    buf = []
    let response = await device.read(2)
    
    console.log(response[0]>>1)
    buf.push(0x80)   // команда GPIO для ADBUS
    buf.push(0x02)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
    buf.push(0x13) 
}

async function testI2C() {
    //addr 0x68 0x69
    //0x75
    buf = []
    HighSpeedSetI2CStart()
    await SendByteAndCheckACK((0x68 << 1) | 0)
    await SendByteAndCheckACK(0x75)
    HighSpeedSetI2CStart()
    await SendByteAndCheckACK((0x68 << 1) | 1)
    await SendByteAndCheckNOACK()
    HighSpeedSetI2CStop()
    await device.write(Uint8Array.from(buf))
}

$(document).ready(() => {
    $("#init").click(async () => {
        device = await FTDI.openDevice("A")
        device.resetDevice()
        device.setTimeouts(1000, 1000)
        device.setBitMode(0x00, 0x00)
        device.setBitMode(0x00, 0x02)
        await device.write(Uint8Array.from([0xAA]))
        for (let i = 0; i < 200; i++) {

        }
        let response = await device.read(2)
        if (!response || response[0] != 0xFA) {
            $("#info").html("Ошибка перехода в MPPSE")
            device.close()
            return
        }
        const div = 0x0095
        await device.write(Uint8Array.from([0x8A, 0x97, 0x8C])) // spi 0x8D i2c 0x8C 
        await device.write(Uint8Array.from([0x80, 0x03, 0x13, 0x86, div & 0xFF, (div >> 8) & 0xFF]))
        await device.write(Uint8Array.from([0x85]))
        $("#info").html("Перешли в MPPSE")
    })
    $("#close").click(() => {
        if (device) {
            device.close()
            $("#info").html("Зарыли соеденение")
        }
    })
    $("#test").click(() => {
        if (device) {
            getData()
        }
    })
    $("#testi2c").click(() => {
        if (device) {
            testI2C()
        }
    })

    $( "button" ).on( "click", function() {
        const parent = $(this).parent("td").parent("tr")
        const addr = parent.find("td:eq(9)").html().trim()
        const r = $(this).html().trim() == 'R'
        console.log(addr, r)
    })
})