import { campaignNameMatches } from './releaseMatch.ts'

const necesidad = [{ text: 'cual es la necesidad', mode: 'contains' }]
const dnd = [{ text: 'dnd', mode: 'token' }]

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const cases = [
  ['Yandel - Cuál es la necesidad (Follow On Views)', necesidad, true],
  ['YANDEL | F1 | Cuál es la necesidad | Alcance', necesidad, true],
  ['Yandel - Cuál es la necesidad (Follow On Views)', dnd, false],
  ['Yandel - DND (Multiformato)', dnd, true],
  ['YANDEL | DND | Alcance', dnd, true],
  ['DND', dnd, true],
  ['Yandel DND-V2', dnd, true],
  ['Yandel - DNDY (Views)', dnd, false],
  ['Yandel - La Necesidad', necesidad, false],
  ['Big Soto - Nostalgia City (All Content)', necesidad, false],
  ['Big Soto - Nostalgia City (All Content)', dnd, false],
]

for (const [name, patterns, expected] of cases) {
  const got = campaignNameMatches(name, patterns)
  assert(got === expected, `«${name}» esperado ${expected}, obtuvo ${got}`)
}

console.log(`releaseMatch: ${cases.length} casos ok`)
