#!/bin/zsh
# Meta-review cada 4h con Claude. Regenera meta.json, rebuild, deploy.
# Ejecutado por LaunchAgent com.familukis.atalaya.review.

set -eo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/familukis/bin:/Users/familukis/.local/bin:$PATH"

cd /Users/familukis/atalaya

LOG_DIR="/Users/familukis/atalaya/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/review-$(date +%Y%m%d).log"

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') META-REVIEW ====="
  npm run review
  echo "----- build -----"
  npm run build
  echo "----- deploy -----"
  npx netlify deploy --prod --dir=dist --message="review $(date '+%Y-%m-%d %H:%M')"
  echo "----- git -----"
  git add src/data/meta.json 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git -c user.email=carlos.plasmalia@gmail.com -c user.name="atalaya-bot" commit -m "meta-review $(date '+%Y-%m-%d %H:%M')"
    git push origin main
  fi
  echo "===== done $(date '+%H:%M:%S') ====="
} >> "$LOG" 2>&1
