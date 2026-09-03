import { useMemo } from "react";

/**
 * Shared hook for map canvas coordinate conversion.
 * Extracts the meter <-> pixel conversion logic from LiveMap for reuse in MapEditor.
 *
 * @param {Object} params
 * @param {number} params.canvasWidth - Canvas width in pixels
 * @param {number} params.canvasHeight - Canvas height in pixels
 * @param {Object} params.mapConfig - Map configuration with width/height in meters
 * @param {number} params.padding - Padding around map in pixels (default: 30)
 * @returns {Object} Coordinate conversion utilities
 */
export function useMapCanvas({
  canvasWidth,
  canvasHeight,
  mapConfig,
  padding = 30,
}) {
  const mapWidth = mapConfig?.map?.width ?? 0;
  const mapHeight = mapConfig?.map?.height ?? 0;

  const { scale, offsetX, offsetY, renderWidth, renderHeight } = useMemo(() => {
    if (!mapWidth || !mapHeight || !canvasWidth || !canvasHeight) {
      return {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        renderWidth: 0,
        renderHeight: 0,
      };
    }

    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;
    const scale = Math.max(
      0.1,
      Math.min(
        availableWidth / Math.max(mapWidth, 1),
        availableHeight / Math.max(mapHeight, 1),
      ),
    );
    const renderWidth = mapWidth * scale;
    const renderHeight = mapHeight * scale;
    const offsetX = (canvasWidth - renderWidth) / 2;
    const offsetY = (canvasHeight - renderHeight) / 2;

    return { scale, offsetX, offsetY, renderWidth, renderHeight };
  }, [canvasWidth, canvasHeight, mapWidth, mapHeight, padding]);

  /**
   * Convert map coordinates (meters) to canvas coordinates (pixels).
   * Map origin (0,0) is bottom-left; canvas origin (0,0) is top-left.
   */
  const toCanvas = (x, y) => {
    const drawX = offsetX + x * scale;
    const drawY = canvasHeight - offsetY - y * scale;
    return [drawX, drawY];
  };

  /**
   * Convert canvas coordinates (pixels) to map coordinates (meters).
   * Inverse of toCanvas().
   */
  const toMap = (canvasX, canvasY) => {
    const mapX = (canvasX - offsetX) / scale;
    const mapY = (canvasHeight - offsetY - canvasY) / scale;
    return [mapX, mapY];
  };

  /**
   * Check if a point in canvas coordinates is within the map bounds.
   */
  const isInsideMap = (canvasX, canvasY, tolerance = 0) => {
    return (
      canvasX >= offsetX - tolerance &&
      canvasX <= offsetX + renderWidth + tolerance &&
      canvasY >= offsetY - tolerance &&
      canvasY <= offsetY + renderHeight + tolerance
    );
  };

  /**
   * Clamp map coordinates to map bounds.
   */
  const clampToMap = (x, y) => {
    return [
      Math.max(0, Math.min(mapWidth, x)),
      Math.max(0, Math.min(mapHeight, y)),
    ];
  };

  return {
    // Canvas parameters
    scale,
    offsetX,
    offsetY,
    renderWidth,
    renderHeight,
    mapWidth,
    mapHeight,
    canvasWidth,
    canvasHeight,
    padding,

    // Conversion functions
    toCanvas,
    toMap,
    isInsideMap,
    clampToMap,
  };
}

/**
 * Draw map background, grid, and entities on a canvas context.
 * Shared rendering logic between LiveMap and MapEditor.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} params - Rendering parameters
 * @param {Object} params.mapConfig - Map configuration
 * @param {number} params.canvasWidth - Canvas width
 * @param {number} params.canvasHeight - Canvas height
 * @param {Object} params.coords - Result from useMapCanvas
 * @param {string} params.backgroundColor - Background color (default: from colorPalette)
 * @param {string} params.gridColor - Grid line color
 * @param {number} params.gridLines - Number of grid lines (default: 10)
 * @param {HTMLImageElement|string} params.backgroundImage - Optional background image (data URL or Image element)
 */
