const targets = [
  ['api health', `${String(process.env.API_URL || '').replace(/\/$/, '')}/api/health`, 'json'],
  ['api readiness', `${String(process.env.API_URL || '').replace(/\/$/, '')}/api/ready`, 'json'],
  ['merchant web', process.env.MERCHANT_URL, 'html'],
  ['public web', process.env.PUBLIC_URL, 'html'],
];
for (const [name, url, kind] of targets) {
  if (!/^https:\/\//.test(url || '')) throw new Error(`${name} URL is missing or is not HTTPS.`);
  const started = Date.now();
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}.`);
  if (kind === 'json' && !(await response.json()).ok) throw new Error(`${name} returned an unhealthy payload.`);
  if (kind === 'html' && !/<div id="root"><\/div>/.test(await response.text())) throw new Error(`${name} did not return the application shell.`);
  console.log(`${name}: ok (${Date.now() - started}ms)`);
}
