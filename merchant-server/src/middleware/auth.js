import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
export async function auth(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'Authentication required' });
  let payload;
  try {
    payload = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'] });
    if (!payload || !Number.isSafeInteger(Number(payload.id)) || Number(payload.id) <= 0) throw new Error('Invalid subject');
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
  try {
    const [[user]] = await pool.query('SELECT id, role, status, verification_status FROM users WHERE id=? LIMIT 1', [payload.id]);
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'This account is no longer approved' });
    req.user = user;
    next();
  } catch (error) { next(error); }
}
export const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ message: 'Access denied' });
  if (req.user.role === 'wholesaler' && req.user.verification_status !== 'verified') {
    return res.status(403).json({ code: 'VERIFICATION_REQUIRED', message: 'Your business must be verified before using this feature.' });
  }
  next();
};
export const allowOnboarding = (req, res, next) => req.user?.role === 'wholesaler'
  ? next() : res.status(403).json({ message: 'Access denied' });
