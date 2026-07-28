import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "03_源码");
const readSource = (relativePath) => readFile(path.join(sourceRoot, relativePath), "utf8");

const [
  indexHtml,
  styles,
  seatMap,
  store,
  realtime,
] = await Promise.all([
  readSource("index.html"),
  readSource(path.join("css", "style.css")),
  readSource(path.join("js", "seat-map.js")),
  readSource(path.join("js", "store.js")),
  readSource(path.join("js", "realtime.js")),
]);

const sourceBundle = [indexHtml, styles, seatMap, store, realtime].join("\n");
const forbiddenChartLibrary = /\b(?:echarts|d3(?:\.js)?|antv|chart\.js|highcharts|plotly|canvasjs)\b|cdn\.jsdelivr|cdnjs|unpkg/i;

assert.match(indexHtml, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1\.0"/i);
assert.match(indexHtml, /<canvas[\s\S]*id="seat-canvas"/i);
assert.match(seatMap, /getContext\(["']2d["']\)/);
assert.match(styles, /@media\s*\(max-width:\s*1320px\)/);
assert.match(styles, /@media\s*\(max-width:\s*900px\)/);
assert.match(styles, /@media\s*\(max-width:\s*390px\)/);
assert.match(store, /localStorage\.setItem\(/);
assert.match(store, /JSON\.stringify\(/);
assert.match(realtime, /new WebSocket\(/);
assert.doesNotMatch(sourceBundle, forbiddenChartLibrary);
assert.doesNotMatch(indexHtml, /<script[^>]+src=["']https?:\/\//i);

console.log("technical requirements static audit passed");
