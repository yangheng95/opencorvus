import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"

type SignatureInput = {
  token: string
  timestamp: string | null
  nonce: string | null
  encrypted: string | null | undefined
  signature: string | null
}

type EnvelopeInput = {
  encodingAesKey: string
  encrypted: string
  receiveId: string
}

type EncryptInput = {
  encodingAesKey: string
  receiveId: string
  message: string
  random?: Buffer
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function aesKey(encodingAesKey: string) {
  const value = encodingAesKey.trim()
  if (!/^[A-Za-z0-9+/]{43}$/.test(value)) throw new Error("EncodingAESKey must be 43 base64 characters")
  const key = Buffer.from(`${value}=`, "base64")
  if (key.length !== 32) throw new Error("EncodingAESKey must decode to 32 bytes")
  return key
}

function pkcs7Unpad(value: Buffer) {
  const padding = value.at(-1)
  if (!padding || padding < 1 || padding > 32 || padding > value.length) throw new Error("invalid callback padding")
  for (const byte of value.subarray(value.length - padding)) {
    if (byte !== padding) throw new Error("invalid callback padding")
  }
  return value.subarray(0, value.length - padding)
}

function pkcs7Pad(value: Buffer) {
  const remainder = value.length % 32
  const padding = remainder === 0 ? 32 : 32 - remainder
  return Buffer.concat([value, Buffer.alloc(padding, padding)])
}

export function callbackSignature(token: string, timestamp: string, nonce: string, encrypted: string) {
  return createHash("sha1").update([token, timestamp, nonce, encrypted].sort().join("")).digest("hex")
}

export function verifyCallbackSignature(input: SignatureInput) {
  if (!input.timestamp || !input.nonce || !input.encrypted || !input.signature) return false
  return safeEqual(callbackSignature(input.token, input.timestamp, input.nonce, input.encrypted), input.signature)
}

export function decryptCallbackEnvelope(input: EnvelopeInput) {
  const key = aesKey(input.encodingAesKey)
  const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16))
  decipher.setAutoPadding(false)
  const decrypted = pkcs7Unpad(Buffer.concat([decipher.update(input.encrypted, "base64"), decipher.final()]))
  if (decrypted.length < 20) throw new Error("callback envelope is too short")
  const length = decrypted.readUInt32BE(16)
  const messageStart = 20
  const messageEnd = messageStart + length
  if (messageEnd > decrypted.length) throw new Error("callback envelope length is invalid")
  const receiveId = decrypted.subarray(messageEnd).toString()
  if (receiveId !== input.receiveId) throw new Error("callback receive id mismatch")
  return decrypted.subarray(messageStart, messageEnd).toString()
}

export function encryptCallbackEnvelope(input: EncryptInput) {
  const key = aesKey(input.encodingAesKey)
  const message = Buffer.from(input.message)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(message.length)
  const plain = pkcs7Pad(
    Buffer.concat([input.random ?? randomBytes(16), length, message, Buffer.from(input.receiveId)]),
  )
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16))
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64")
}

export function encryptedXml(xml: string) {
  const cdata = xml.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/)?.[1]
  if (cdata) return cdata
  return xml.match(/<Encrypt>(.*?)<\/Encrypt>/)?.[1]
}
