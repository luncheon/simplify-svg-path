const fs = require('fs')
const path = require('path')
const esm = fs.readFileSync(path.resolve(__dirname, 'index.min.js'), 'utf8')
const iife = 'var simplifySvgPath=(function(){' + esm.replace('export default', 'return') + '})()'
fs.writeFileSync(path.resolve(__dirname, 'index.iife.min.js'), iife, 'utf8')
