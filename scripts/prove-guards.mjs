// Disables each guard in src/plan.ts in turn and confirms the tests go red.
// A test that passes with its guard switched off proves nothing.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const FILE = new URL("../src/plan.ts", import.meta.url);
const original = readFileSync(FILE, "utf8");

const probes = [
  ["contain never crops", 'fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy)', "Math.max(sx, sy)"],
  ["contain is centred", "x: Math.round((target.width - width) / 2),", "x: 0,"],
  ["no zero dimension", "const height = Math.max(1, Math.round(source.height * scale));", "const height = Math.round(source.height * scale);"],
  ["upscale is flagged", "rect.width > source.width * 1.01 || rect.height > source.height * 1.01", "false"],
  ["megapixel ceiling", "megapixels(size) > MAX_MEGAPIXELS", "false"],
  ["step factor", `while (
    current.width > target.width * MAX_STEP_FACTOR ||
    current.height > target.height * MAX_STEP_FACTOR
  )`, "while (false)"],
  ["only hex reaches canvas", "const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;", "const HEX = /^#?(.*)$/i;"],
];

let bad = 0;
try {
  for (const [name, from, to] of probes) {
    const n = original.split(from).length - 1;
    if (n !== 1) throw new Error(`${name}: anchor matched ${n} times`);
    writeFileSync(FILE, original.replace(from, to));
    let red = false;
    try {
      execSync("npx vitest run", { stdio: "ignore" });
    } catch {
      red = true;
    }
    console.log(`${red ? "red  " : "GREEN"}  ${name}`);
    if (!red) bad++;
  }
} finally {
  writeFileSync(FILE, original);
}
if (bad) {
  console.error(`${bad} guard(s) not covered`);
  process.exit(1);
}
console.log("every guard is covered");