export function drawMapBase(
  ctx,
  {
    mapConfig,
    canvasWidth,
    canvasHeight,
    coords,
    backgroundColor = "#020617",
    gridColor = "rgba(148, 163, 184, 0.18)",
    gridLines = 10,
    backgroundImage = null,
  },
) {
  const { offsetX, offsetY, renderWidth, renderHeight } = coords;

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Map area background
  if (!backgroundImage) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(offsetX - 1, offsetY - 1, renderWidth + 2, renderHeight + 2);

    // Only fill with background color if no background image
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(offsetX, offsetY, renderWidth, renderHeight);
  }

  // Draw background image if provided
  if (backgroundImage) {
    ctx.save();
    // Clip to map area
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, renderWidth, renderHeight);
    ctx.clip();

    const img =
      backgroundImage &&
      typeof backgroundImage === "object" &&
      ("complete" in backgroundImage ||
        "naturalWidth" in backgroundImage ||
        "src" in backgroundImage)
        ? backgroundImage
        : null;
    const imgSrc = typeof backgroundImage === "string" ? backgroundImage : null;

    if (
      img &&
      (img.complete === undefined || img.complete) &&
      img.naturalWidth > 0
    ) {
      // Image already loaded
      ctx.globalAlpha = 0.6; // Semi-transparent overlay
      ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
      ctx.globalAlpha = 1.0;
    } else if (imgSrc) {
      // Load image from data URL
      const tempImg = new Image();
      tempImg.onload = () => {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(tempImg, offsetX, offsetY, renderWidth, renderHeight);
        ctx.globalAlpha = 1.0;
      };
      tempImg.src = imgSrc;
      // Draw immediately if we can (might not work on first render)
      if (tempImg.complete && tempImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(tempImg, offsetX, offsetY, renderWidth, renderHeight);
        ctx.globalAlpha = 1.0;
      }
    }
    ctx.restore();
  }

  // Grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridLines; i++) {
    const factor = i / gridLines;
    const x = offsetX + renderWidth * factor;
    const y = offsetY + renderHeight * factor;

    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + renderHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + renderWidth, y);
    ctx.stroke();
  }

  // Map border
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX, offsetY, renderWidth, renderHeight);

  // Entities (polylines)
  const entities = mapConfig?.map?.entities || [];
  entities.forEach((entity) => {
    if (!entity || !Array.isArray(entity.points) || entity.points.length === 0)
      return;

    const strokeColor = entity.strokeColor || entity.color || "#94A3B8";
    const fillColor = entity.fillColor || null;
    const lineWidth = entity.lineWidth || 1;

    if (
      entity.type === "line" ||
      entity.type === "polyline" ||
      entity.type === "wall"
    ) {
      const [firstPoint, ...rest] = entity.points;
      if (!firstPoint || firstPoint.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      const [startX, startY] = coords.toCanvas(firstPoint[0], firstPoint[1]);
      ctx.moveTo(startX, startY);

      rest.forEach((point) => {
        if (!point || point.length < 2) return;
        const [x, y] = coords.toCanvas(point[0], point[1]);
        ctx.lineTo(x, y);
      });

      if (entity.type === "polyline" && entity.closed) {
        ctx.closePath();
      }
      if (fillColor && entity.type === "polyline" && entity.closed) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.stroke();
    }
  });
}

/** Draw a rounded-rectangle path (used for label pills). */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a beacon's broadcast "signal" arcs (Wi-Fi style) above its bulb. */
function drawSignalArcs(ctx, x, y, time, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i += 1) {
    const r = 5 + i * 3.6;
    const flick = 0.55 + 0.45 * Math.sin(time / 280 + i * 0.9);
    ctx.globalAlpha = 0.28 + 0.72 * flick;
    if (i === 1) ctx.globalAlpha *= 0.72; // stagger the middle wave
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI * 0.86, -Math.PI * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw beacons on canvas as little signal-emitting towers.
 *
 * Each beacon is drawn as a glowing amber bulb on a short pedestal, with an
 * expanding pulse ring and fluttering Wi-Fi style signal arcs, so it reads as a
 * radio beacon rather than a flat dot.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} beacons - Array of beacon objects with x, y, displayName
 * @param {Object} coords - Result from useMapCanvas
 * @param {Object} options - Rendering options
 * @param {string} options.selectedBeaconUuid - UUID of beacon being placed/dragged (highlighted)
 * @param {Function} options.getLabel - Function to get label text (default: displayName)
 * @param {number} options.time - Animation timestamp (ms), for pulse effects
 */
