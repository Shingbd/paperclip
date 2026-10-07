#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Keep process config, Pi sessions, uploads and embedded PostgreSQL away from the host user's state.
export PAPERCLIP_HOME="${PERSONAL_DATA_DIR:-$PWD/.personal-runtime/state}"
export HOME="$PWD/.personal-runtime/home"
mkdir -p "$HOME" "$PAPERCLIP_HOME/instances/${PAPERCLIP_INSTANCE_ID:-default}"
# New isolated instance only: persist a random run-JWT signing secret, never print it.
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; import path from "node:path"; const p=path.join(process.env.PAPERCLIP_HOME,"instances",process.env.PAPERCLIP_INSTANCE_ID||"default",".env"); if(!fs.existsSync(p)) fs.writeFileSync(p,"PAPERCLIP_AGENT_JWT_SECRET="+crypto.randomBytes(32).toString("hex")+"\n",{mode:0o600,flag:"wx"});'
export HOST=127.0.0.1 PORT="${PERSONAL_PORT:-4310}"
export PAPERCLIP_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 PI_TELEMETRY=0 PI_SKIP_VERSION_CHECK=1
if [ -d "$PWD/.personal-tools/node_modules/.bin" ]; then export PATH="$PWD/.personal-tools/node_modules/.bin:$PATH"; fi
node -e 'if(Number(process.versions.node.split(".")[0])<24) throw new Error("Use pinned Node 24.14.0; see README.personal-workspace.md")'
# Current upstream dev:once always builds the optional Rust runner. Pi uses the
# legacy adapter; start the same server directly with built UI and SDK assets.
export PAPERCLIP_UI_DEV_MIDDLEWARE=false PAPERCLIP_MIGRATION_AUTO_APPLY=true PAPERCLIP_MIGRATION_PROMPT=never
exec pnpm --filter @paperclipai/server exec tsx src/index.ts
