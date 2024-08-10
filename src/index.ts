function randomNum() {
    const max = 255
    return Math.floor(Math.random() * (max + 1))
}

function hexToChar(num: number) {
    return num < 10 ? `${num}` : String.fromCharCode('a'.charCodeAt(0) + num - 10)
}

const FONTSET_START_ADDRESS = 0x50
const VIDEO_WIDTH = 64
const VIDEO_HEIGHT = 32

const Instructions = {
    '00E0'(cpu: CPU) {
        // clear the display
        cpu.screen.init()
    },
    '00EE'(cpu: CPU) {
        // return from a subroutine
        cpu.SP--
        cpu.PC = cpu.stack[cpu.SP]
    },
    // 1nnn - JP addr
    '1'(cpu: CPU, opcode: number) {
        // jump to location nnn
        cpu.PC = opcode & 0x0fff
    },
    // 2nnn - CALL addr
    '2'(cpu: CPU, opcode: number) {
        // Call subroutine at nnn
        cpu.stack[cpu.SP++] = cpu.PC
        cpu.PC = opcode & 0x0fff
    },
    // 3xkk - SE Vx, byte
    '3'(cpu: CPU, opcode: number) {
        // Skip next instruction if Vx = kk.
        const vx = (opcode & 0x0f00) >> 8
        const kk = opcode & 0x00ff

        if (cpu.registers[vx] === kk) {
            cpu.PC += 2
        }
    },
    // 4xkk - SNE Vx, byte
    '4'(cpu: CPU, opcode: number) {
        // Skip next instruction if Vx != kk.
        const vx = (opcode & 0x0f00) >> 8
        const kk = opcode & 0x00ff

        if (cpu.registers[vx] !== kk) {
            cpu.PC += 2
        }
    },
    // 5xy0 - SE Vx, Vy
    '5'(cpu: CPU, opcode: number) {
        // Skip next instruction if Vx = Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        if (cpu.registers[vx] === cpu.registers[vy]) {
            cpu.PC += 2
        }
    },
    // 6xkk - LD Vx, byte
    '6'({ registers }: CPU, opcode: number) {
        // Set Vx = kk.
        const vx = (opcode & 0x0f00) >> 8
        registers[vx] = opcode & 0x00ff
    },
    // 7xkk - ADD Vx, byte
    '7'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx + kk.
        const vx = (opcode & 0x0f00) >> 8
        registers[vx] += opcode & 0x00ff
    },
    // 9xy0 - SNE Vx, Vy
    '9'(cpu: CPU, opcode: number) {
        // Skip next instruction if Vx != Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        if (cpu.registers[vx] !== cpu.registers[vy]) {
            cpu.PC += 2
        }
    },
    // Annn - LD I, addr
    a(cpu: CPU, opcode: number) {
        // Set I = nnn.
        cpu.I = opcode & 0x0fff
    },
    // Bnnn - JP V0, addr
    b(cpu: CPU, opcode: number) {
        // Jump to location nnn + V0.
        cpu.PC += cpu.registers[0] + (opcode & 0x0fff)
    },
    // Cxkk - RND Vx, byte
    c(cpu: CPU, opcode: number) {
        // Set Vx = random byte AND kk.
        const vx = (opcode & 0x0f00) >> 8

        cpu.registers[vx] = randomNum() & (opcode & 0x00ff)
    },
    // Dxyn - DRW Vx, Vy, nibble
    d(cpu: CPU, opcode: number) {
        // Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4
        const height = opcode & 0x000f
        const xPos = cpu.registers[vx] % VIDEO_WIDTH
        const yPos = cpu.registers[vy] % VIDEO_HEIGHT

        cpu.registers[0xf] = 0

        for (let row = 0; row < height; row++) {
            const spriteByte = cpu.RAM[cpu.I + row]

            for (let col = 0; col < 8; col++) {
                const spritePixel = spriteByte & (0x80 >> col)
                const screenPixel = cpu.screen.screen[yPos + row][xPos + col]

                if (spritePixel) {
                    if (screenPixel.classList.contains('on')) {
                        cpu.registers[0xf] = 1
                    }
                    cpu.screen.update(yPos + row, xPos + col, 1)
                }
            }
        }
    },
    // 8xy0 - LD Vx, Vy
    '80'({ registers }: CPU, opcode: number) {
        // Set Vx = Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[vx] = registers[vy]
    },
    // 8xy1 - OR Vx, Vy
    '81'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx OR Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[vx] |= registers[vy]
    },
    // 8xy2 - AND Vx, Vy
    '82'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx AND Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[vx] &= registers[vy]
    },
    // 8xy3 - XOR Vx, Vy
    '83'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx XOR Vy.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[vx] ^= registers[vy]
    },
    // 8xy4 - ADD Vx, Vy
    '84'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx + Vy, set VF = carry.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4
        const sum = registers[vx] + registers[vy]

        registers[0xf] = sum > 255 ? 1 : 0
        registers[vx] = sum & 0xff
    },
    // 8xy5 - SUB Vx, Vy
    '85'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx - Vy, set VF = NOT borrow.
        // If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[0xf] = registers[vx] > registers[vy] ? 1 : 0
        registers[vx] -= registers[vy]
    },
    // 8xy6 - SHR Vx
    '86'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx SHR 1.
        // If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
        const vx = (opcode & 0x0f00) >> 8

        registers[0xf] = registers[vx] & 0x1
        registers[vx] >>= 1
    },
    // 8xy7 - SUBN Vx, Vy
    '87'({ registers }: CPU, opcode: number) {
        // Set Vx = Vy - Vx, set VF = NOT borrow.
        // If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
        const vx = (opcode & 0x0f00) >> 8
        const vy = (opcode & 0x00f0) >> 4

        registers[0xf] = registers[vy] > registers[vx] ? 1 : 0
        registers[vx] = registers[vy]
    },
    // 8xyE - SHL Vx {, Vy}
    '8e'({ registers }: CPU, opcode: number) {
        // Set Vx = Vx SHL 1.
        // If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2.
        const vx = (opcode & 0x0f00) >> 8

        registers[0xf] = (registers[vx] & 0x80) >> 7
        registers[vx] <<= 1
    },
    // ExA1 - SKNP Vx
    ea1(cpu: CPU, opcode: number) {
        // Skip next instruction if key with the value of Vx is not pressed.
        const vx = (opcode & 0x0f00) >> 8

        if (!cpu.key[cpu.registers[vx]]) {
            cpu.PC += 2
        }
    },
    // Ex9E - SKP Vx
    e9e(cpu: CPU, opcode: number) {
        // Skip next instruction if key with the value of Vx is pressed.
        const vx = (opcode & 0x0f00) >> 8

        if (cpu.key[cpu.registers[vx]]) {
            cpu.PC += 2
        }
    },
    // Fx07 - LD Vx, DT
    f07(cpu: CPU, opcode: number) {
        // Set Vx = delay timer value.
        const vx = (opcode & 0x0f00) >> 8

        cpu.registers[vx] = cpu.delay
    },
    // Fx0A - LD Vx, K
    f0a(cpu: CPU, opcode: number) {
        // Wait for a key press, store the value of the key in Vx.
        const vx = (opcode & 0x0f00) >> 8

        for (let i = 0; i < cpu.key.length; i++) {
            if (cpu.key[i]) {
                cpu.registers[vx] = i
                return
            }
        }

        cpu.PC -= 2
    },
    // Fx15 - LD DT, Vx
    f15(cpu: CPU, opcode: number) {
        // Set delay timer = Vx.
        const vx = (opcode & 0x0f00) >> 8

        cpu.delay = cpu.registers[vx]
    },
    // Fx18 - LD ST, Vx
    f18(cpu: CPU, opcode: number) {
        // Set sound timer = Vx.
        const vx = (opcode & 0x0f00) >> 8

        cpu.sound = cpu.registers[vx]
    },
    // Fx1E - ADD I, Vx
    f1e(cpu: CPU, opcode: number) {
        // Set I = I + Vx.
        const vx = (opcode & 0x0f00) >> 8

        cpu.I += cpu.registers[vx]
    },
    // Fx29 - LD F, Vx
    f29(cpu: CPU, opcode: number) {
        // Set I = location of sprite for digit Vx.
        const vx = (opcode & 0x0f00) >> 8

        cpu.I = FONTSET_START_ADDRESS + 5 * cpu.registers[vx]
    },
    // Fx33 - LD B, Vx
    f33(cpu: CPU, opcode: number) {
        // Store BCD representation of Vx in memory locations I, I+1, and I+2.
        // The interpreter takes the decimal value of Vx, and places the hundreds digit in memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.
        const vx = (opcode & 0x0f00) >> 8
        let value = cpu.registers[vx]

        cpu.RAM[cpu.I + 2] = value % 10
        value /= 10

        cpu.RAM[cpu.I + 1] = value % 10
        value /= 10

        cpu.RAM[cpu.I] = value % 10
    },
    // Fx55 - LD [I], Vx
    f55(cpu: CPU, opcode: number) {
        // Store registers V0 through Vx in memory starting at location I.
        const vx = (opcode & 0x0f00) >> 8

        for (let i = 0; i < vx; i++) {
            cpu.RAM[cpu.I + i] = cpu.registers[i]
        }
    },
    // Fx65 - LD Vx, [I]
    f65(cpu: CPU, opcode: number) {
        // Read registers V0 through Vx from memory starting at location I.
        const vx = (opcode & 0x0f00) >> 8

        for (let i = 0; i < vx; i++) {
            cpu.registers[i] = cpu.RAM[cpu.I + i]
        }
    }
}

