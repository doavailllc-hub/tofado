#!/usr/bin/env bash
set -euo pipefail
root=/opt/tofado
previous="$(cat "$root/shared/previous-release" 2>/dev/null || true)"
current="$(readlink -f "$root/current" 2>/dev/null || true)"
[[ -n "$previous" && -d "$previous" && "$previous" == "$root"/releases/* ]] || { echo 'No valid previous release.' >&2; exit 2; }
ln -sfn "$previous" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
sudo systemctl restart tofado-api
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:5000/api/ready >/dev/null
printf '%s\n' "$current" > "$root/shared/previous-release"
echo "Rolled back to $(basename "$previous")"
