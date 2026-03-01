#!/bin/bash
# ─── EngCard デプロイスクリプト ───────────────────────────
# 使い方: ターミナルで ./deploy.sh を実行するだけ

cd "$(dirname "$0")"

echo "📦 変更をまとめています..."
git add -A

# 変更があるか確認
if git diff --cached --quiet; then
  echo "✅ 変更はありません。最新の状態です。"
  exit 0
fi

echo ""
git diff --cached --stat
echo ""

# コミットメッセージ（日時を自動生成）
MSG="update: $(date '+%Y-%m-%d %H:%M')"
git commit -m "$MSG"

echo ""
echo "🚀 GitHubにアップロード中..."
git push origin main

echo ""
echo "✅ 完了！1〜2分後にGitHub Pagesに反映されます。"
