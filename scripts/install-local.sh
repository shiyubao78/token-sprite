#!/usr/bin/env bash
# 本地安装 / 更新桌宠：退出旧的 → 覆盖安装 → 重新打开 → 核对。
# 目的：杜绝"装完忘了重开，桌宠凭空消失、用户/自己都找不到"。
# 数据在 ~/Library/Application Support/token-sprite（独立于 .app），覆盖安装不受影响。
set -e
cd "$(dirname "$0")/.."
[ "$(uname)" = "Darwin" ] || { echo "❌ 这个脚本只支持 macOS。Windows 用 npm run pack:win，Linux 用 npm run pack:linux"; exit 1; }
APP_SRC="release/mac-universal/Token小精灵.app"
APP_DST="/Applications/Token小精灵.app"
[ -d "$APP_SRC" ] || { echo "❌ 没找到构建产物 $APP_SRC，先跑 npm run pack"; exit 1; }
OLD_PID=$(pgrep -f "Token小精灵.app/Contents/MacOS" | head -1 || true)
echo "· 退出旧版…"; osascript -e 'quit app "Token小精灵"' 2>/dev/null || true; sleep 1
# 卡死的 app 收不到 quit 指令，会导致"装了但旧版还在跑"，必须强制收尾
if pgrep -f "Token小精灵.app/Contents/MacOS" >/dev/null; then
  echo "  （没响应，强制退出）"; pkill -f "Token小精灵.app/Contents/MacOS" 2>/dev/null || true; sleep 1
fi
echo "· 覆盖安装…"; ditto "$APP_SRC" "$APP_DST"
echo "· 重新打开…"; open "$APP_DST"; sleep 2
VER=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$APP_DST/Contents/Info.plist")
NEW_PID=$(pgrep -f "Token小精灵.app/Contents/MacOS" | head -1 || true)
if [ -z "$NEW_PID" ]; then
  echo "⚠️ v$VER 已安装，但没检测到进程，请手动打开一次"
elif [ -n "$OLD_PID" ] && [ "$NEW_PID" = "$OLD_PID" ]; then
  # 进程号没变=旧实例没退，新装的代码其实没跑起来（以前这里会误报成功）
  echo "❌ 旧进程($OLD_PID)没退出，新版没生效。手动执行：pkill -f 'Token小精灵.app/Contents/MacOS' 然后重开"
  exit 1
else
  echo "✅ 已安装并重新打开 v$VER（pid $NEW_PID）—— 桌宠在桌面右下角"
fi
