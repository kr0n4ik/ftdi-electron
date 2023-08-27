const FTDI = require('ftdi-d2xx')
const $ = require("jquery")

let device = null

async function getData() {
    const buf = []
    for (let loop = 0; loop < 5; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x08)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x0b)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }

    for (let loop = 0; loop < 5; loop++) {
        buf.push(0x80)   // команда GPIO для ADBUS
        buf.push(0x00)   // перевод CS в лог. 1, MOSI и SCLK в лог. 0
        buf.push(0x0b)   // bit3:CS, bit2:MISO, bit1:MOSI, bit0:SCLK
    }

    await device.write(Uint8Array.from(buf))
}

$(document).ready(() => {
    $("#init").click(async () => {
        device = await FTDI.openDevice("A")
        device.setTimeouts(1000, 1000)
        device.setBitMode(0x00, 0x02)
        await device.write(Uint8Array.from([0xAA]))
        let response = await device.read(2)
        if (!response || response[0] != 0xFA) {
            $("#info").html("Ошибка перехода в MPPSE")
            device.close()
            return
        }
        await device.write(Uint8Array.from([0x8A, 0x97, 0x8D]))
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
})