// 收起态的停靠计算：小精灵缩成「探头」后贴在屏幕边上，
// 拖到哪边就吸到哪边（像悬浮球），停靠的那一边会被记住。

// 窗口中心落在工作区左半边就吸左，否则吸右。
export function nearestEdge(winX, winWidth, workArea) {
  const center = winX + winWidth / 2;
  return center < workArea.x + workArea.width / 2 ? 'left' : 'right';
}

// 贴住指定边，竖直位置保持不动但不许跑出工作区。
export function dockedBounds(side, size, y, workArea) {
  const maxY = workArea.y + workArea.height - size.h;
  return {
    x: side === 'left' ? workArea.x : workArea.x + workArea.width - size.w,
    y: Math.min(Math.max(y, workArea.y), Math.max(workArea.y, maxY)),
    width: size.w,
    height: size.h,
  };
}
