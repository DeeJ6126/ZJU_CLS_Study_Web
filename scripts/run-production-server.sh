#!/bin/sh
set -eu

env_file="${ZJUBIO_ENV_FILE:-/etc/zjubio/zjubio.env}"
if [ ! -r "$env_file" ]; then
  echo "zjubio environment file is not readable: $env_file" >&2
  exit 1
fi

set -a
. "$env_file"
set +a

exec /opt/zjubio/node/bin/node /var/www/html/zjubio/server/server.js
