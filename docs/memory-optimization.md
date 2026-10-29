# Runtime memory optimization — prepared locally

The live startup keeps `npm run start:prod` as PID 1, a shell, and the Node API as separate processes after migrations finish. A read-only process check showed approximately 60 MB RSS for npm and 128 MB RSS for the API. These RSS figures share pages and must not be added or treated as independent savings. The SSH diagnostic process also temporarily increases container usage.

Railway's queried ten-minute memory summary averaged approximately 118.6 MB. A stable below-100 MB result has not been demonstrated.

## Prepared change

Docker and Railway invoke `sh scripts/start-production.sh` directly. The script runs the existing `npm run prisma:deploy --workspace=server` command, aborts on any failure, then uses `exec node server/dist/index.js` to replace the shell. The migration npm processes finish before the API starts; no persistent npm launcher remains in production. The `start:prod` convenience script uses the same entrypoint, although manually invoking that convenience script through npm still creates an outer npm process.

No heap limit, cache policy, database operation, scheduler interval, reminder rule, API behavior, or frontend behavior is changed. This should reduce launcher overhead and make shutdown signals reach the API directly. Exact memory savings require Linux/Railway measurement after deployment.

## Validation

- All 72 current application tests pass.
- Shell syntax check passes.
- A launcher check confirmed migration-before-API ordering, API process replacement with the same PID, and failure preventing API startup.
- The real entrypoint ran migrations against an isolated local test SQLite database and served a healthy API on port 3002. The temporary server was stopped afterward.
- No production deployment, variable change, or production data write was made for this optimization.

Pending: explicit deployment approval, then compare normal-use Railway memory and health while retaining existing data and notification behavior.
