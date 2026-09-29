import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbiddenNames = /(?:^|\/)(?:\.env(?:\..+)?|.*\.(?:pem|key|p12|pfx|jks|keystore|zip|apk|aab))$/i;
const allowedExamples = /\.env\.example$/i;
const privateMarkers = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/;
const violations = [];
for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (forbiddenNames.test(normalized) && !allowedExamples.test(normalized)) violations.push(`${file}: forbidden credential/archive path`);
  const stat = fs.statSync(file);
  if (stat.size > 2_000_000) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (privateMarkers.test(content)) violations.push(`${file}: private credential marker`);
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log(`Secret candidate check passed for ${files.length} tracked files.`);
