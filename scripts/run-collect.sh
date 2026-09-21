#!/bin/zsh
# Ciclo horario: colecta datos, rebuilds site, deploy directo a Netlify prod.
# Ejecutado por LaunchAgent com.familukis.atalaya.collect cada 1h.

set -eo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/familukis/bin:/Users/familukis/.local/bin:$PATH"

cd /Users/familukis/atalaya

LOG_DIR="/Users/familukis/atalaya/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/collect-$(date +%Y%m%d).log"

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') COLLECT ====="
  npm run collect
  echo "----- build -----"
  npm run build
  echo "----- deploy -----"
  npx netlify deploy --prod --dir=dist --message="ciclo $(date '+%Y-%m-%d %H:%M')"
  echo "----- git -----"
  git add src/data/latest.json src/data/history/ src/data/meta.json 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git -c user.email=carlos.plasmalia@gmail.com -c user.name="atalaya-bot" commit -m "ciclo $(date '+%Y-%m-%d %H:%M')"
    git push origin main
  fi
  echo "===== done $(date '+%H:%M:%S') ====="
} >> "$LOG" 2>&1
