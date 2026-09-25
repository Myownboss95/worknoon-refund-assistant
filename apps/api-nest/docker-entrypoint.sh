#!/bin/sh
# Apply migrations, seed an empty database (idempotent), then start the API.
set -eu

node_modules/.bin/prisma migrate deploy
node dist/prisma/seed-cli.js
exec node dist/src/main.js
