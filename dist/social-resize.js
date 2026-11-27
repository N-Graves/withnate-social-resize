/*! withnate-social-resize v0.1.0 - MIT
 * https://github.com/N-Graves/withnate-social-resize#readme
 * Runs entirely in the browser. No network requests, no storage.
 */
"use strict";
(() => {
  // node_modules/@nasdigitaluk/withnate-tool-core/dist/bytes.js
  var u8 = (b, i) => {
    const v = b[i];
    if (v === void 0)
      throw new RangeError(`byte ${i} is past the end of the buffer`);
    return v;
  };
  var be16 = (b, i) => u8(b, i) << 8 | u8(b, i + 1);
  var le16 = (b, i) => u8(b, i) | u8(b, i + 1) << 8;
  var le24 = (b, i) => u8(b, i) | u8(b, i + 1) << 8 | u8(b, i + 2) << 16;
  var be32 = (b, i) => (u8(b, i) << 24 | u8(b, i + 1) << 16 | u8(b, i + 2) << 8 | u8(b, i + 3)) >>> 0;
  var le32 = (b, i) => (u8(b, i) | u8(b, i + 1) << 8 | u8(b, i + 2) << 16 | u8(b, i + 3) << 24) >>> 0;
  var matchBytes = (b, sig, offset = 0) => {
    if (b.length < offset + sig.length)
      return false;
    for (let i = 0; i < sig.length; i += 1) {
      if (b[offset + i] !== sig[i])
        return false;
    }
    return true;
  };
  var matchAscii = (b, offset, s) => {
    if (b.length < offset + s.length)
      return false;
    for (let i = 0; i < s.length; i += 1) {
      if (b[offset + i] !== s.charCodeAt(i))
        return false;
    }
    return true;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/sniff.js
  var PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  var JPEG_SIG = [255, 216, 255];
  var GIF87_SIG = [71, 73, 70, 56, 55, 97];
  var GIF89_SIG = [71, 73, 70, 56, 57, 97];
  var RIFF_SIG = [82, 73, 70, 70];
  var WEBP_SIG = [87, 69, 66, 80];
  var HEADER_BYTES = 64 * 1024;
  var sniffFormat = (bytes) => {
    if (matchBytes(bytes, PNG_SIG))
      return "png";
    if (matchBytes(bytes, JPEG_SIG))
      return "jpeg";
    if (matchBytes(bytes, GIF87_SIG) || matchBytes(bytes, GIF89_SIG))
      return "gif";
    if (matchBytes(bytes, RIFF_SIG) && matchBytes(bytes, WEBP_SIG, 8))
      return "webp";
    return null;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/units.js
  var MM_PER_INCH = 25.4;
  var CM_PER_INCH = MM_PER_INCH / 10;
  var MM_PER_METRE = 1e3;
  var roundTo = (value, dp) => {
    const f = 10 ** dp;
    return Math.round(value * f) / f;
  };
  var formatBytes = (n) => {
    if (!Number.isFinite(n) || n < 0)
      return "\u2014";
    if (n < 1e3)
      return `${Math.round(n)} B`;
    const kb = Math.round(n / 1e3);
    if (kb < 1e3)
      return `${kb} KB`;
    return `${roundTo(n / 1e6, 1)} MB`;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/exif.js
  var TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  var MAX_ENTRIES = 4096;
  var MAX_COMPONENTS = 1024;
  var MAX_BLOCK_BYTES = 4 * 1024 * 1024;
  var key = (ifd, tag) => `${ifd}:${tag}`;
  var findTiffBlock = (bytes) => {
    const format = sniffFormat(bytes);
    if (format === "jpeg") {
      let p = 2;
      while (p + 4 <= bytes.length) {
        if (u8(bytes, p) !== 255) {
          p += 1;
          continue;
        }
        const marker = u8(bytes, p + 1);
        if (marker === 216 || marker >= 208 && marker <= 217 || marker === 1) {
          p += 2;
          continue;
        }
        const len = u8(bytes, p + 2) << 8 | u8(bytes, p + 3);
        if (len < 2)
          return null;
        if (marker === 225 && matchAscii(bytes, p + 4, "Exif\0\0")) {
          return bytes.subarray(p + 10, p + 2 + len);
        }
        if (marker === 218)
          return null;
        p = p + 2 + len;
      }
      return null;
    }
    if (format === "png") {
      let p = 8;
      while (p + 8 <= bytes.length) {
        const len = be32(bytes, p);
        if (matchAscii(bytes, p + 4, "eXIf"))
          return bytes.subarray(p + 8, p + 8 + len);
        if (matchAscii(bytes, p + 4, "IDAT") || matchAscii(bytes, p + 4, "IEND"))
          return null;
        p += 12 + len;
      }
      return null;
    }
    if (format === "webp") {
      let p = 12;
      while (p + 8 <= bytes.length) {
        const len = le32(bytes, p + 4);
        if (matchAscii(bytes, p, "EXIF")) {
          const start = matchAscii(bytes, p + 8, "Exif\0\0") ? p + 14 : p + 8;
          return bytes.subarray(start, p + 8 + len);
        }
        p += 8 + len + len % 2;
      }
      return null;
    }
    return null;
  };
  var reader = (b, little) => ({
    u16: (i) => little ? u8(b, i) | u8(b, i + 1) << 8 : u8(b, i) << 8 | u8(b, i + 1),
    u32: (i) => little ? le32(b, i) : be32(b, i),
    i32: (i) => (little ? le32(b, i) : be32(b, i)) | 0,
    byte: (i) => u8(b, i)
  });
  var TEXT = new TextDecoder("utf-8", { fatal: false });
  var decodeAscii = (block, offset, count) => {
    let end = offset;
    const limit = offset + count;
    while (end < limit && block[end] !== 0)
      end += 1;
    return TEXT.decode(block.subarray(offset, end)).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  };
  var readValue = (r, block, type, count, offset) => {
    if (type === 2)
      return decodeAscii(block, offset, count);
    const size = TYPE_SIZE[type];
    const one = (i) => {
      const at = offset + i * size;
      switch (type) {
        case 1:
        case 7:
          return r.byte(at);
        case 3:
          return r.u16(at);
        case 4:
          return r.u32(at);
        case 9:
          return r.i32(at);
        case 5:
          return { numerator: r.u32(at), denominator: r.u32(at + 4) };
        case 10:
          return { numerator: r.i32(at), denominator: r.i32(at + 4) };
        default:
          return 0;
      }
    };
    if (count === 1)
      return one(0);
    const out = [];
    for (let i = 0; i < count; i += 1)
      out.push(one(i));
    return out;
  };
  var IFD_EXIF_POINTER = 34665;
  var IFD_GPS_POINTER = 34853;
  var readIfd = (r, block, start, ifd, entries, seen, depth) => {
    if (depth > 4 || seen.has(start) || start + 2 > block.length)
      return 0;
    seen.add(start);
    const count = r.u16(start);
    let p = start + 2;
    for (let i = 0; i < count; i += 1, p += 12) {
      if (p + 12 > block.length || entries.length >= MAX_ENTRIES)
        break;
      const tag = r.u16(p);
      const type = r.u16(p + 2);
      const n = r.u32(p + 4);
      const size = TYPE_SIZE[type] ?? 0;
      if (size === 0 || n === 0)
        continue;
      const bytesNeeded = size * n;
      const valueAt = bytesNeeded <= 4 ? p + 8 : r.u32(p + 8);
      if (valueAt + bytesNeeded > block.length)
        continue;
      if (tag === IFD_EXIF_POINTER || tag === IFD_GPS_POINTER) {
        const target = bytesNeeded <= 4 ? r.u32(p + 8) : valueAt;
        readIfd(r, block, target, tag === IFD_EXIF_POINTER ? "exif" : "gps", entries, seen, depth + 1);
        continue;
      }
      if (type !== 2 && n > MAX_COMPONENTS)
        continue;
      try {
        entries.push({ tag, ifd, type, count: n, value: readValue(r, block, type, n, valueAt) });
      } catch {
        continue;
      }
    }
    return p + 4 <= block.length ? r.u32(p) : 0;
  };
  var parseExif = (bytes) => {
    try {
      const block = findTiffBlock(bytes);
      if (!block || block.length < 8 || block.length > MAX_BLOCK_BYTES)
        return null;
      const order = block[0] === 73 && block[1] === 73 ? "little" : block[0] === 77 && block[1] === 77 ? "big" : null;
      if (!order)
        return null;
      const r = reader(block, order === "little");
      if (r.u16(2) !== 42)
        return null;
      const entries = [];
      const seen = /* @__PURE__ */ new Set();
      const next = readIfd(r, block, r.u32(4), "image", entries, seen, 0);
      if (next > 0)
        readIfd(r, block, next, "thumbnail", entries, seen, 1);
      const byKey = /* @__PURE__ */ new Map();
      for (const e of entries)
        byKey.set(key(e.ifd, e.tag), e);
      return { byteOrder: order, entries, byKey };
    } catch {
      return null;
    }
  };
  var ratioValue = (v) => {
    if (typeof v === "number")
      return v;
    if (typeof v === "object" && v !== null && "numerator" in v) {
      return v.denominator === 0 ? null : v.numerator / v.denominator;
    }
    return null;
  };
  var exifNumber = (data, ifd, tag) => {
    const e = data.byKey.get(key(ifd, tag));
    return e ? ratioValue(e.value) : null;
  };
  var TAG_X_RESOLUTION = 282;
  var TAG_Y_RESOLUTION = 283;
  var TAG_RESOLUTION_UNIT = 296;
  var exifResolution = (data) => {
    const x = exifNumber(data, "image", TAG_X_RESOLUTION);
    const y = exifNumber(data, "image", TAG_Y_RESOLUTION);
    if (x === null || y === null || x <= 0 || y <= 0)
      return null;
    const unit = exifNumber(data, "image", TAG_RESOLUTION_UNIT) ?? 2;
    if (unit === 2)
      return { x, y };
    if (unit === 3)
      return { x: x * CM_PER_INCH, y: y * CM_PER_INCH };
    return null;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/dimensions.js
  var measurePng = (b) => {
    const width = be32(b, 16);
    const height = be32(b, 20);
    let density = null;
    let p = 8;
    while (p + 8 <= b.length) {
      const len = be32(b, p);
      const type = p + 4;
      if (matchAscii(b, type, "IDAT") || matchAscii(b, type, "IEND"))
        break;
      if (matchAscii(b, type, "pHYs") && len === 9 && p + 8 + 9 <= b.length) {
        const d = p + 8;
        const perMetreX = be32(b, d);
        const perMetreY = be32(b, d + 4);
        if (u8(b, d + 8) === 1 && perMetreX > 0 && perMetreY > 0) {
          density = {
            x: perMetreX * MM_PER_INCH / MM_PER_METRE,
            y: perMetreY * MM_PER_INCH / MM_PER_METRE,
            source: "png-phys"
          };
        }
        break;
      }
      p += 12 + len;
    }
    return { format: "png", width, height, density };
  };
  var isSof = (m) => m >= 192 && m <= 195 || m >= 197 && m <= 199 || m >= 201 && m <= 203 || m >= 205 && m <= 207;
  var measureJpeg = (b) => {
    let density = null;
    let p = 2;
    while (p + 4 <= b.length) {
      if (u8(b, p) !== 255) {
        p += 1;
        continue;
      }
      const marker = u8(b, p + 1);
      if (marker === 255) {
        p += 1;
        continue;
      }
      if (marker === 216 || marker >= 208 && marker <= 217 || marker === 1) {
        p += 2;
        continue;
      }
      const len = be16(b, p + 2);
      if (len < 2)
        break;
      const payload = p + 4;
      if (isSof(marker)) {
        return { format: "jpeg", height: be16(b, payload + 1), width: be16(b, payload + 3), density };
      }
      if (marker === 224 && matchAscii(b, payload, "JFIF\0")) {
        const units = u8(b, payload + 7);
        const x = be16(b, payload + 8);
        const y = be16(b, payload + 10);
        if (x > 0 && y > 0) {
          if (units === 1)
            density = { x, y, source: "jfif" };
          else if (units === 2) {
            density = { x: x * CM_PER_INCH, y: y * CM_PER_INCH, source: "jfif" };
          }
        }
      }
      if (marker === 218)
        break;
      p = payload + len - 2;
    }
    throw new RangeError("no start-of-frame segment found");
  };
  var measureGif = (b) => ({
    format: "gif",
    width: le16(b, 6),
    height: le16(b, 8),
    density: null
  });
  var measureWebp = (b) => {
    const fourcc = String.fromCharCode(u8(b, 12), u8(b, 13), u8(b, 14), u8(b, 15));
    const data = 20;
    if (fourcc === "VP8X") {
      return {
        format: "webp",
        width: le24(b, data + 4) + 1,
        height: le24(b, data + 7) + 1,
        density: null
      };
    }
    if (fourcc === "VP8 ") {
      return {
        format: "webp",
        width: le16(b, data + 6) & 16383,
        height: le16(b, data + 8) & 16383,
        density: null
      };
    }
    if (fourcc === "VP8L") {
      if (u8(b, data) !== 47)
        throw new RangeError("VP8L signature byte missing");
      const bits = u8(b, data + 1) | u8(b, data + 2) << 8 | u8(b, data + 3) << 16 | u8(b, data + 4) << 24;
      return {
        format: "webp",
        width: (bits & 16383) + 1,
        height: (bits >>> 14 & 16383) + 1,
        density: null
      };
    }
    throw new RangeError(`unrecognised WebP chunk "${fourcc}"`);
  };
  var MEASURERS = {
    png: measurePng,
    jpeg: measureJpeg,
    gif: measureGif,
    webp: measureWebp
  };
  var measureImage = (bytes) => {
    const format = sniffFormat(bytes);
    if (format === null)
      return null;
    try {
      const m = MEASURERS[format](bytes);
      if (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width < 1 || m.height < 1) {
        return null;
      }
      if (m.density === null) {
        const exif = parseExif(bytes);
        const res = exif ? exifResolution(exif) : null;
        if (res)
          m.density = { x: res.x, y: res.y, source: "exif" };
      }
      return m;
    } catch {
      return null;
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/intake.js
  var DEFAULT_DRAGGING_CLASS = "is-dragging";
  var attachIntake = (root, opts) => {
    const draggingClass = opts.draggingClass ?? DEFAULT_DRAGGING_CLASS;
    const input = root.querySelector('input[type="file"]');
    const accept = (file) => {
      if (!file)
        return;
      if (opts.maxBytes && file.size > opts.maxBytes) {
        opts.onReject?.(`That file is ${formatBytes(file.size)}. The limit here is ${formatBytes(opts.maxBytes)}.`);
        return;
      }
      if (file.size === 0) {
        opts.onReject?.("That file is empty.");
        return;
      }
      opts.onFile(file);
    };
    const onDragEnter = (e) => {
      e.preventDefault();
      root.classList.add(draggingClass);
    };
    const onDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e) => {
      if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget))
        return;
      root.classList.remove(draggingClass);
    };
    const onDrop = (e) => {
      e.preventDefault();
      root.classList.remove(draggingClass);
      accept(e.dataTransfer?.files?.[0]);
    };
    const onChange = () => {
      accept(input?.files?.[0]);
      if (input)
        input.value = "";
    };
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file");
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        accept(file);
      }
    };
    root.addEventListener("dragenter", onDragEnter);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    input?.addEventListener("change", onChange);
    document.addEventListener("paste", onPaste);
    return () => {
      root.removeEventListener("dragenter", onDragEnter);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("dragleave", onDragLeave);
      root.removeEventListener("drop", onDrop);
      input?.removeEventListener("change", onChange);
      document.removeEventListener("paste", onPaste);
      root.classList.remove(draggingClass);
    };
  };
  var readHeaderBytes = async (file, n = HEADER_BYTES) => {
    const buf = await file.slice(0, n).arrayBuffer();
    return new Uint8Array(buf);
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/mount.js
  var getWn = () => globalThis.WN ?? null;
  var mount = (selector, init) => {
    const run = () => {
      const root = document.querySelector(selector);
      if (!root)
        return;
      const wn = getWn();
      const reduced = wn?.reduced ?? (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : true);
      init({ root, wn, reduced });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/dom.js
  var h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === null || v === void 0)
        continue;
      if (k === "class")
        node.className = String(v);
      else if (v === true)
        node.setAttribute(k, "");
      else
        node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c === null || c === void 0)
        continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  };

  // src/plan.ts
  var PRESETS = [
    { id: "ig-portrait", platform: "Instagram", label: "Post, portrait 4:5", width: 1080, height: 1350 },
    { id: "ig-square", platform: "Instagram", label: "Post, square", width: 1080, height: 1080 },
    { id: "ig-story", platform: "Instagram", label: "Story or Reel 9:16", width: 1080, height: 1920 },
    { id: "fb-post", platform: "Facebook", label: "Post, portrait 4:5", width: 1080, height: 1350 },
    { id: "fb-link", platform: "Facebook", label: "Link image 1.91:1", width: 1200, height: 630 },
    { id: "fb-cover", platform: "Facebook", label: "Page cover", width: 1640, height: 624 },
    { id: "x-post", platform: "X", label: "Post 16:9", width: 1600, height: 900 },
    { id: "x-header", platform: "X", label: "Header 3:1", width: 1500, height: 500 },
    { id: "li-post", platform: "LinkedIn", label: "Post 1.91:1", width: 1200, height: 627 },
    { id: "pin", platform: "Pinterest", label: "Pin 2:3", width: 1e3, height: 1500 },
    { id: "tiktok", platform: "TikTok", label: "Video cover 9:16", width: 1080, height: 1920 },
    { id: "yt-thumb", platform: "YouTube", label: "Thumbnail 16:9", width: 1280, height: 720 },
    { id: "yt-banner", platform: "YouTube", label: "Channel banner", width: 2560, height: 1440 },
    { id: "wa-profile", platform: "WhatsApp", label: "Profile photo, square", width: 640, height: 640 }
  ];
  var DEFAULT_PRESETS = ["ig-portrait", "ig-square", "ig-story"];
  var MAX_MEGAPIXELS = 80;
  var MAX_STEP_FACTOR = 2;
  var megapixels = (size) => size.width * size.height / 1e6;
  var isTooLarge = (size) => megapixels(size) > MAX_MEGAPIXELS;
  var placeImage = (source, target, fit) => {
    const sx = target.width / source.width;
    const sy = target.height / source.height;
    const scale = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    return {
      x: Math.round((target.width - width) / 2),
      y: Math.round((target.height - height) / 2),
      width,
      height
    };
  };
  var croppedFraction = (rect, target) => {
    const visW = Math.max(0, Math.min(rect.x + rect.width, target.width) - Math.max(rect.x, 0));
    const visH = Math.max(0, Math.min(rect.y + rect.height, target.height) - Math.max(rect.y, 0));
    return 1 - visW * visH / (rect.width * rect.height);
  };
  var isUpscaled = (source, rect) => rect.width > source.width * 1.01 || rect.height > source.height * 1.01;
  var downscaleSteps = (source, target) => {
    const steps = [];
    let current = source;
    while (current.width > target.width * MAX_STEP_FACTOR || current.height > target.height * MAX_STEP_FACTOR) {
      current = {
        width: Math.max(target.width, Math.round(current.width / MAX_STEP_FACTOR)),
        height: Math.max(target.height, Math.round(current.height / MAX_STEP_FACTOR))
      };
      steps.push(current);
    }
    if (current.width !== target.width || current.height !== target.height) {
      steps.push({ width: target.width, height: target.height });
    }
    return steps;
  };
  var HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
  var parseHex = (input) => {
    const m = HEX.exec(input.trim());
    if (!m) return null;
    const hex = m[1];
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return `#${full.toLowerCase()}`;
  };
  var suggestedName = (original, preset) => {
    const dot = original.lastIndexOf(".");
    const base = (dot > 0 ? original.slice(0, dot) : original).trim() || "image";
    const platform = preset.platform.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return `${base}-${platform}-${preset.width}x${preset.height}.jpg`;
  };

  // src/render.ts
  var decode = async (file) => createImageBitmap(file, { imageOrientation: "from-image" });
  var makeCanvas = (size) => {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    return canvas;
  };
  var ctx2d = (canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser would not give us a 2D canvas to draw on.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return ctx;
  };
  var scaled = (source, target) => {
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
  var render = (source, target, opts) => {
    const out = makeCanvas(target);
    const ctx = ctx2d(out);
    const rect = placeImage(source, target, opts.fit);
    if (opts.fit === "contain") {
      if (opts.background === "blur") {
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
  var toJpeg = (canvas) => new Promise(
    (resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("The browser could not save that image.")), "image/jpeg", 0.9)
  );

  // src/index.ts
  var q = (root, sel) => root.querySelector(sel);
  mount("[data-sr]", ({ root }) => {
    const drop = q(root, "[data-sr-drop]");
    if (!drop) return;
    const statusOut = q(root, "[data-sr-status]");
    const controls = q(root, "[data-sr-controls]");
    const presetBox = q(root, "[data-sr-presets]");
    const fitSel = q(root, "[data-sr-fit]");
    const bgSel = q(root, "[data-sr-bg]");
    const colourIn = q(root, "[data-sr-colour]");
    const results = q(root, "[data-sr-results]");
    const resetBtn = q(root, "[data-sr-reset]");
    let bitmap = null;
    let fileName = "image";
    let urls = [];
    let request = 0;
    let debounce = 0;
    const setStatus = (text, kind = "") => {
      if (!statusOut) return;
      statusOut.textContent = text;
      statusOut.className = kind ? `sr-status is-${kind}` : "sr-status";
      statusOut.hidden = text.length === 0;
    };
    const releaseUrls = () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls = [];
    };
    const chosen = () => Array.from(presetBox?.querySelectorAll("input[type=checkbox]") ?? []).filter((c) => c.checked).map((c) => c.value);
    const syncColourVisibility = () => {
      const field = colourIn?.closest(".sr-field");
      const contain = (fitSel?.value ?? "contain") === "contain";
      if (field) field.hidden = !(contain && bgSel?.value === "colour");
      const bgField = bgSel?.closest(".sr-field");
      if (bgField) bgField.hidden = !contain;
    };
    const renderAll = async () => {
      if (!bitmap || !results) return;
      const ticket = ++request;
      const fit = fitSel?.value === "cover" ? "cover" : "contain";
      const background = bgSel?.value === "colour" ? "colour" : "blur";
      const colour = parseHex(colourIn?.value ?? "") ?? "#ffffff";
      const ids = chosen();
      if (ids.length === 0) {
        releaseUrls();
        results.replaceChildren(h("p", { class: "sr-note" }, "Tick at least one size above."));
        return;
      }
      setStatus("Working\u2026", "info");
      const cards = [];
      const fresh = [];
      try {
        for (const id of ids) {
          const preset = PRESETS.find((p) => p.id === id);
          if (!preset) continue;
          const target = { width: preset.width, height: preset.height };
          const canvas = render(bitmap, target, { fit, background, colour });
          const blob = await toJpeg(canvas);
          if (ticket !== request) {
            for (const u of fresh) URL.revokeObjectURL(u);
            return;
          }
          const url = URL.createObjectURL(blob);
          fresh.push(url);
          const rect = placeImage(bitmap, target, fit);
          const notes = [];
          if (isUpscaled(bitmap, rect)) {
            notes.push(h("p", { class: "sr-warn" }, "Your picture is smaller than this slot, so it was enlarged and will look softer."));
          }
          const cut = croppedFraction(rect, target);
          if (cut > 5e-3) {
            notes.push(h("p", { class: "sr-warn" }, `Fill mode cut off ${Math.round(cut * 100)}% of the picture here.`));
          }
          cards.push(
            h(
              "figure",
              { class: "sr-card" },
              h("img", { src: url, alt: `${preset.platform} ${preset.label} preview`, width: preset.width, height: preset.height, loading: "lazy" }),
              h(
                "figcaption",
                {},
                h("strong", {}, `${preset.platform}: ${preset.label}`),
                h("span", { class: "sr-dims" }, `${preset.width} \xD7 ${preset.height} \xB7 ${formatBytes(blob.size)}`),
                ...notes,
                h("a", { class: "sr-download", href: url, download: suggestedName(fileName, preset) }, "Download")
              )
            )
          );
        }
        releaseUrls();
        urls = fresh;
        results.replaceChildren(...cards);
        setStatus("");
      } catch (err) {
        for (const u of fresh) URL.revokeObjectURL(u);
        if (ticket !== request) return;
        setStatus(err instanceof Error ? err.message : "That image could not be resized.", "error");
      }
    };
    const schedule = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void renderAll(), 150);
    };
    const show = (on) => {
      if (controls) controls.hidden = !on;
      if (resetBtn) resetBtn.hidden = !on;
      if (!on) {
        releaseUrls();
        results?.replaceChildren();
      }
    };
    const load = async (file) => {
      const ticket = ++request;
      setStatus("Reading\u2026", "info");
      try {
        const measured = measureImage(await readHeaderBytes(file));
        if (measured && isTooLarge(measured)) {
          setStatus(
            `That image is ${Math.round(megapixels(measured))} megapixels (${measured.width} \xD7 ${measured.height}). The limit here is ${MAX_MEGAPIXELS}, because opening it would use more memory than a browser tab can spare.`,
            "error"
          );
          show(false);
          return;
        }
        const next = await decode(file);
        if (ticket !== request) {
          next.close();
          return;
        }
        bitmap?.close();
        bitmap = next;
        fileName = file.name;
        show(true);
        await renderAll();
      } catch {
        if (ticket !== request) return;
        setStatus("That file could not be read as an image this browser understands.", "error");
        show(false);
      }
    };
    if (presetBox && presetBox.children.length === 0) {
      const groups = /* @__PURE__ */ new Map();
      for (const p of PRESETS) {
        const box = h("input", { type: "checkbox", value: p.id });
        box.checked = DEFAULT_PRESETS.includes(p.id);
        const label = h("label", { class: "sr-preset" }, box, ` ${p.label}`, h("span", { class: "sr-dims" }, ` ${p.width}\xD7${p.height}`));
        groups.set(p.platform, [...groups.get(p.platform) ?? [], label]);
      }
      presetBox.replaceChildren(
        ...[...groups].map(([platform, labels]) => h("fieldset", { class: "sr-group" }, h("legend", {}, platform), ...labels))
      );
    }
    attachIntake(drop, {
      onFile: (file) => void load(file),
      onReject: (reason) => setStatus(reason, "error"),
      draggingClass: "is-dragging"
    });
    presetBox?.addEventListener("change", () => void renderAll());
    fitSel?.addEventListener("change", () => {
      syncColourVisibility();
      void renderAll();
    });
    bgSel?.addEventListener("change", () => {
      syncColourVisibility();
      void renderAll();
    });
    colourIn?.addEventListener("input", schedule);
    resetBtn?.addEventListener("click", () => {
      request += 1;
      bitmap?.close();
      bitmap = null;
      show(false);
      setStatus("");
    });
    syncColourVisibility();
    show(false);
  });
})();
