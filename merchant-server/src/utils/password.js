import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length > 1024) throw Object.assign(new Error('Invalid password'), { status: 400 });
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  try {
    const [salt, hex] = stored.split(':');
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
    return timingSafeEqual(await derive(password, salt, 64), Buffer.from(hex, 'hex'));
  } catch { return false; }
}
