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
