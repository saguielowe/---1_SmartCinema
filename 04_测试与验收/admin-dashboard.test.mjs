import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  calculateComparisonSummary,
  calculateScheduleMetrics,
} from "../03_源码/js/admin-dashboard.js";

const metrics = calculateScheduleMetrics({
  schedule: { price: 68 },
  hall: { capacity: 5 },
  seatState: [
    { status: "sold" },
    { status: "sold" },
    { status: "reserved" },
    { status: "available" },
    { status: "available" },
  ],
  orders: [{}, {}],
});

assert.deepEqual(metrics, {
  capacity: 5,
  available: 2,
  reserved: 1,
  sold: 2,
  occupancyRate: 0.4,
  orderCount: 2,
  estimatedRevenue: 136,
});

assert.deepEqual(
  calculateComparisonSummary([
    metrics,
    { ...metrics, capacity: 10, sold: 5, reserved: 0, orderCount: 3, estimatedRevenue: 340 },
  ]),
  {
    capacity: 15,
    sold: 7,
    reserved: 1,
    orderCount: 5,
    estimatedRevenue: 476,
    occupancyRate: 7 / 15,
  },
);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, app, styles] = await Promise.all([
  readFile(path.join(projectRoot, "03_源码", "index.html"), "utf8"),
  readFile(path.join(projectRoot, "03_源码", "js", "app.js"), "utf8"),
  readFile(path.join(projectRoot, "03_源码", "css", "style.css"), "utf8"),
]);

assert.match(html, /id="admin-schedule-select"/);
assert.match(html, /id="admin-comparison-dialog"/);
assert.match(app, /orderFilter\.scheduleId = currentScheduleId/);
assert.match(styles, /body\.is-admin-view #seat-canvas[\s\S]*pointer-events:\s*none/);

console.log("admin dashboard regression tests passed");
