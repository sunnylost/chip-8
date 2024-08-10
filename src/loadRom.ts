import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

export async function loadRom(name: string) {
    try {
        const romPath = resolve(import.meta.dirname, `../rom/${name}.rom`)
        const buffer = await readFile(romPath)
        console.log(buffer)
    } catch (e) {
        console.log(e)
    }
}
