import fs from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const esm = fs.readFileSync(resolve(__dirname, 'index.js'), 'utf8')
const iife = `var simplifySvgPath=(()=>{${esm.replace('export default', 'return')}})()`
fs.writeFileSync(resolve(__dirname, 'index.iife.js'), iife, 'utf8')
