import {
  attachIntake,
  formatBytes,
  h,
  measureImage,
  mount,
  readHeaderBytes,
} from "@nasdigitaluk/withnate-tool-core";
import { decode, render, toJpeg } from "./render.js";
import {
  DEFAULT_PRESETS,
  MAX_MEGAPIXELS,
  PRESETS,
  croppedFraction,
  isTooLarge,
  isUpscaled,
  megapixels,
  parseHex,
  placeImage,
  suggestedName,
  type Background,
  type Fit,
} from "./plan.js";

const q = <T extends HTMLElement>(root: HTMLElement, sel: string): T | null => root.querySelector<T>(sel);

mount("[data-sr]", ({ root }) => {
  const drop = q<HTMLElement>(root, "[data-sr-drop]");
  if (!drop) return;

  const statusOut = q<HTMLElement>(root, "[data-sr-status]");
  const controls = q<HTMLElement>(root, "[data-sr-controls]");
  const presetBox = q<HTMLElement>(root, "[data-sr-presets]");
  const fitSel = q<HTMLSelectElement>(root, "[data-sr-fit]");
  const bgSel = q<HTMLSelectElement>(root, "[data-sr-bg]");
  const colourIn = q<HTMLInputElement>(root, "[data-sr-colour]");
  const results = q<HTMLElement>(root, "[data-sr-results]");
  const resetBtn = q<HTMLButtonElement>(root, "[data-sr-reset]");

  let bitmap: ImageBitmap | null = null;
  let fileName = "image";
  let urls: string[] = [];
  let request = 0;
  let debounce = 0;

  const setStatus = (text: string, kind: "info" | "error" | "" = ""): void => {
    if (!statusOut) return;
    statusOut.textContent = text;
    statusOut.className = kind ? `sr-status is-${kind}` : "sr-status";
    statusOut.hidden = text.length === 0;
  };

  const releaseUrls = (): void => {
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
  };

  const chosen = (): string[] =>
    Array.from(presetBox?.querySelectorAll<HTMLInputElement>("input[type=checkbox]") ?? [])
      .filter((c) => c.checked)
      .map((c) => c.value);

  const syncColourVisibility = (): void => {
    const field = colourIn?.closest<HTMLElement>(".sr-field");
    const contain = (fitSel?.value ?? "contain") === "contain";
    if (field) field.hidden = !(contain && bgSel?.value === "colour");
    const bgField = bgSel?.closest<HTMLElement>(".sr-field");
    if (bgField) bgField.hidden = !contain;
  };

  const renderAll = async (): Promise<void> => {
    if (!bitmap || !results) return;
    const ticket = ++request;
    const fit = (fitSel?.value === "cover" ? "cover" : "contain") as Fit;
    const background = (bgSel?.value === "colour" ? "colour" : "blur") as Background;
    const colour = parseHex(colourIn?.value ?? "") ?? "#ffffff";
    const ids = chosen();

    if (ids.length === 0) {
      releaseUrls();
      results.replaceChildren(h("p", { class: "sr-note" }, "Tick at least one size above."));
      return;
    }

    setStatus("Working…", "info");
    const cards: HTMLElement[] = [];
    const fresh: string[] = [];
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
        const notes: HTMLElement[] = [];
        if (isUpscaled(bitmap, rect)) {
          notes.push(h("p", { class: "sr-warn" }, "Your picture is smaller than this slot, so it was enlarged and will look softer."));
        }
        const cut = croppedFraction(rect, target);
        if (cut > 0.005) {
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
              h("span", { class: "sr-dims" }, `${preset.width} × ${preset.height} · ${formatBytes(blob.size)}`),
              ...notes,
              h("a", { class: "sr-download", href: url, download: suggestedName(fileName, preset) }, "Download"),
            ),
          ),
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

  const schedule = (): void => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void renderAll(), 150);
  };

  const show = (on: boolean): void => {
    if (controls) controls.hidden = !on;
    if (resetBtn) resetBtn.hidden = !on;
    if (!on) {
      releaseUrls();
      results?.replaceChildren();
    }
  };

  const load = async (file: File): Promise<void> => {
    const ticket = ++request;
    setStatus("Reading…", "info");
    try {
      const measured = measureImage(await readHeaderBytes(file));
      if (measured && isTooLarge(measured)) {
        setStatus(
          `That image is ${Math.round(megapixels(measured))} megapixels (${measured.width} × ${measured.height}). The limit here is ${MAX_MEGAPIXELS}, because opening it would use more memory than a browser tab can spare.`,
          "error",
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
    const groups = new Map<string, HTMLElement[]>();
    for (const p of PRESETS) {
      const box = h("input", { type: "checkbox", value: p.id }) as HTMLInputElement;
      box.checked = (DEFAULT_PRESETS as readonly string[]).includes(p.id);
      const label = h("label", { class: "sr-preset" }, box, ` ${p.label}`, h("span", { class: "sr-dims" }, ` ${p.width}×${p.height}`));
      groups.set(p.platform, [...(groups.get(p.platform) ?? []), label]);
    }
    presetBox.replaceChildren(
      ...[...groups].map(([platform, labels]) => h("fieldset", { class: "sr-group" }, h("legend", {}, platform), ...labels)),
    );
  }

  attachIntake(drop, {
    onFile: (file) => void load(file),
    onReject: (reason) => setStatus(reason, "error"),
    draggingClass: "is-dragging",
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
