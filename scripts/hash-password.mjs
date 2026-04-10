import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 10)
console.log('Hash:', hash)
console.log('\nAdd to AUTH_USERS env var:')
console.log(JSON.stringify([{ email: 'your@email.com', passwordHash: hash }]))
