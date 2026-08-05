import {randomBytes,scryptSync,timingSafeEqual} from 'crypto';
export function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`}
export function verifyPassword(password,stored){try{const [salt,hex]=stored.split(':');const actual=scryptSync(password,salt,64);const expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}}