export function drawBeacons(ctx, beacons, coords, options = {}) {
  const {
    selectedBeaconUuid,
    getLabel = (b) => b.displayName || b.uuid || "Beacon",
    time = 0,
  } = options;

  beacons.forEach((beacon) => {
    if (beacon.x == null || beacon.y == null) return;

    const [cx, cy] = coords.toCanvas(beacon.x, beacon.y);
    const isSelected = selectedBeaconUuid && beacon.uuid === selectedBeaconUuid;
    const color = isSelected ? "#FCD34D" : "#F59E0B";
    const dark = isSelected ? "#D97706" : "#B45309";

    // Expanding pulse ring (fades out as it grows)
    const phase = (time / 1400) % 1;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 * (1 - phase)})`;
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, 14 + phase * 15, 0, Math.PI * 2);
    ctx.stroke();

    // Soft ambient glow
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 17);
    glow.addColorStop(0, `rgba(245, 158, 11, 0.55)`);
    glow.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();

    // Broadcast signal arcs (animate)
    drawSignalArcs(ctx, cx, cy - 7, time, color);

    // Pedestal base + stem (so it reads as a tower, not a plain dot)
    ctx.fillStyle = "#334155";
    roundRectPath(ctx, cx - 5, cy + 6, 10, 4, 1);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillRect(cx - 1.5, cy + 1.5, 3, 6);

    // Bulb
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark;
    ctx.stroke();

    // Specular highlight (top-left)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.arc(cx - 2, cy - 2.2, 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Label with a subtle contrasting pill
    ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    const label = getLabel(beacon);
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(2,6,23,0.62)";
    roundRectPath(ctx, cx - w / 2, cy - 30, w, 15, 4);
    ctx.fill();
    ctx.fillStyle = "#FDE68A";
    ctx.fillText(label, cx, cy - 19);
  });
}

/** Derive a tracker's heading (radians, canvas space) from its position trail. */
function trackerHeading(tracker, position) {
  const history = tracker.position_history || [];
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const dx = last[0] - prev[0];
  const dy = last[1] - prev[1];
  if (Math.hypot(dx, dy) < 0.15) return null; // effectively stationary
  // Map y points up, canvas y points down → flip dy
  return Math.atan2(-dy, dx);
}

/** Resolve the anchor point for a tracker (position or last history point). */
function resolveTrackerPosition(tracker) {
  if (
    tracker.position &&
    Number.isFinite(tracker.position.x) &&
    Number.isFinite(tracker.position.y)
  ) {
    return tracker.position;
  }
  const history = tracker.position_history || [];
  if (history.length > 0) {
    return {
      x: history[history.length - 1][0],
      y: history[history.length - 1][1],
    };
  }
  return null;
}

/**
 * Draw trackers on canvas as lively, identifiable devices.
 *
 * Each tracker is drawn with a soft accuracy gradient, a pulsing halo, a glossy
 * body with a bright core, and a heading arrow derived from its movement trail.
 * Online trackers glow cyan; offline/greyed-out ones render in slate.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} trackers - Tracker objects (position / position_history)
 * @param {Object} coords - Result from useMapCanvas
 * @param {Object} options - Rendering options
 * @param {number} options.time - Animation timestamp (ms), for pulse effects
 * @param {Function} options.getLabel - Function to get label text
 */
export function drawTrackers(ctx, trackers, coords, options = {}) {
  const { time = 0, getLabel = (t) => t.trackerId || "unknown" } = options;
  const { scale } = coords;

  trackers.forEach((tracker) => {
    const position = resolveTrackerPosition(tracker);
    if (!position) return;

    const [cx, cy] = coords.toCanvas(position.x, position.y);
    const online = tracker.online !== "offline" && tracker.online != null;
    const color = online ? "#22D3EE" : "#94A3B8";
    const dark = online ? "#0E7490" : "#475569";
    const glowColor = online ? "34, 211, 238" : "148, 163, 184";

    // Soft accuracy ellipse (radial gradient) with a faint dashed ring
    if (tracker.accuracy != null) {
      const radius = Math.min(
        Math.max(tracker.accuracy * scale * 0.35, 14),
        90,
      );
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      grad.addColorStop(0, `rgba(${glowColor}, 0.26)`);
      grad.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = `rgba(${glowColor}, 0.32)`;
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Pulsing halo
    const phase = (time / 1300) % 1;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${glowColor}, ${0.5 * (1 - phase)})`;
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, 11 + phase * 11, 0, Math.PI * 2);
    ctx.stroke();

    // Ambient glow
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
    glow.addColorStop(0, `rgba(${glowColor}, 0.5)`);
    glow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();

    // Heading arrow (direction of travel)
    const angle = trackerHeading(tracker, position);
    if (angle != null) {
      ctx.save();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 11, cy + Math.sin(angle) * 11);
      ctx.stroke();
      // Arrowhead
      const hx = cx + Math.cos(angle) * 11;
      const hy = cy + Math.sin(angle) * 11;
      const back = angle - Math.PI;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(back + 0.4) * 4, hy + Math.sin(back + 0.4) * 4);
      ctx.lineTo(hx + Math.cos(back - 0.4) * 4, hy + Math.sin(back - 0.4) * 4);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.restore();
    }

    // Glossy body: dark ring → colored disc → white core
    ctx.beginPath();
    ctx.fillStyle = dark;
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#FFFFFF";
    ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Label with contrasting pill
    ctx.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    const label = getLabel(tracker);
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(2,6,23,0.62)";
    roundRectPath(ctx, cx + 14 - 6, cy - 24, w, 16, 5);
    ctx.fill();
    ctx.fillStyle = online ? "#CFFAFE" : "#E2E8F0";
    ctx.fillText(label, cx + 14, cy - 12);
  });
}

/**
 * Draw map footer with title and coordinate info.
 */
export function drawMapFooter(
  ctx,
  { mapConfig, canvasWidth, canvasHeight, coords },
) {
  const { offsetX, offsetY } = coords;

  const title = mapConfig?.map?.name
    ? `${mapConfig.map.name} · ${mapConfig.map.width}m × ${mapConfig.map.height}m`
    : "Map Editor";

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "13px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, offsetX + 12, offsetY + 16);

  ctx.fillStyle = "rgba(148, 163, 184, 0.88)";
  ctx.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Coordinates in meters", canvasWidth - 12, canvasHeight - 12);
}
