#!/usr/bin/env bash
# Deploys IMAGE:TAG to Dokploy and waits until the app serves TAG on /version.
# Dokploy marks a deploy done before traffic moves, and reports a Swarm rollback as done while
# keeping the broken image, so /version alone decides; on failure the previous image is pinned again.
# Usage: deploy.sh             deploy IMAGE:TAG, rolling back if it doesn't serve
#        deploy.sh rollback    pin PREVIOUS again (after a failed smoke test)
# Env: DOKPLOY_URL, DOKPLOY_API_KEY, APPLICATION_ID, APP_URL, IMAGE, TAG, and PREVIOUS for rollback
set -euo pipefail
# On an error, prints the status and Dokploy's message only: a successful answer can hold the app's env.
api() {
  local out code
  out=$(curl -sS -w '\n%{http_code}' -H "x-api-key: $DOKPLOY_API_KEY" -H 'Content-Type: application/json' "$DOKPLOY_URL/api/$1" "${@:2}")
  code=${out##*$'\n'}
  if [ "${code:0:1}" != 2 ]; then
    echo "::error::Dokploy $1 returned $code: $(jq -r '.message // .error // "no message"' <<<"${out%$'\n'*}" 2>/dev/null | head -c 300)" >&2
    return 1
  fi
  printf '%s' "${out%$'\n'*}"
}
pin() {
  api application.saveDockerProvider -d "$(jq -n --arg id "$APPLICATION_ID" --arg img "$1" \
    '{applicationId: $id, dockerImage: $img, username: null, password: null, registryUrl: null}')" > /dev/null
  api application.deploy -d "$(jq -n --arg id "$APPLICATION_ID" '{applicationId: $id}')" > /dev/null
}
# The live test saw the new tag after about 22 s; 5 minutes leaves room for a slow health check.
serves() {
  for _ in $(seq 1 60); do
    [ "$(curl -sf "$APP_URL/version" | jq -r .version 2>/dev/null)" = "$1" ] && return 0
    sleep 5
  done
  return 1
}

# What happened, for the failure issue: not-started, deployed, rolled-back or rollback-failed.
outcome() { echo "outcome=$1" >> "${GITHUB_OUTPUT:-/dev/null}"; }

if [ "${1:-}" = rollback ]; then
  if pin "$PREVIOUS" && serves "${PREVIOUS##*:}"; then outcome rolled-back; exit 0; fi
  echo "::error::$PREVIOUS is not serving either; production may be down."
  outcome rollback-failed
  exit 1
fi

outcome not-started
previous=$(api "application.one?applicationId=$APPLICATION_ID" | jq -er .dockerImage)
echo "previous image: $previous"
echo "previous=$previous" >> "${GITHUB_OUTPUT:-/dev/null}"
if pin "$IMAGE:$TAG" && serves "$TAG" && curl -sf "$APP_URL/" | grep -q '<h1>Assistant</h1>'; then
  echo "serving $TAG"
  outcome deployed
  exit 0
fi
echo "::error::$APP_URL did not serve $TAG with a working home page. Redeploying $previous."
if pin "$previous" && serves "${previous##*:}"; then
  echo "back on ${previous##*:}"
  outcome rolled-back
else
  echo "::error::$previous is not serving either; production may be down."
  outcome rollback-failed
fi
exit 1
