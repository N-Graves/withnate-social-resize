import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESETS,
  MAX_MEGAPIXELS,
  MAX_STEP_FACTOR,
  PRESETS,
  croppedFraction,
  downscaleSteps,
  isTooLarge,
  isUpscaled,
  parseHex,
  placeImage,
  presetById,
  suggestedName,
  type Size,
} from "../src/plan.js";

const size = (width: number, height: number): Size => ({ width, height });
const SOURCES = [size(4032, 3024), size(3024, 4032), size(6000, 1000), size(800, 800), size(7, 5000)];

describe("placeImage, contain (the 'without cropping' promise)", () => {
  it("never cuts any of the picture off, for every preset and source shape", () => {
    for (const p of PRESETS) {
      for (const s of SOURCES) {
        const t = size(p.width, p.height);
        const r = placeImage(s, t, "contain");
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(t.width);
        expect(r.y + r.height).toBeLessThanOrEqual(t.height);
        expect(croppedFraction(r, t)).toBe(0);
      }
    }
  });

  it("touches one pair of edges, so it is as large as it can be", () => {
    const r = placeImage(size(4032, 3024), size(1080, 1920), "contain");
    expect(r.width).toBe(1080);
    expect(r.height).toBeLessThan(1920);
  });

  it("keeps the aspect ratio", () => {
    const s = size(4032, 3024);
    const r = placeImage(s, size(1080, 1350), "contain");
    expect(Math.abs(r.width / r.height - s.width / s.height)).toBeLessThan(0.01);
  });

  it("centres the picture", () => {
    const r = placeImage(size(1000, 1000), size(1080, 1920), "contain");
    expect(r.y).toBe(Math.round((1920 - r.height) / 2));
  });

  it("centres a tall picture across a wide slot", () => {
    const t = size(1600, 900);
    const r = placeImage(size(1000, 2000), t, "contain");
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBe(Math.round((t.width - r.width) / 2));
  });

  it("never produces a zero dimension at extreme shapes", () => {
    const r = placeImage(size(10000, 3), size(1080, 1920), "contain");
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
});

describe("placeImage, cover", () => {
  it("fills the whole slot", () => {
    const t = size(1080, 1920);
    const r = placeImage(size(4032, 3024), t, "cover");
    expect(r.x).toBeLessThanOrEqual(0);
    expect(r.y).toBeLessThanOrEqual(0);
    expect(r.x + r.width).toBeGreaterThanOrEqual(t.width);
    expect(r.y + r.height).toBeGreaterThanOrEqual(t.height);
  });

  it("reports how much it cut off", () => {
    const t = size(1080, 1080);
    const cut = croppedFraction(placeImage(size(2000, 1000), t, "cover"), t);
    expect(cut).toBeCloseTo(0.5, 2);
  });
});

describe("isUpscaled", () => {
  it("flags a picture smaller than its slot", () => {
    const s = size(500, 500);
    expect(isUpscaled(s, placeImage(s, size(1080, 1080), "contain"))).toBe(true);
  });
  it("does not flag a picture shrunk to fit", () => {
    const s = size(4000, 3000);
    expect(isUpscaled(s, placeImage(s, size(1080, 1080), "contain"))).toBe(false);
  });
});

describe("downscaleSteps", () => {
  it("never shrinks more than 2x in one draw and lands exactly on target", () => {
    const target = size(1080, 810);
    const steps = downscaleSteps(size(8000, 6000), target);
    let prev = size(8000, 6000);
    for (const s of steps) {
      expect(prev.width / s.width).toBeLessThanOrEqual(MAX_STEP_FACTOR + 0.01);
      prev = s;
    }
    expect(steps.at(-1)).toEqual(target);
  });
});

describe("the megapixel ceiling", () => {
  it("refuses above the limit and passes a real 61MP camera file", () => {
    expect(isTooLarge(size(10000, 9000))).toBe(true);
    expect(isTooLarge(size(9504, 6336))).toBe(false);
    expect(MAX_MEGAPIXELS).toBe(80);
  });
});

describe("parseHex (the only colour that reaches the canvas)", () => {
  it("accepts 3 and 6 digit hex, with or without #", () => {
    expect(parseHex("#FFF")).toBe("#ffffff");
    expect(parseHex("1a2b3c")).toBe("#1a2b3c");
  });
  it("refuses anything else", () => {
    for (const bad of ["red", "#12345", "url(x)", "#1234567", ""]) expect(parseHex(bad)).toBeNull();
  });
});

describe("presets", () => {
  it("has unique ids, and the defaults exist", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const id of DEFAULT_PRESETS) expect(presetById(id)).toBeDefined();
  });
});

describe("suggestedName", () => {
  it("keeps interior dots and names the platform and size", () => {
    expect(suggestedName("shoot.v2.png", presetById("ig-portrait")!)).toBe("shoot.v2-instagram-1080x1350.jpg");
  });
  it("falls back to 'image' for an empty name", () => {
    expect(suggestedName("", presetById("x-post")!)).toBe("image-x-1600x900.jpg");
  });
});
