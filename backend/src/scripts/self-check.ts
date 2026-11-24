import 'dotenv/config'
import assert from 'node:assert/strict'
import { parseEmailList } from '../utils/email'
import { hourWindowKey, msUntilNextUtcHour, overflowDelayMs } from '../utils/scheduleMath'

const parsed = parseEmailList('ada@example.com, Ada@Example.com\nmargaret@example.com\nnot-an-email')
assert.deepEqual(parsed, ['ada@example.com', 'margaret@example.com'])

const onTheHour = Date.UTC(2026, 10, 24, 15, 0, 0, 0)
assert.equal(msUntilNextUtcHour(onTheHour), 60 * 60 * 1000)

const tenPast = Date.UTC(2026, 10, 24, 15, 10, 0, 0)
assert.equal(msUntilNextUtcHour(tenPast), 50 * 60 * 1000)
assert.equal(overflowDelayMs(1, 2000, tenPast), 50 * 60 * 1000)
assert.equal(overflowDelayMs(3, 2000, tenPast), 50 * 60 * 1000 + 4000)
assert.equal(hourWindowKey(new Date(tenPast)), '2026112415')

console.log('self-check passed')
