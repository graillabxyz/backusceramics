import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto"
import { promisify } from "util"

const scrypt = promisify(scryptCallback)

const POS_PIN_PATTERN = /^\d{6}$/
const POS_PIN_HASH_PREFIX = "scrypt:v1"
const POS_PIN_KEY_BYTES = 32
const POS_PIN_SALT_BYTES = 16

export const POS_PIN_LOCK_SECONDS = 5 * 60

export function isValidPosPin(pin: unknown): pin is string {
  return typeof pin === "string" && POS_PIN_PATTERN.test(pin)
}

export async function hashPosPin(pin: string) {
  if (!isValidPosPin(pin)) {
    throw new Error("POS PIN must be exactly 6 digits")
  }

  const salt = randomBytes(POS_PIN_SALT_BYTES).toString("hex")
  const key = (await scrypt(pin, salt, POS_PIN_KEY_BYTES)) as Buffer

  return `${POS_PIN_HASH_PREFIX}:${salt}:${key.toString("hex")}`
}

export async function verifyPosPin(pin: string, storedHash?: string | null) {
  if (!isValidPosPin(pin) || !storedHash) return false

  const [scheme, version, salt, keyHex] = storedHash.split(":")
  if (`${scheme}:${version}` !== POS_PIN_HASH_PREFIX || !salt || !keyHex) return false

  const expectedKey = Buffer.from(keyHex, "hex")
  const actualKey = (await scrypt(pin, salt, expectedKey.length)) as Buffer

  if (actualKey.length !== expectedKey.length) return false

  return timingSafeEqual(actualKey, expectedKey)
}
