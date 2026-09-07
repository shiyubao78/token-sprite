export function rectsIntersect(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function isVisibleOnAnyDisplay(bounds, workAreas) {
  return workAreas.some((area) => rectsIntersect(bounds, area));
}

export function bottomRightBounds(workArea, size, margin = 24) {
  return {
    x: workArea.x + workArea.width - size.width - margin,
    y: workArea.y + workArea.height - size.height - margin,
    width: size.width,
    height: size.height,
  };
}

export function clampBoundsToWorkArea(bounds, workArea) {
  const maxX = workArea.x + workArea.width - bounds.width;
  const maxY = workArea.y + workArea.height - bounds.height;
  return {
    ...bounds,
    x: bounds.width >= workArea.width
      ? workArea.x
      : Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: bounds.height >= workArea.height
      ? workArea.y
      : Math.min(Math.max(bounds.y, workArea.y), maxY),
  };
}

// 启动时用哪个位置：优先上次退出的地方，但必须还落在某块屏幕上。
// 不记住位置的话，多显示器用户每次重启桌宠都会跑到「当前鼠标那块屏」的右下角，
// 于是反复出现「我的精灵不见了」。
export function pickInitialBounds(saved, fallback, workAreas, size) {
  const x = saved && Number(saved.x), y = saved && Number(saved.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  const candidate = { x, y, width: size.width, height: size.height };
  return isVisibleOnAnyDisplay(candidate, workAreas) ? candidate : fallback;
}
