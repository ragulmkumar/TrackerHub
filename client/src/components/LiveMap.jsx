import { useEffect, useRef, useState } from "react";
import colorPalette from "../themes/colorPalette";
import {
  useMapCanvas,
  drawMapBase,
  drawBeacons,
  drawTrackers,
  drawMapFooter,
} from "../hooks/useMapCanvas";

export default function LiveMap({
  mapConfig,
  beacons = [],
  trackers = [],
  showTrails,
  wsStatus,
  className = "",
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

  // Use shared coordinate conversion hook
  const coords = useMapCanvas({
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    mapConfig,
    padding: 30,
  });

  const { toCanvas, scale } = coords;

  // ── Animated draw loop ──────────────────────────────────────────────────
  // Keep the latest props/state in refs so the rAF loop always reads fresh
  // values without needing to tear down and restart every render.
  const propsRef = useRef({
    mapConfig,
    beacons,
    trackers,
    showTrails,
    wsStatus,
    canvasSize,
    coords,
  });
  useEffect(() => {
    propsRef.current = {
      mapConfig,
      beacons,
      trackers,
      showTrails,
      wsStatus,
      canvasSize,
      coords,
    };
  }, [mapConfig, beacons, trackers, showTrails, wsStatus, canvasSize, coords]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = null;

    const drawFrame = () => {
      const {
        mapConfig: mc,
        beacons: bc,
        trackers: tk,
        showTrails: st,
        wsStatus: ws,
        canvasSize: cs,
        coords: cr,
      } = propsRef.current;

      const width = Math.max(cs.width, 320);
      const height = Math.max(cs.height, 280);
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

      const hasMap = Boolean(mc?.map);
      if (!hasMap) {
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);
        drawText(
          ws === "connected"
            ? "Waiting for server configuration"
            : "Waiting for websocket connection",
          width / 2,
          height / 2,
          "#94A3B8",
          18,
          "center",
        );
        rafId = requestAnimationFrame(drawFrame);
        return;
      }

      // Static layers
      drawMapBase(ctx, {
        mapConfig: mc,
        canvasWidth: width,
        canvasHeight: height,
        coords: cr,
        backgroundColor: colorPalette.background.default,
        backgroundImage: mc?.map?.backgroundImage || null,
      });

      const time = performance.now();

      // Beacons (animated pulse + signal arcs)
      drawBeacons(ctx, bc, cr, { time });

      // Trails (static dashed polyline per tracker)
      if (st) {
        tk.forEach((tracker) => {
          const history = tracker.position_history || [];
          if (history.length < 2) return;
          ctx.strokeStyle = "rgba(96, 165, 250, 0.75)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          history.forEach((point, index) => {
            const [px, py] = cr.toCanvas(point[0], point[1]);
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      // Trackers (animated pulse halo, glossy body, heading arrow)
      drawTrackers(ctx, tk, cr, { time });

      // Footer
      drawMapFooter(ctx, {
        mapConfig: mc,
        canvasWidth: width,
        canvasHeight: height,
        coords: cr,
      });

      // Empty state overlay
      if (tk.length === 0 && ws === "connected") {
        const message = "No trackers connected";
        ctx.fillStyle = "rgba(15,23,42,0.75)";
        ctx.fillRect(width * 0.15, height * 0.4, width * 0.7, 50);
        drawText(message, width / 2, height * 0.44, "#E2E8F0", 18, "center");
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [canvasSize, coords]);

  const trackerCount = trackers.length;
  const beaconCount = beacons.length;

  return (
    <div
      className={`relative min-h-105 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/75 shadow-2xl backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-slate-950/80 to-transparent" />
      <div ref={wrapperRef} className="relative min-h-105 h-full w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="absolute right-4 top-4 rounded-2xl bg-slate-900/85 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-200">
        {beaconCount} beacon{beaconCount === 1 ? "" : "s"} · {trackerCount}{" "}
        tracker{trackerCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