function splitNumber(num: number) {
    return [num >> 12, (num >> 8) & 0x0f, (num >> 4) & 0x00f, num & 0x000f]
}

export class CPU {
    PC: number
    RAM: Uint8Array
    I: number
    registers: Uint8Array
    stack: Uint16Array
    delay: number
    sound: number
    SP: number
    font: number[]
    key: number[]
    screen: Screen

    constructor() {
        this.reset()
    }

    async loadRom(name: string) {
        const result = await fetch(`/rom/${name}.rom`)
        const buffer = await result.arrayBuffer()
        const data = new DataView(buffer)
        const PC = this.PC

        for (let i = 0; i < data.byteLength; i++) {
            this.RAM[PC + i] = data.getUint8(i)
        }
    }

    cycle() {
        // fetch
        const opcode = (this.RAM[this.PC] << 8) | this.RAM[this.PC + 1]
        this.PC += 2
        // decode & execute
        this.handleInstructions(opcode)

        if (this.delay > 0) {
            this.delay--
        }

        if (this.sound > 0) {
            this.sound--
        }
    }

    handleInstructions(opcode: number) {
        const [n1, n2, n3, n4] = splitNumber(opcode)
        if (n1 !== 0) {
            if (n1 === 8) {
                Instructions[`${hexToChar(n1)}${hexToChar(n4)}`](this, opcode)
            } else if (n1 < 0xe) {
                Instructions[hexToChar(n1)](this, opcode)
            } else {
                Instructions[`${hexToChar(n1)}${hexToChar(n3)}${hexToChar(n4)}`](this, opcode)
            }
        } else {
            Instructions[n4 === 0 ? '00E0' : '00EE'](this)
        }
    }

