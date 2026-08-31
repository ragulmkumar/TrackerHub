import { useCallback, useEffect, useRef, useState } from "react";
import {
  useMapCanvas,
  drawMapBase,
  drawBeacons,
  drawMapFooter,
} from "../hooks/useMapCanvas";

/**
 * MapEditor - Interactive map editor for beacon placement.
 * Supports two modes:
 * - "view": Read-only, shows beacons
 * - "place": Click to place a new beacon (first click sets position, second confirms)
 * - "drag": Drag existing beacon to new position
 */
export default function MapEditor({
  mapConfig,
  beacons = [],
  onBeaconsChange,
  placementBeacon = null, // Beacon being placed (from beacon list "Place on Map")
  onPlacementComplete,
  onPlacementCancel,
  canvasWidth = 900,
  canvasHeight = 520,
  className = "",
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({
    width: canvasWidth,
    height: canvasHeight,
  });
  const [dragState, setDragState] = useState({
    isDragging: false,
    beaconIndex: -1,
    startCanvasX: 0,
    startCanvasY: 0,
    startMapX: 0,
    startMapY: 0,
  });
  const [placementState, setPlacementState] = useState({
    isPlacing: false,
    pendingPosition: null, // [x, y] in meters after first click
    previewPosition: null, // [x, y] in meters for mouse hover
  });
  const [bgImageLoaded, setBgImageLoaded] = useState(false);

  // Load background image when it changes
  useEffect(() => {
    const bgImageUrl = mapConfig?.map?.backgroundImage;
    if (bgImageUrl) {
      setBgImageLoaded(false);
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        setBgImageLoaded(true);
      };
      img.onerror = () => {
        backgroundImageRef.current = null;
        setBgImageLoaded(false);
      };
      img.src = bgImageUrl;
    } else {
      backgroundImageRef.current = null;
      setBgImageLoaded(true);
    }
  }, [mapConfig?.map?.backgroundImage]);

  // Handle resize
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const resize = (entries) => {
      const entry = entries[0];
      if (!entry) return;
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

  const coords = useMapCanvas({
    canvasWidth: canvasSize.width,
    canvasHeight: canvasSize.height,
    mapConfig,
    padding: 30,
  });

  const { toCanvas, toMap, isInsideMap, clampToMap, offsetY } = coords;

  // Placement beacon changes - start placement mode
  useEffect(() => {
    if (placementBeacon && !placementState.isPlacing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlacementState((prev) => ({
        ...prev,
        isPlacing: true,
        pendingPosition: null,
        previewPosition: null,
      }));
    }
  }, [placementBeacon, placementState.isPlacing]);

  // Handle canvas click for placement mode
  const handleCanvasClick = useCallback(
    (event) => {
      if (!placementState.isPlacing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      // Check if click is inside map bounds
      if (!isInsideMap(canvasX, canvasY)) {
        return;
      }

      const [mapX, mapY] = toMap(canvasX, canvasY);
      const [clampedX, clampedY] = clampToMap(mapX, mapY);

      if (placementState.pendingPosition === null) {
        // First click - set pending position
        setPlacementState((prev) => ({
          ...prev,
          pendingPosition: [clampedX, clampedY],
          previewPosition: [clampedX, clampedY],
        }));
      } else {
        // Second click - confirm placement
        onPlacementComplete?.(placementBeacon, clampedX, clampedY);
        setPlacementState({
          isPlacing: false,
          pendingPosition: null,
          previewPosition: null,
        });
      }
    },
    [
      placementState.isPlacing,
      placementState.pendingPosition,
      placementBeacon,
      toMap,
      clampToMap,
      isInsideMap,
      onPlacementComplete,
    ],
  );

  // Handle mouse move for placement preview
  const handleMouseMove = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      if (placementState.isPlacing && placementState.pendingPosition === null) {
        // Show preview position while placing (first click not yet made)
        if (isInsideMap(canvasX, canvasY)) {
          const [mapX, mapY] = toMap(canvasX, canvasY);
          const [clampedX, clampedY] = clampToMap(mapX, mapY);
          setPlacementState((prev) => ({
            ...prev,
            previewPosition: [clampedX, clampedY],
          }));
        }
      }
    },
    [
      placementState.isPlacing,
      placementState.pendingPosition,
      toMap,
      clampToMap,
      isInsideMap,
    ],
  );

  // Handle mouse down for drag mode
  const handleMouseDown = useCallback(
    (event) => {
      if (placementState.isPlacing) return; // Don't drag while placing

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      // Check if clicking on a beacon
      beacons.forEach((beacon, index) => {
        if (beacon.x == null || beacon.y == null) return;

        const [bx, by] = toCanvas(beacon.x, beacon.y);
        const distance = Math.hypot(canvasX - bx, canvasY - by);
        const beaconRadius = 10; // clickable area

        if (distance <= beaconRadius) {
          setDragState({
            isDragging: true,
            beaconIndex: index,
            startCanvasX: canvasX,
            startCanvasY: canvasY,
            startMapX: beacon.x,
            startMapY: beacon.y,
          });
        }
      });
    },
    [placementState.isPlacing, beacons, toCanvas],
  );

  // Handle mouse up for drag mode
  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      // Update beacon position in parent
      const { beaconIndex } = dragState;
      if (beaconIndex >= 0 && onBeaconsChange) {
        // Position already updated during drag, just finalize
        const newBeacons = [...beacons];
        const beacon = { ...newBeacons[beaconIndex] };
        newBeacons[beaconIndex] = beacon;
        onBeaconsChange(newBeacons);
      }
      setDragState((prev) => ({ ...prev, isDragging: false, beaconIndex: -1 }));
    }
  }, [dragState, beacons, onBeaconsChange]);

  // Handle mouse move for drag mode
  const handleMouseMoveForDrag = useCallback(
    (event) => {
      if (!dragState.isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      const [mapX, mapY] = toMap(canvasX, canvasY);
      const [clampedX, clampedY] = clampToMap(mapX, mapY);

      // Update beacon position immediately
      if (onBeaconsChange && dragState.beaconIndex >= 0) {
        const newBeacons = [...beacons];
        const beacon = { ...newBeacons[dragState.beaconIndex] };
        beacon.x = clampedX;
        beacon.y = clampedY;
        newBeacons[dragState.beaconIndex] = beacon;
        onBeaconsChange(newBeacons);
      }

      setDragState((prev) => ({
        ...prev,
        startCanvasX: canvasX,
        startCanvasY: canvasY,
      }));
    },
    [
      dragState.isDragging,
      dragState.beaconIndex,
      toMap,
      clampToMap,
      beacons,
      onBeaconsChange,
    ],
  );

  // Handle cancel placement (Escape key or clicking outside)
  const handleCancelPlacement = useCallback(() => {
    if (placementState.isPlacing) {
      setPlacementState({
        isPlacing: false,
        pendingPosition: null,
        previewPosition: null,
      });
      onPlacementCancel?.();
    }
  }, [placementState.isPlacing, onPlacementCancel]);

  // Keyboard handler for Escape
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCancelPlacement();
      }
    };

    if (placementState.isPlacing) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [placementState.isPlacing, handleCancelPlacement]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    // Draw map base (background, grid, entities)
    // Use the loaded image from ref for better rendering
    drawMapBase(ctx, {
      mapConfig,
      canvasWidth: width,
      canvasHeight: height,
      coords,
      backgroundImage:
        backgroundImageRef.current || mapConfig?.map?.backgroundImage || null,
    });

    // Draw beacons
    drawBeacons(ctx, beacons, coords, {
      selectedBeaconUuid: dragState.isDragging
        ? beacons[dragState.beaconIndex]?.uuid
        : null,
    });

    // Draw placement preview
    if (placementState.isPlacing) {
      const { pendingPosition, previewPosition } = placementState;
      const previewX = previewPosition || pendingPosition;
      if (previewX) {
        const [cx, cy] = toCanvas(previewX[0], previewX[1]);
        ctx.beginPath();
        ctx.fillStyle = "#34D399"; // Green for placement preview
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#10B981";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#064E3B";
        ctx.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `X: ${previewX[0].toFixed(2)}m Y: ${previewX[1].toFixed(2)}m`,
          cx,
          cy - 14,
        );

        // If pending position set, show confirmation hint
        if (pendingPosition) {
          ctx.fillStyle = "#E2E8F0";
          ctx.font = "12px Inter, ui-sans-serif, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "Click again to confirm placement",
            width / 2,
            offsetY - 8,
          );
        }
      }
    }

    // Draw drag preview line (from original position to current)
    if (dragState.isDragging && dragState.beaconIndex >= 0) {
      const beacon = beacons[dragState.beaconIndex];
      if (beacon) {
        const [origX, origY] = toCanvas(
          dragState.startMapX,
          dragState.startMapY,
        );
        const [currX, currY] = toCanvas(beacon.x, beacon.y);

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(origX, origY);
        ctx.lineTo(currX, currY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw footer
    drawMapFooter(ctx, {
      mapConfig,
      canvasWidth: width,
      canvasHeight: height,
      coords,
    });

    // Mode indicator
    if (placementState.isPlacing) {
      ctx.fillStyle = "#34D399";
      ctx.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      const msg = placementState.pendingPosition
        ? "Click to confirm beacon placement"
        : "Click on map to place beacon (Esc to cancel)";
      ctx.fillText(msg, width / 2, 24);
    } else if (dragState.isDragging) {
      ctx.fillStyle = "#38BDF8";
      ctx.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Dragging beacon - release to confirm", width / 2, 24);
    } else {
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Click beacon to drag • Use beacon list to place new beacon",
        width / 2,
        24,
      );
    }
  }, [
    canvasSize,
    mapConfig,
    beacons,
    coords,
    placementState,
    dragState,
    toCanvas,
    offsetY,
    bgImageLoaded,
    backgroundImageRef.current,
  ]);

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("click", handleCanvasClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mousemove", handleMouseMoveForDrag);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mousemove", handleMouseMoveForDrag);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [
    handleCanvasClick,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseMoveForDrag,
  ]);

  return (
    <div
      ref={wrapperRef}
      className={`relative min-h-105 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/75 shadow-2xl backdrop-blur-xl ${className}`}
      style={{ width: "100%" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-slate-950/80 to-transparent" />
      <div className="relative min-h-105 w-full">
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />
      </div>
      <div className="absolute right-4 top-4 rounded-2xl bg-slate-900/85 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-200">
        {beacons.length} beacon{beacons.length === 1 ? "" : "s"}
      </div>
      {(placementState.isPlacing || dragState.isDragging) && (
        <div className="absolute left-4 bottom-4 rounded-2xl bg-amber-900/90 px-3 py-2 text-xs text-amber-200">
          {placementState.isPlacing
            ? placementState.pendingPosition
              ? "Click to confirm • Esc to cancel"
              : "Click map to place • Esc to cancel"
            : "Dragging • Release to confirm"}
        </div>
      )}
    </div>
  );
}
