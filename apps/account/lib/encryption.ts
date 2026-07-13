import crypto from 'crypto'

// Derive a fixed 32-byte key from the env secret so any-length secret is valid
// for aes-256-cbc. Same derivation on encrypt + decrypt keeps output stable.
function key(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) throw new Error('Missing CREDENTIALS_ENCRYPTION_KEY')
  return crypto.createHash('sha256').update(raw).digest()
}

// AES-256-CBC. Output format: "<iv hex>:<ciphertext hex>".
export function encryptCredentials(data: object): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptCredentials(encrypted: string): unknown {
  const [ivHex, dataHex] = encrypted.split(':')
  if (!ivHex || !dataHex) throw new Error('Malformed encrypted payload')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key(), iv)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
