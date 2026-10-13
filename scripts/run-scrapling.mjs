import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const winVenv = resolve(root, 'collector_env', 'Scripts', 'python.exe')
const unixVenv = resolve(root, 'collector_env', 'bin', 'python')

let pythonCmd = 'python'
if (existsSync(winVenv)) {
  pythonCmd = winVenv
} else if (existsSync(unixVenv)) {
  pythonCmd = unixVenv
}

console.log(`[DO Scrapling Runner] Using Python runtime: ${pythonCmd}`)
const script = resolve(root, 'collector', 'harvest.py')

const child = spawn(pythonCmd, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exitCode = code ?? 0
})
