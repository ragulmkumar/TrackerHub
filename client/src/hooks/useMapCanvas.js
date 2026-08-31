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

/**
 * Draw beacons on canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} beacons - Array of beacon objects with x, y, displayName
 * @param {Object} coords - Result from useMapCanvas
 * @param {Object} options - Rendering options
 * @param {string} options.selectedBeaconUuid - UUID of beacon being placed/dragged (highlighted)
 * @param {Function} options.getLabel - Function to get label text (default: displayName)
 */
export function drawBeacons(ctx, beacons, coords, options = {}) {
  const {
    selectedBeaconUuid,
    getLabel = (b) => b.displayName || b.uuid || "Beacon",
  } = options;

  beacons.forEach((beacon) => {
    if (beacon.x == null || beacon.y == null) return;

    const [cx, cy] = coords.toCanvas(beacon.x, beacon.y);
    const isSelected = selectedBeaconUuid && beacon.uuid === selectedBeaconUuid;

    ctx.beginPath();
    ctx.fillStyle = isSelected ? "#FBBF24" : "#FBBF24"; // Yellow for all, could differentiate
    ctx.arc(cx, cy, isSelected ? 10 : 8, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = "#1F2937";
    ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(getLabel(beacon), cx, cy - 14);
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
