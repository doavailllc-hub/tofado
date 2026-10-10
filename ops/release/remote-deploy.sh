#!/usr/bin/env bash
set -euo pipefail
release_id="${1:-}"
run_migrations="${2:-no}"
root=/opt/tofado
[[ "$release_id" =~ ^[a-f0-9]{12}$ ]] || { echo 'Invalid release ID.' >&2; exit 2; }
[[ "$run_migrations" == no || "$run_migrations" == yes ]] || { echo 'Migration flag must be yes or no.' >&2; exit 2; }
artifact="$root/incoming/tofado-$release_id.tar.gz"
checksum="$artifact.sha256"
release="$root/releases/$release_id"
test -f "$artifact" && test -f "$checksum" && test -f "$root/shared/server.env"
cd "$root/incoming"
sha256sum -c "$(basename "$checksum")"
if [[ ! -d "$release" ]]; then
  temporary="$root/releases/.$release_id.tmp"
  test ! -e "$temporary"
  mkdir -p "$temporary"
  tar -xzf "$artifact" -C "$temporary"
  mv "$temporary" "$release"
fi
grep -q "\"release_id\":\"$release_id\"" "$release/release.json"
ln -s "$root/shared/server.env" "$release/server/.env"
if [[ "$run_migrations" == yes ]]; then
  test -n "${MIGRATION_BACKUP_CONFIRMED:-}" || { echo 'A verified backup reference is required.' >&2; exit 3; }
  (cd "$release/server" && node scripts/migrate.js)
fi
(cd "$release/server" && node scripts/check-schema.js && node scripts/check-finance.js)
previous="$(readlink -f "$root/current" 2>/dev/null || true)"
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
if ! sudo systemctl restart tofado-api || ! curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:5000/api/ready?release=$release_id" >/dev/null; then
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "$root/current.next"
    mv -Tf "$root/current.next" "$root/current"
    sudo systemctl restart tofado-api || true
  fi
  echo 'Activation failed; previous code release restored. Database migrations are forward-only and were not reverted.' >&2
  exit 1
fi
printf '%s\n' "$previous" > "$root/shared/previous-release"
rm -f "$artifact" "$checksum"
find "$root/releases" -mindepth 1 -maxdepth 1 -type d -mtime +30 -print
echo "Activated release $release_id"
