import { useEffect, useMemo, useRef, useState } from "react";
import { ASSEMBLY_DONE, useStore } from "../state/store";
import type { InteriorCinematicVariant } from "./interiorCinematics";
import { getInteriorCinematicVariant } from "./interiorCinematics";

const DPR_CAP = 2;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function frameFromProgress(progress: number, frameCount: number) {
  return Math.min(frameCount - 1, Math.max(0, Math.round(progress * (frameCount - 1))));
}

function drawImageCover(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;

  ctx.fillStyle = "#09090c";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

export default function InteriorCinematicLayer() {
  const started = useStore((s) => s.started);
  const assembling = useStore((s) => s.assembling);
  const config = useStore((s) => s.config);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const dragRef = useRef<{ x: number; progress: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);

  const variant = useMemo(
    () => getInteriorCinematicVariant(config.interior),
    [config.interior.material, config.interior.color],
  );
  const active =
    started &&
    !assembling &&
    config.assemblyStep >= ASSEMBLY_DONE &&
    config.view === "interior" &&
    variant !== null;

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setFrameIndex(0);
    progressRef.current = 0;
    imagesRef.current = [];
    if (!variant) return;

    let cancelled = false;
    const images = variant.frames.map((src, index) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        if (index === 0) {
          setReady(true);
          const canvas = canvasRef.current;
          if (canvas) drawImageCover(canvas, img);
        }
      };
      img.onerror = () => {
        if (!cancelled && index === 0) setFailed(true);
      };
      img.src = src;
      return img;
    });
    imagesRef.current = images;

    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    if (!active || !ready || !variant) return;
    let raf = 0;
    let startedAt = performance.now() - progressRef.current * 1000 * (variant.frameCount / variant.fps);

    const draw = () => {
      const duration = (variant.frameCount / variant.fps) * 1000;
      if (!dragRef.current) {
        progressRef.current = ((performance.now() - startedAt) % duration) / duration;
      } else {
        startedAt = performance.now() - progressRef.current * duration;
      }

      const nextFrame = frameFromProgress(progressRef.current, variant.frameCount);
      const img = imagesRef.current[nextFrame] ?? imagesRef.current[0];
      const canvas = canvasRef.current;
      if (canvas && img?.complete && img.naturalWidth > 0) {
        drawImageCover(canvas, img);
        setFrameIndex(nextFrame);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, ready, variant]);

  useEffect(() => {
    if (!active || !ready) return;
    const drawCurrent = () => {
      const img = imagesRef.current[frameFromProgress(progressRef.current, variant?.frameCount ?? 1)];
      const canvas = canvasRef.current;
      if (canvas && img?.complete && img.naturalWidth > 0) drawImageCover(canvas, img);
    };
    window.addEventListener("resize", drawCurrent);
    return () => window.removeEventListener("resize", drawCurrent);
  }, [active, ready, variant]);

  if (!active || failed) return null;

  const setProgressFromPointer = (x: number) => {
    if (!dragRef.current || !variant) return;
    const delta = (x - dragRef.current.x) / Math.max(window.innerWidth, 1);
    progressRef.current = clamp01(dragRef.current.progress + delta * 0.9);
    const nextFrame = frameFromProgress(progressRef.current, variant.frameCount);
    const img = imagesRef.current[nextFrame] ?? imagesRef.current[0];
    const canvas = canvasRef.current;
    if (canvas && img?.complete && img.naturalWidth > 0) drawImageCover(canvas, img);
    setFrameIndex(nextFrame);
  };

  return (
    <div
      className={`cinematic-layer ${ready ? "ready" : ""}`}
      aria-hidden="true"
      onPointerDown={(event) => {
        dragRef.current = { x: event.clientX, progress: progressRef.current };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => setProgressFromPointer(event.clientX)}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onWheel={(event) => {
        if (!variant) return;
        progressRef.current = clamp01(progressRef.current + event.deltaY / 1800);
        const nextFrame = frameFromProgress(progressRef.current, variant.frameCount);
        const img = imagesRef.current[nextFrame] ?? imagesRef.current[0];
        const canvas = canvasRef.current;
        if (canvas && img?.complete && img.naturalWidth > 0) drawImageCover(canvas, img);
        setFrameIndex(nextFrame);
      }}
    >
      <canvas
        ref={canvasRef}
        className="cinematic-canvas"
        data-cinematic-canvas="true"
        data-cinematic-frame={String(frameIndex + 1)}
        data-cinematic-variant={variant?.id}
      />
      <div className="cinematic-vignette" />
      <div className="cinematic-badge">
        <span>{variant?.label}</span>
        <i>{String(frameIndex + 1).padStart(2, "0")}</i>
      </div>
    </div>
  );
}