    reset() {
        this.screen = new Screen('screen')
        this.RAM = new Uint8Array(4096)
        this.PC = 0x200
        this.I = 0
        this.registers = new Uint8Array(16)
        this.stack = new Uint16Array(16)
        this.SP = -1
        this.delay = 0
        this.sound = 0
        this.key = Array(16).fill(0)
        this.font = [
            0xf0,
            0x90,
            0x90,
            0x90,
            0xf0, // 0
            0x20,
            0x60,
            0x20,
            0x20,
            0x70, // 1
            0xf0,
            0x10,
            0xf0,
            0x80,
            0xf0, // 2
            0xf0,
            0x10,
            0xf0,
            0x10,
            0xf0, // 3
            0x90,
            0x90,
            0xf0,
            0x10,
            0x10, // 4
            0xf0,
            0x80,
            0xf0,
            0x10,
            0xf0, // 5
            0xf0,
            0x80,
            0xf0,
            0x90,
            0xf0, // 6
            0xf0,
            0x10,
            0x20,
            0x40,
            0x40, // 7
            0xf0,
            0x90,
            0xf0,
            0x90,
            0xf0, // 8
            0xf0,
            0x90,
            0xf0,
            0x10,
            0xf0, // 9
            0xf0,
            0x90,
            0xf0,
            0x90,
            0x90, // A
            0xe0,
            0x90,
            0xe0,
            0x90,
            0xe0, // B
            0xf0,
            0x80,
            0x80,
            0x80,
            0xf0, // C
            0xe0,
            0x90,
            0x90,
            0x90,
            0xe0, // D
            0xf0,
            0x80,
            0xf0,
            0x80,
            0xf0, // E
            0xf0,
            0x80,
            0xf0,
            0x80,
            0x80 // F
        ]

        for (let i = 0; i < this.font.length; i++) {
            this.RAM[FONTSET_START_ADDRESS + i] = this.font[i]
        }
    }
}

export class Screen {
    screen: HTMLElement[][]
    el: HTMLElement

    constructor(id: string) {
        this.el = document.getElementById(id)
        this.init()
    }

    init() {
        this.el.innerHTML = ''
        const ROW = VIDEO_HEIGHT
        const COL = VIDEO_WIDTH
        const screen = []

        for (let i = 0; i < ROW; i++) {
            const col = []
            const rowDiv = document.createElement('div')
            rowDiv.className = `row row-${i}`
            this.el.appendChild(rowDiv)

            for (let j = 0; j < COL; j++) {
                const pixel = document.createElement('div')
                pixel.className = `col-${i} pixel`
                rowDiv.appendChild(pixel)
                col.push(pixel)
            }
            screen.push(col)
        }

        this.screen = screen
    }

    update(x: number, y: number, value: number) {
        const pixelEl = this.screen[x][y]

        pixelEl.classList.add(value ? 'on' : 'off')
    }
}

function sleep() {
    return new Promise((resolve) => setTimeout(resolve, 60))
}

async function run() {
    const cpu = new CPU()
    await cpu.loadRom('test_opcode')

    while (true) {
        cpu.cycle()
        await sleep()
    }
}

run()
