#!/usr/bin/env bash
set -euo pipefail

cd "${INCUDAL_COMPOSE_DIR:-.}"
exec 9>"${INCUDAL_UPDATE_LOCK:-/run/lock/incudal-auto-update.lock}"
flock -n 9 || exit 0

compose=(docker compose)
attempts=${INCUDAL_HEALTH_ATTEMPTS:-30}
interval=${INCUDAL_HEALTH_INTERVAL:-2}
[[ "$attempts" =~ ^[1-9][0-9]?$ && "$attempts" -le 60 && "$interval" =~ ^[0-9]$ ]] || {
  echo 'Invalid health check timing' >&2
  exit 1
}

container_id="$("${compose[@]}" ps -q app)"
[[ -n "$container_id" ]] || { echo 'App is not running; automatic update skipped' >&2; exit 1; }
old_image="$(docker inspect --format '{{.Image}}' "$container_id")"
image_ref="$("${compose[@]}" config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["app"]["image"])')"
"${compose[@]}" pull --quiet app
new_image="$(docker image inspect --format '{{.Id}}' "$image_ref")"
[[ "$old_image" != "$new_image" ]] || { echo 'App image is already current'; exit 0; }

failed_file=.incudal-auto-update.failed-image
previous_file=.incudal-auto-update.previous-image
if [[ -f "$failed_file" && "$(cat "$failed_file")" == "$new_image" ]]; then
  echo 'Skipping an image that previously failed its health check'
  exit 0
fi

healthy() {
  local id
  for ((index = 0; index < attempts; index++)); do
    id="$("${compose[@]}" ps -q app)"
    if [[ -n "$id" ]] && docker exec "$id" node -e \
      "fetch('http://127.0.0.1:3000/api/health', {signal: AbortSignal.timeout(3000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$interval"
  done
  return 1
}

previous_rollback=''
[[ ! -f "$previous_file" ]] || previous_rollback="$(cat "$previous_file")"
echo "Updating app: $old_image -> $new_image"
if "${compose[@]}" up -d --no-deps app && healthy; then
  printf '%s\n' "$old_image" > "$previous_file"
  rm -f "$failed_file"
  echo 'App update passed its health check'
  # Keep the immediately previous image for rollback; never force-remove images.
  if [[ "$previous_rollback" =~ ^sha256:[0-9a-f]{64}$ && "$previous_rollback" != "$old_image" && "$previous_rollback" != "$new_image" ]]; then
    source="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.source" }}' "$previous_rollback" 2>/dev/null || true)"
    if [[ "$source" == "https://github.com/shane654/incudal" ]]; then
      docker image rm "$previous_rollback" >/dev/null 2>&1 || true
    fi
  fi
else
  printf '%s\n' "$new_image" > "$failed_file"
  echo 'Update failed; restoring the previous app image' >&2
  if INCUDAL_IMAGE="$old_image" "${compose[@]}" up -d --no-deps app && healthy; then
    echo 'Previous app image restored and healthy' >&2
  else
    echo 'Previous app image could not be restored to a healthy state' >&2
  fi
  exit 1
fi
