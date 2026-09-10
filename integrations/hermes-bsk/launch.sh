#!/bin/sh
set -eu
exec /usr/sbin/runuser -u bsk-hermes -- /usr/bin/env -i \
  PATH=/usr/bin:/bin LANG=C.UTF-8 \
  /opt/bsk/hermes-mcp/.venv/bin/python /opt/bsk/hermes-mcp/server.py
