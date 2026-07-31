#!/bin/sh
set -eu

: "${PAPERLESS_URL:=}"

escaped=$(printf '%s' "$PAPERLESS_URL" | sed 's/[\\"]/\\&/g')

cat <<EOF > /usr/share/nginx/html/config.js
window.__PAPERLESS_INSIGHTS_CONFIG__ = {
  defaultUrl: "$escaped",
}
EOF
