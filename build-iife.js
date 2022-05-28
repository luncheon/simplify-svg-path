import fs from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const esm = fs.readFileSync(resolve(__dirname, 'index.min.js'), 'utf8')
const iife = 'var simplifySvgPath=(function(){' + esm.replace('export default', 'return') + '})()'
fs.writeFileSync(resolve(__dirname, 'index.iife.min.js'), iife, 'utf8')
console.log('index.iife.min.js', iife.length, 'bytes, gzip', gzipSync(iife, { level: 9 }).byteLength, 'bytes')
