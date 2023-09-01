const FTDI = require('ftdi-d2xx')
const $ = require("jquery")
const I2C = require("ftdi-i2c")

const i2c = new I2C()
let x = 0
let run = false
let red_avr = 0
let red_n = 0
let red_sr = 0
let ir_avr = 0
let ir_sr = 0

setInterval(async () => {
    const canvas = document.getElementById("canvas")
    const ctx = document.getElementById("canvas").getContext("2d")
    if (i2c && run) {
        const rd = await i2c.readRegister(0x06)
        const wr = await i2c.readRegister(0x04)
        const count = (wr - rd) & 31
        if (count > 0) {
            const result = await i2c.readRegister(0x07, 6 * count)
            for(let i = 0; i < count; i++) {
                let red = (result[i*6] << 16) | (result[1 + i*6] << 8) | (result[2 + i*6] << 0)
                let ir = (result[3 + i*6] << 16) |(result[4 + i*6] << 8) | (result[5 + i*6] << 0)
                red_avr += red
                ir_avr += ir
                red_n++
                ctx.fillStyle = "#ff2626"
                ctx.beginPath()
                ctx.arc(x, (red - red_sr) / 50 + canvas.height / 2, 1, 0, Math.PI * 2, true)
                ctx.fill()
                ctx.fillStyle = "#26ff26"
                ctx.beginPath()
                ctx.arc(x, (ir - ir_sr) / 50 + canvas.height / 2, 1, 0, Math.PI * 2, true)
                ctx.fill()
                if (x++ > canvas.width) {
                    red_sr = red_avr / red_n
                    ir_sr = ir_avr / red_n
                    red_avr = 0
                    red_n = 0
                    ir_avr = 0
                    x = 0
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                }
            }
        }
    }  
}, 200)

function setByte(self) {
    const parent = $(self).parent("td").parent("tr")
    let byte = 0
    for (let i = 0; i < 8; i++) {
        byte |= ((parent.find("td:eq(" + (i + 1) + ")").find("input").val() || 0) << (7 - i))
    }
    parent.find("td:eq(10)").find("input").val(byte)
}

function setBit(self) {
    const parent = $(self).parent("td").parent("tr")
    const val = (parent.find("td:eq(10)").find("input").val() || 0x00)
    parent.find("td:eq(1)").find("input").val(((val & 1 << 7) != 0) ? 1 : 0)
    parent.find("td:eq(2)").find("input").val(((val & 1 << 6) != 0) ? 1 : 0)
    parent.find("td:eq(3)").find("input").val(((val & 1 << 5) != 0) ? 1 : 0)
    parent.find("td:eq(4)").find("input").val(((val & 1 << 4) != 0) ? 1 : 0)
    parent.find("td:eq(5)").find("input").val(((val & 1 << 3) != 0) ? 1 : 0)
    parent.find("td:eq(6)").find("input").val(((val & 1 << 2) != 0) ? 1 : 0)
    parent.find("td:eq(7)").find("input").val(((val & 1 << 1) != 0) ? 1 : 0)
    parent.find("td:eq(8)").find("input").val(((val & 1 << 0) != 0) ? 1 : 0)
}

$(document).ready(() => {
    $("#open").click(async function() {
        const is_open = $(this).html() == "OPEN"
        if (is_open) {
            if (await i2c.open(0x57)) {
                $(this).html("CLOSE")
            }
        } else {
            if (await i2c.close()) {
                $(this).html("OPEN")
            }
        }
        
    })
    $("#def").click(async () => {
        run = false
        $("#run").html("RUN")
        await i2c.writeRegister(0x02, 0xC0)
        await i2c.writeRegister(0x03, 0x00)
        await i2c.writeRegister(0x04, 0x00)
        await i2c.writeRegister(0x05, 0x00)
        await i2c.writeRegister(0x06, 0x00)
        await i2c.writeRegister(0x08, 0x1f)
        await i2c.writeRegister(0x09, 0x03)
        await i2c.writeRegister(0x0A, 0x27)
        await i2c.writeRegister(0x0C, 0x24)
        await i2c.writeRegister(0x0D, 0x24)
        await i2c.writeRegister(0x10, 0x7f)
    })
    $("#run").click(function() {
        if (run) {
            run = false
            $(this).html("RUN")
        } else {
            run = true
            $(this).html("STOP")
        }
    })
    $("button.rw").on("click", async function () {
        run = false
        $("#run").html("RUN")
        const parent = $(this).parent("td").parent("tr")
        const addr = parent.find("td:eq(9)").html().trim()
        const is_r = $(this).html().trim() == 'R'
        if (is_r) {
            const val = await i2c.readRegister(Number(addr))
            parent.find("td:eq(10)").find("input").val(val[0])
            setBit(this)
        } else {
            const val = Number(parent.find("td:eq(10)").find("input").val() || 0x00)
            await i2c.writeRegister(Number(addr), val)
        }
    })
    $("input.byte").on("change", function() {
        setBit(this)
    })
    $("input.byte").on("keyup", function(e) {
        setBit(this)
    })
    $("input.bit").on("change", function() {
        $(this).val($(this).val() == 1 ? 1 : 0)
        setByte(this)
    })
    $("input.bit").on("keyup", function(e) {
        if (e.keyCode != 8) {
            $(this).val($(this).val() == 1 ? 1 : 0)
            setByte(this)
        }
    })
})