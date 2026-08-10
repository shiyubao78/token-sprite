#!/usr/bin/env bash
# 本地安装 / 更新桌宠：退出旧的 → 覆盖安装 → 重新打开 → 核对。
# 目的：杜绝"装完忘了重开，桌宠凭空消失、用户/自己都找不到"。
# 数据在 ~/Library/Application Support/token-sprite（独立于 .app），覆盖安装不受影响。
set -e
cd "$(dirname "$0")/.."
APP_SRC="release/mac-universal/Token小精灵.app"
APP_DST="/Applications/Token小精灵.app"
[ -d "$APP_SRC" ] || { echo "❌ 没找到构建产物 $APP_SRC，先跑 npm run pack:mac:release"; exit 1; }
echo "· 退出旧版…"; osascript -e 'quit app "Token小精灵"' 2>/dev/null || true; sleep 1
echo "· 覆盖安装…"; ditto "$APP_SRC" "$APP_DST"
echo "· 重新打开…"; open "$APP_DST"; sleep 2
VER=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$APP_DST/Contents/Info.plist")
if pgrep -f "Token小精灵.app/Contents/MacOS" >/dev/null; then
  echo "✅ 已安装并重新打开 v$VER —— 桌宠在桌面右下角"
else
  echo "⚠️ v$VER 已安装，但没检测到进程，请手动打开一次"
fi
