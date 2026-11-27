/**
 * Every decision the social resizer makes, as pure functions over numbers.
 * No canvas, no DOM: src/render.ts owns the drawing and holds no logic.
 */

export interface Size {
  width: number;
  height: number;
}

/** Where to draw the source inside the target canvas. May extend past it (cover). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Fit = "contain" | "cover";
export type Background = "blur" | "colour";

export interface Preset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
}

/**
 * The commonly published upload sizes for each platform. Platforms change
 * these without notice, so the page tells people to check the platform's own
 * help if a size looks off. Keep the list short and real: a size nobody can
 * source is worse than a missing one.
 */
export const PRESETS: readonly Preset[] = [
  { id: "ig-portrait", platform: "Instagram", label: "Post, portrait 4:5", width: 1080, height: 1350 },
  { id: "ig-square", platform: "Instagram", label: "Post, square", width: 1080, height: 1080 },
  { id: "ig-story", platform: "Instagram", label: "Story or Reel 9:16", width: 1080, height: 1920 },
  { id: "fb-post", platform: "Facebook", label: "Post, portrait 4:5", width: 1080, height: 1350 },
  { id: "fb-link", platform: "Facebook", label: "Link image 1.91:1", width: 1200, height: 630 },
  { id: "fb-cover", platform: "Facebook", label: "Page cover", width: 1640, height: 624 },
  { id: "x-post", platform: "X", label: "Post 16:9", width: 1600, height: 900 },
  { id: "x-header", platform: "X", label: "Header 3:1", width: 1500, height: 500 },
  { id: "li-post", platform: "LinkedIn", label: "Post 1.91:1", width: 1200, height: 627 },
  { id: "pin", platform: "Pinterest", label: "Pin 2:3", width: 1000, height: 1500 },
  { id: "tiktok", platform: "TikTok", label: "Video cover 9:16", width: 1080, height: 1920 },
  { id: "yt-thumb", platform: "YouTube", label: "Thumbnail 16:9", width: 1280, height: 720 },
  { id: "yt-banner", platform: "YouTube", label: "Channel banner", width: 2560, height: 1440 },
  { id: "wa-profile", platform: "WhatsApp", label: "Profile photo, square", width: 640, height: 640 },
];

export const DEFAULT_PRESETS = ["ig-portrait", "ig-square", "ig-story"] as const;

export const MAX_MEGAPIXELS = 80;
export const MAX_STEP_FACTOR = 2;

export const megapixels = (size: Size): number => (size.width * size.height) / 1e6;
export const isTooLarge = (size: Size): boolean => megapixels(size) > MAX_MEGAPIXELS;

/**
 * Where the source goes on a target canvas.
 *
 * contain: the whole picture is visible, scaled to touch one pair of edges,
 *          centred. This is the "without cropping" the tool exists for.
 * cover:   the canvas is filled and the overflow is cut, centred.
 */
export const placeImage = (source: Size, target: Size, fit: Fit): Rect => {
  const sx = target.width / source.width;
  const sy = target.height / source.height;
  const scale = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  return {
    x: Math.round((target.width - width) / 2),
    y: Math.round((target.height - height) / 2),
    width,
    height,
  };
};

/** Fraction of the source picture cut off by a placement, 0..1. */
export const croppedFraction = (rect: Rect, target: Size): number => {
  const visW = Math.max(0, Math.min(rect.x + rect.width, target.width) - Math.max(rect.x, 0));
  const visH = Math.max(0, Math.min(rect.y + rect.height, target.height) - Math.max(rect.y, 0));
  return 1 - (visW * visH) / (rect.width * rect.height);
};

/**
 * True when the picture has to be enlarged to fill its slot, which softens it.
 * Measured on the drawn rect, so it is the same rule for both fits.
 */
export const isUpscaled = (source: Size, rect: Rect): boolean =>
  rect.width > source.width * 1.01 || rect.height > source.height * 1.01;

/**
 * The downscale walk: never more than 2x per draw, last step exactly on
 * target. A single 6000px -> 400px draw skips most source pixels.
 */
export const downscaleSteps = (source: Size, target: Size): Size[] => {
  const steps: Size[] = [];
  let current = source;
  while (
    current.width > target.width * MAX_STEP_FACTOR ||
    current.height > target.height * MAX_STEP_FACTOR
  ) {
    current = {
      width: Math.max(target.width, Math.round(current.width / MAX_STEP_FACTOR)),
      height: Math.max(target.height, Math.round(current.height / MAX_STEP_FACTOR)),
    };
    steps.push(current);
  }
  if (current.width !== target.width || current.height !== target.height) {
    steps.push({ width: target.width, height: target.height });
  }
  return steps;
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A safe hex colour for the padding, or null. Nothing else reaches the canvas. */
export const parseHex = (input: string): string | null => {
  const m = HEX.exec(input.trim());
  if (!m) return null;
  const hex = m[1] as string;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return `#${full.toLowerCase()}`;
};

/** shoot.v2.png + ig-portrait -> shoot.v2-instagram-1080x1350.jpg */
export const suggestedName = (original: string, preset: Preset): string => {
  const dot = original.lastIndexOf(".");
  const base = (dot > 0 ? original.slice(0, dot) : original).trim() || "image";
  const platform = preset.platform.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${base}-${platform}-${preset.width}x${preset.height}.jpg`;
};

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
