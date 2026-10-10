const targets = [
  ['api readiness', `${String(process.env.API_URL || '').replace(/\/$/, '')}/api/ready`],
  ['merchant web', process.env.MERCHANT_URL],
  ['public web', process.env.PUBLIC_URL],
];
for (const [name, url] of targets) {
  if (!url || !/^https:\/\//.test(url)) throw new Error(`${name} URL must be configured as HTTPS.`);
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}.`);
  if (name === 'api readiness') {
    const data = await response.json();
    if (!data.ok || data.release !== process.env.RELEASE_ID) throw new Error('API release identity does not match the deployed artifact.');
  } else {
    const body = await response.text();
    if (!/<div id="root"><\/div>/.test(body)) throw new Error(`${name} did not return the application shell.`);
  }
  console.log(`${name}: ok`);
}
