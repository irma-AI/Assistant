#!/usr/bin/env bash
# Runs deploy.sh against a fake curl that plays Dokploy and the app, so the accept and rollback paths run offline.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
fail=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The fake curl: Dokploy calls record the pinned image; /version serves its tag; / serves $tmp/page with $tmp/status.
mkdir "$tmp/bin"
cat > "$tmp/bin/curl" <<'EOF'
#!/usr/bin/env bash
url= data= code=
for a in "$@"; do case $a in http*) url=$a ;; esac; done
while [ $# -gt 0 ]; do case $1 in -d) data=$2; shift ;; -w) code=1 ;; esac; shift; done
reply() { printf '%s' "$1"; [ -n "$code" ] && printf '\n200'; return 0; }
case $url in
  */api/application.one*) reply "{\"dockerImage\":\"$(cat "$STATE/pinned")\"}" ;;
  */api/application.saveDockerProvider) jq -r .dockerImage <<<"$data" > "$STATE/pinned"; reply '{}' ;;
  */api/application.deploy) reply '{}' ;;
  */version) r=$(cat "$STATE/pinned"); r=${r%@*}; echo "{\"version\":\"${r##*:}\"}" ;;
  */) [ "$(cat "$STATE/status")" = 200 ] || exit 22; cat "$STATE/page" ;;
esac
EOF
chmod +x "$tmp/bin/curl"

# expect NAME STATUS PAGE WANT: deploys new over old while / answers STATUS with PAGE; WANT is the image left pinned.
expect() {
  echo "img:old@sha256:a" > "$tmp/pinned"
  echo "$2" > "$tmp/status"
  printf '%s' "$3" > "$tmp/page"
  GITHUB_OUTPUT= PATH="$tmp/bin:$PATH" STATE=$tmp DOKPLOY_URL=https://dokploy.test DOKPLOY_API_KEY=k APPLICATION_ID=a \
    APP_URL=https://app.test IMAGE=img TAG=new DIGEST=sha256:b bash "$here/deploy.sh" > /dev/null 2>&1 || true
  got=$(cat "$tmp/pinned")
  if [ "$got" = "$4" ]; then echo "ok    $1"; else echo "FAIL  $1: pinned $got, want $4"; fail=1; fi
}

page='<!DOCTYPE html><html lang="sv"><head></head><body><main><h1>Redo</h1></main></body></html>'
expect "a page with a new heading is accepted" 200 "$page" "img:new@sha256:b"
expect "a page that fails to render rolls back" 500 "" "img:old@sha256:a"
expect "a cut-off page rolls back" 200 "<!DOCTYPE html><html><body><main>" "img:old@sha256:a"
exit $fail
