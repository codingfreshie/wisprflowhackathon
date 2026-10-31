#!/usr/bin/env bash
# One-command demo: backend serves the pre-built dashboard on http://localhost:5000
set -e
cd "$(dirname "$0")/server"
[ -d node_modules ] || npm install
(sleep 3 && (command -v xdg-open >/dev/null && xdg-open http://localhost:5000 || command -v open >/dev/null && open http://localhost:5000 || true)) &
npm start
