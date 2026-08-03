import { useEffect, useRef, useState } from "react";
import colorPalette from "../themes/colorPalette";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function LiveMap({
  mapConfig,
  beacons = [],
  trackers = [],
  showTrails,
  wsStatus,
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 520 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const resize = (entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setCanvasSize({
        width: Math.max(width, 320),
        height: Math.max(height, 280),
      });
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = Math.max(canvasSize.width, 320);
    const height = Math.max(canvasSize.height, 280);
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const drawText = (
      text,
      x,
      y,
      color = "#F8FAFC",
      size = 12,
      align = "left",
    ) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.fillText(text, x, y);
    };

    const hasMap = Boolean(mapConfig?.map);
    if (!hasMap) {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);
      drawText(
        wsStatus === "connected"
          ? "Waiting for server configuration"
          : "Waiting for websocket connection",
        width / 2,
        height / 2,
        "#94A3B8",
        18,
        "center",
      );
      return;
    }

    const mapWidth = mapConfig.map.width;
    const mapHeight = mapConfig.map.height;
    const padding = 30;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const scale = Math.max(
      0.1,
      Math.min(
        availableWidth / Math.max(mapWidth, 1),
        availableHeight / Math.max(mapHeight, 1),
      ),
    );
    const renderWidth = mapWidth * scale;
    const renderHeight = mapHeight * scale;
    const offsetX = (width - renderWidth) / 2;
    const offsetY = (height - renderHeight) / 2;

    const toCanvas = (x, y) => {
      const drawX = offsetX + x * scale;
      const drawY = height - offsetY - y * scale;
      return [drawX, drawY];
    };

    const drawBackground = () => {
      ctx.fillStyle = colorPalette.background.default;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#111827";
      ctx.fillRect(offsetX - 1, offsetY - 1, renderWidth + 2, renderHeight + 2);
      ctx.fillStyle = "#020617";
      ctx.fillRect(offsetX, offsetY, renderWidth, renderHeight);
    };

    const drawGrid = () => {
      const lineCount = 10;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
      ctx.lineWidth = 1;
      for (let index = 0; index <= lineCount; index += 1) {
        const factor = index / lineCount;
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
    };

    const drawEntities = () => {
      const entities = mapConfig.map.entities || [];
      entities.forEach((entity) => {
        if (
          !entity ||
          !Array.isArray(entity.points) ||
          entity.points.length === 0
        ) {
          return;
        }

        const strokeColor = entity.strokeColor || entity.color || "#94A3B8";
        const fillColor = entity.fillColor || null;
        const lineWidth = entity.lineWidth || 1;

        if (entity.type === "line" || entity.type === "polyline") {
          const [firstPoint, ...rest] = entity.points;
          if (!firstPoint || firstPoint.length < 2) {
            return;
          }

          ctx.beginPath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          const [startX, startY] = toCanvas(firstPoint[0], firstPoint[1]);
          ctx.moveTo(startX, startY);

          rest.forEach((point) => {
            if (!point || point.length < 2) {
              return;
            }
            const [x, y] = toCanvas(point[0], point[1]);
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
    };

    const drawBeacons = () => {
      beacons.forEach((beacon) => {
        const [cx, cy] = toCanvas(beacon.x ?? 0, beacon.y ?? 0);
        ctx.beginPath();
        ctx.fillStyle = "#FBBF24";
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1F2937";
        ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          beacon.displayName || beacon.uuid || "Beacon",
          cx,
          cy - 12,
        );
      });
    };

    const drawTrails = () => {
      if (!showTrails) {
        return;
      }

      trackers.forEach((tracker) => {
        const history = tracker.position_history || [];
        if (history.length < 2) {
          return;
        }
        ctx.strokeStyle = "rgba(96, 165, 250, 0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        history.forEach((point, index) => {
          const [px, py] = toCanvas(point[0], point[1]);
          if (index === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);
      });
    };

    const drawTrackers = () => {
      trackers.forEach((tracker) => {
        if (!tracker.position) {
          return;
        }
        const [cx, cy] = toCanvas(tracker.position.x, tracker.position.y);
        ctx.beginPath();
        ctx.fillStyle = "#38BDF8";
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();

        const label = tracker.trackerId || "unknown";
        drawText(label, cx + 14, cy - 12, "#E2E8F0", 12, "left");

        if (tracker.accuracy != null) {
          const radius = clamp(tracker.accuracy * scale * 0.35, 12, 80);
          ctx.beginPath();
          ctx.strokeStyle = "rgba(59, 130, 246, 0.18)";
          ctx.lineWidth = 2;
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    };

    const drawFooter = () => {
      const title = mapConfig?.map?.name
        ? `${mapConfig.map.name} · ${mapConfig.map.width}m × ${mapConfig.map.height}m`
        : "Live tracker map";
      drawText(title, offsetX + 12, offsetY + 16, "#E2E8F0", 13, "left");
      drawText(
        "Coordinates are rendered in meters",
        width - 12,
        height - 12,
        "rgba(148, 163, 184, 0.88)",
        11,
        "right",
      );
    };

    drawBackground();
    drawGrid();
    drawEntities();
    drawBeacons();
    drawTrails();
    drawTrackers();
    drawFooter();

    if (trackers.length === 0 && wsStatus === "connected") {
      const message = "No trackers connected";
      ctx.fillStyle = "rgba(15,23,42,0.75)";
      ctx.fillRect(width * 0.15, height * 0.4, width * 0.7, 50);
      drawText(message, width / 2, height * 0.44, "#E2E8F0", 18, "center");
    }
  }, [mapConfig, beacons, trackers, showTrails, canvasSize, wsStatus]);

  const trackerCount = trackers.length;
  const beaconCount = beacons.length;

  return (
    <div className="relative min-h-105 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/75 shadow-2xl backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-slate-950/80 to-transparent" />
      <div ref={wrapperRef} className="relative min-h-105 w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="absolute right-4 top-4 rounded-2xl bg-slate-900/85 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-200">
        {beaconCount} beacon{beaconCount === 1 ? "" : "s"} · {trackerCount}{" "}
        tracker{trackerCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
