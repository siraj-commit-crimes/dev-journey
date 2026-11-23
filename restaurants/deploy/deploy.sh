#!/usr/bin/env bash
# Publishes a restaurant site to Cloudflare as a Worker at https://<site>-demo.<your-subdomain>.workers.dev
#
#   ./restaurants/deploy/deploy.sh <blaze|station|foodbae>            plain site (e.g. after the client pays)
#   ./restaurants/deploy/deploy.sh <site> --demo                       pitch link: password, expiry, "Demo by" strip,
#                                                                      ordering off, scrambled code
# DRY_RUN=<file> builds the Worker into <file> without uploading (for testing).
# Demo options (env): DEMO_NAME (default Siraj), DEMO_NAME_AR, DEMO_DAYS (default 7),
#                     DEMO_PASSWORD (default: a new random one, printed once at the end).
# Needs a Cloudflare API token ("Edit Cloudflare Workers" template). In Claude Code cloud sessions it is
# saved as a network secret for api.cloudflare.com; elsewhere export CLOUDFLARE_API_TOKEN first.
set -euo pipefail
SITE="${1:?usage: deploy.sh blaze|station|foodbae [--demo]}"; MODE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$HERE/../$SITE"
[ -d "$SRC" ] || { echo "no such site: $SITE"; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/site"
(cd "$SRC" && tar cf - --exclude=tools --exclude=tests --exclude=.gitignore --exclude=functions .) | (cd "$TMP/site" && tar xf -)
EXTRA=$([ "$SITE" = blaze ] && echo --blaze || true)

if [ "$MODE" = "--demo" ]; then
  export DEMO_NAME="${DEMO_NAME:-Siraj}" DEMO_NAME_AR="${DEMO_NAME_AR:-سراج}"
  DAYS="${DEMO_DAYS:-7}"
  PASS="${DEMO_PASSWORD:-$(node -e 'const w=["mango","saffron","pepper","olive","sesame","lemon","cedar","sumac","thyme","honey","garlic","za3tar"];const r=n=>require("crypto").randomInt(n);console.log(w[r(12)]+"-"+w[r(12)]+"-"+(100+r(900)))')}"
  export DEMO_PASS_HASH="$(printf '%s' "$PASS" | sha256sum | cut -d' ' -f1)"
  export DEMO_EXPIRES="$(node -e "console.log(new Date(Date.now()+$DAYS*864e5).toISOString())")"
  export DEMO_SITE="$(node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log((s.match(/<title>([^<|·]+)/)||[,"Restaurant"])[1].trim())' "$TMP/site/index.html")"
  # scramble: minify + mangle the code (readable source stays in the repo)
  npx --yes esbuild@0.24.0 "$TMP/site/app.js" --minify --target=es2020 --charset=utf8 --legal-comments=none --outfile="$TMP/app.min.js" --log-level=warning
  npx --yes esbuild@0.24.0 "$TMP/site/styles.css" --minify --charset=utf8 --outfile="$TMP/styles.min.css" --log-level=warning
  mv "$TMP/app.min.js" "$TMP/site/app.js"; mv "$TMP/styles.min.css" "$TMP/site/styles.css"
  npx --yes esbuild@0.24.0 "$HERE/demo-layer.js" --minify --charset=utf8 --outfile="$TMP/site/__demo.js" --log-level=warning
  npx --yes esbuild@0.24.0 "$HERE/demo-layer.css" --minify --charset=utf8 --outfile="$TMP/site/__demo.css" --log-level=warning
  node -e '
    const fs=require("fs"),f=process.argv[1];let h=fs.readFileSync(f,"utf8");
    const cfg=JSON.stringify({name:process.env.DEMO_NAME,nameAr:process.env.DEMO_NAME_AR});
    h=h.replace(/<!--[\s\S]*?-->/g,"").replace("</head>",`<script>window.__DEMO__=${cfg}</script><script src="/__demo.js"></script><link rel="stylesheet" href="/__demo.css"></head>`);
    fs.writeFileSync(f,h);' "$TMP/site/index.html"
  EXTRA="$EXTRA --demo"
fi

node "$HERE/build-worker.js" "$TMP/site" "$TMP/worker.js" $EXTRA
if [ -n "${DRY_RUN:-}" ]; then cp "$TMP/worker.js" "$DRY_RUN"; echo "dry run: built $DRY_RUN"; [ "$MODE" = "--demo" ] && echo "password: $PASS"; exit 0; fi
AUTH=(); [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
API=https://api.cloudflare.com/client/v4
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }
ACCT="${CLOUDFLARE_ACCOUNT_ID:-$(curl -sS "${AUTH[@]}" $API/accounts | json 'j.success ? j.result[0].id : "ERROR " + JSON.stringify(j.errors)')}"
case "$ACCT" in ERROR*) echo "Cloudflare refused the token: $ACCT"; exit 1;; esac
echo '{"main_module":"worker.js","compatibility_date":"2026-01-01"}' > "$TMP/meta.json"
curl -sS -X PUT "${AUTH[@]}" "$API/accounts/$ACCT/workers/scripts/$SITE-demo" \
  -F "metadata=@$TMP/meta.json;type=application/json" \
  -F "worker.js=@$TMP/worker.js;type=application/javascript+module;filename=worker.js" | json '(j.success ? "uploaded" : "FAILED") + " " + JSON.stringify(j.errors || [])'
curl -sS -X POST "${AUTH[@]}" "$API/accounts/$ACCT/workers/scripts/$SITE-demo/subdomain" -H 'content-type: application/json' -d '{"enabled":true,"previews_enabled":false}' >/dev/null
SUB="$(curl -sS "${AUTH[@]}" $API/accounts/$ACCT/workers/subdomain | json 'j.result.subdomain')"
echo "live: https://$SITE-demo.$SUB.workers.dev/"
if [ "$MODE" = "--demo" ]; then echo "password: $PASS"; echo "expires: $DEMO_EXPIRES"; fi
