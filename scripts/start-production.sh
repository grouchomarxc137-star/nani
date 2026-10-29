#!/bin/sh
# Keep migration ordering, then replace this shell with the API. Railway and
# Docker invoke this directly so no idle npm process stays in the container.
set -eu
cd "$(dirname "$0")/.."
npm run prisma:deploy --workspace=server
exec node server/dist/index.js
