#!/usr/bin/env bash
# Publishes a restaurant demo to Cloudflare as a Worker at https://<site>-demo.<your-subdomain>.workers.dev
#   ./restaurants/deploy/deploy.sh blaze|station|foodbae
# Needs a Cloudflare API token ("Edit Cloudflare Workers" template). In Claude Code cloud sessions it is
# saved as a network secret for api.cloudflare.com; elsewhere export CLOUDFLARE_API_TOKEN first.
# Each site's files are packed into one Worker (no build step); Blaze also gets its /api/menu live-menu proxy.
set -euo pipefail
SITE="${1:?usage: deploy.sh blaze|station|foodbae}"
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$HERE/../$SITE"
[ -d "$SRC" ] || { echo "no such site: $SITE"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
(cd "$SRC" && tar cf - --exclude=tools --exclude=tests --exclude=.gitignore --exclude=functions .) | (cd "$TMP" && mkdir site && cd site && tar xf -)
node "$HERE/build-worker.js" "$TMP/site" "$TMP/worker.js" $([ "$SITE" = blaze ] && echo --blaze)
AUTH=(); [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
API=https://api.cloudflare.com/client/v4
ACCT="${CLOUDFLARE_ACCOUNT_ID:-$(curl -sS "${AUTH[@]}" $API/accounts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).result[0].id))')}"
echo '{"main_module":"worker.js","compatibility_date":"2026-01-01"}' > "$TMP/meta.json"
curl -sS -X PUT "${AUTH[@]}" "$API/accounts/$ACCT/workers/scripts/$SITE-demo" \
  -F "metadata=@$TMP/meta.json;type=application/json" \
  -F "worker.js=@$TMP/worker.js;type=application/javascript+module;filename=worker.js" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.success?"uploaded":"FAILED",JSON.stringify(j.errors||[]))})'
curl -sS -X POST "${AUTH[@]}" "$API/accounts/$ACCT/workers/scripts/$SITE-demo/subdomain" -H 'content-type: application/json' -d '{"enabled":true,"previews_enabled":false}' >/dev/null
SUB="$(curl -sS "${AUTH[@]}" $API/accounts/$ACCT/workers/subdomain | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).result.subdomain))')"
echo "live: https://$SITE-demo.$SUB.workers.dev/"
