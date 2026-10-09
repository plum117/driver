const assert = require('node:assert')
const driver = require('../..')

console.log('Start CJS tests')
assert.equal(typeof driver.start, 'function')
assert.equal(typeof driver.stop, 'function')
assert.equal(driver.default.start, driver.start)
assert.equal(driver.DEFAULT_PORT, 4444)
console.log('CJS tests passed ✅')
