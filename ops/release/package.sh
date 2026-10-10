#!/usr/bin/env bash
set -euo pipefail
release_id="${1:-}"
[[ "$release_id" =~ ^[a-f0-9]{12}$ ]] || { echo 'Release ID must be a 12-character commit SHA.' >&2; exit 2; }
root="$(cd "$(dirname "$0")/../.." && pwd)"
stage="$root/.release/stage"
rm -rf "$stage"
mkdir -p "$stage/server" "$stage/merchant" "$stage/landing"
cp -R "$root/merchant-server/src" "$root/merchant-server/scripts" "$root/merchant-server/migrations" "$root/merchant-server/node_modules" "$stage/server/"
cp "$root/merchant-server/package.json" "$root/merchant-server/package-lock.json" "$stage/server/"
cp -R "$root/merchant-client/dist/." "$stage/merchant/"
cp -R "$root/landing/dist/." "$stage/landing/"
printf '{"release_id":"%s","commit":"%s","built_at":"%s"}\n' "$release_id" "${GITHUB_SHA:-$release_id}" "$(date -u +%FT%TZ)" > "$stage/release.json"
cp "$stage/release.json" "$stage/server/release.json"
artifact="$root/.release/tofado-$release_id.tar.gz"
tar -C "$stage" -czf "$artifact" .
(cd "$(dirname "$artifact")" && sha256sum "$(basename "$artifact")" > "$(basename "$artifact").sha256")
rm -rf "$stage"
