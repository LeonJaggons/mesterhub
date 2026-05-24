import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const root = process.cwd()

function read(path) {
  const absolute = join(root, path)
  assert.ok(existsSync(absolute), `${path} should exist`)
  return readFileSync(absolute, 'utf8')
}

const requiredRoutes = [
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'app/pro/help/page.tsx',
  'app/pro/settings/page.tsx',
  'app/pro/verification/page.tsx',
  'app/pro/earnings/page.tsx',
  'app/admin/pros/page.tsx',
]

for (const route of requiredRoutes) {
  read(route)
}

const serviceRoute = read('app/api/service-requests/[requestId]/route.ts')
for (const action of [
  'quote',
  'accept',
  'send-message',
  'request-appointment',
  'confirm-appointment',
  'mark-complete',
  'confirm-complete',
  'cancel',
]) {
  assert.ok(serviceRoute.includes(`'${action}'`), `service request API should support ${action}`)
}

assert.ok(serviceRoute.includes('sendLifecycleEmail'), 'service request API should send lifecycle email events')
assert.ok(read('app/api/admin/pros/[uid]/route.ts').includes('requireAdmin'), 'admin pro mutations should require admin access')
assert.ok(read('firestore.rules').includes('function isAdmin()'), 'Firestore rules should define admin access')
assert.ok(read('storage.rules').includes('activePro(proId)'), 'Storage rules should allow public active pro assets')
assert.ok(read('firebase/serviceRequests.ts').includes("'cancelled'"), 'client request status should include cancelled')

console.log('MVP smoke checks passed')
