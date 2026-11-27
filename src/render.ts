import { downscaleSteps, placeImage, type Background, type Fit, type Size } from "./plan.js";

export const decode = async (file: File): Promise<ImageBitmap> =>
  createImageBitmap(file, { imageOrientation: "from-image" });

const makeCanvas = (size: Size): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
};

const ctx2d = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a 2D canvas to draw on.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
};

/** The source at a given size, stepped down at no more than 2x per draw. */
const scaled = (source: CanvasImageSource & Size, target: Size): HTMLCanvasElement => {
  const steps = downscaleSteps({ width: source.width, height: source.height }, target);
  let canvas = makeCanvas(steps[0] ?? target);
  ctx2d(canvas).drawImage(source, 0, 0, canvas.width, canvas.height);
  for (const step of steps.slice(1)) {
    const next = makeCanvas(step);
    ctx2d(next).drawImage(canvas, 0, 0, next.width, next.height);
    canvas = next;
  }
  return canvas;
};

export interface RenderOptions {
  fit: Fit;
  background: Background;
  colour: string;
}

/** One finished canvas at the preset's exact size. */
export const render = (source: ImageBitmap, target: Size, opts: RenderOptions): HTMLCanvasElement => {
  const out = makeCanvas(target);
  const ctx = ctx2d(out);
  const rect = placeImage(source, target, opts.fit);

  if (opts.fit === "contain") {
    if (opts.background === "blur") {
      // A cover-fit copy, made small, blurred and slightly dimmed, behind the picture.
      const back = placeImage(source, target, "cover");
      const small = { width: Math.max(1, Math.round(target.width / 8)), height: Math.max(1, Math.round(target.height / 8)) };
      const tiny = makeCanvas(small);
      const tctx = ctx2d(tiny);
      tctx.drawImage(source, back.x / 8, back.y / 8, back.width / 8, back.height / 8);
      ctx.filter = "blur(24px) brightness(0.9)";
      ctx.drawImage(tiny, -40, -40, target.width + 80, target.height + 80);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = opts.colour;
      ctx.fillRect(0, 0, target.width, target.height);
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, target.width, target.height);
  }

  if (rect.width < source.width && rect.height < source.height) {
    ctx.drawImage(scaled(source, { width: rect.width, height: rect.height }), rect.x, rect.y);
  } else {
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  }
  return out;
};

export const toJpeg = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not save that image."))), "image/jpeg", 0.9),
  );
