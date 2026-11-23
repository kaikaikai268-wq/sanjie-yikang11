#!/usr/bin/env bash
# 雲端 Claude session（claude.ai/code）啟動時由 .claude/settings.json 的 SessionStart hook 呼叫。
# 本機不做事。裝好依賴，讓 pnpm verify / pnpm seo 直接能跑。
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
command -v pnpm >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || npm install -g pnpm@10.32.1 >/dev/null 2>&1
pnpm install --frozen-lockfile >/dev/null 2>&1 && echo "依賴已安裝（pnpm verify、pnpm seo 可用）" || echo "pnpm install 失敗，請手動執行 pnpm install"
[ -n "$GOOGLE_SA_KEY_JSON" ] || echo "未設 GOOGLE_SA_KEY_JSON：pnpm seo 無法查 GSC/GA，設定方式見 CLAUDE.md「流量資料」"
exit 0
