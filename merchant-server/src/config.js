import 'dotenv/config';

export function validateConfig(env) {
  const production = env.NODE_ENV === 'production';
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /^(dev-secret|change|replace|your[-_])/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  }
  const origins = (env.CLIENT_URL || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
  if (production && (!env.CLIENT_URL || !env.DB_HOST || !env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME || env.DB_USER === 'root')) {
    throw new Error('Production requires CLIENT_URL and explicit DB_HOST, DB_NAME, non-root DB_USER and DB_PASSWORD.');
  }
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) {
      throw new Error('CLIENT_URL must contain exact origins (HTTPS in production), without paths or wildcards.');
    }
  }
  if (!origins.length) throw new Error('At least one CLIENT_URL origin is required.');
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  return { production, origins, port, jwtSecret: env.JWT_SECRET };
}
export const config = validateConfig(process.env);
