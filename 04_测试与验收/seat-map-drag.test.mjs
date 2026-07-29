import assert from "node:assert/strict";
import { createSeatMap } from "../03_源码/js/seat-map.js";

globalThis.window = {
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout: (callback) => {
    callback();
    return 1;
  },
};

class MockCanvas extends EventTarget {
  constructor() {
    super();
    this.width = 300;
    this.height = 200;
    this.style = {};
    this.title = "";
    this.attributes = new Map();
    this.context = createContext();
  }

  getContext() {
    return this.context;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  setPointerCapture() {}

  releasePointerCapture() {}
}

function createContext() {
  const gradient = { addColorStop() {} };
  return {
    arc() {},
    beginPath() {},
    clearRect() {},
    createRadialGradient: () => gradient,
    fill() {},
    fillText() {},
    lineTo() {},
    moveTo() {},
    restore() {},
    roundRect() {},
    save() {},
    stroke() {},
  };
}

function createPointerEvent(type, x, y, coalescedEvents = []) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    ctrlKey: { value: true },
    metaKey: { value: false },
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
    getCoalescedEvents: {
      value: () => coalescedEvents,
    },
  });
  return event;
}

function createClickEvent(x, y) {
  const event = new Event("click", { cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    ctrlKey: { value: false },
    metaKey: { value: false },
    pointerType: { value: "mouse" },
  });
  return event;
}

function createFiveSeatMap({
  selectedSeatIds = [],
  highlightedSeatIds = [],
  maxSelected = 5,
  curveDepth = 0,
} = {}) {
  const canvas = new MockCanvas();
  let limitCallCount = 0;
  const seatMap = createSeatMap(canvas, {
    hall: {
      rows: [
        {
          rowLabel: "A",
          pattern: "SSSSS",
          offsetX: 0,
          curveDepth,
        },
      ],
    },
    seatState: Array.from({ length: 5 }, (_, index) => ({
      seatId: `A-${index + 1}`,
      status: "available",
    })),
    heatMap: [],
    selectedSeatIds,
    highlightedSeatIds,
    maxSelected,
    onSelectionLimit: () => {
      limitCallCount += 1;
    },
  });

  return {
    canvas,
    seatMap,
    getLimitCallCount: () => limitCallCount,
  };
}

function fastDragAcrossRow(canvas, { curveDepth = 0, endY } = {}) {
  const edgeY = 72 + curveDepth * 1.9;
  canvas.dispatchEvent(createPointerEvent("pointerdown", 94, edgeY));
  canvas.dispatchEvent(createPointerEvent("pointermove", 206, endY ?? edgeY));
  canvas.dispatchEvent(createPointerEvent("pointerup", 206, endY ?? edgeY));
}

{
  const { canvas, seatMap } = createFiveSeatMap();
  fastDragAcrossRow(canvas);
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    ["A-1", "A-2", "A-3", "A-4", "A-5"],
    "快速 Ctrl 拖动应补齐两个指针事件之间经过的座位",
  );
  seatMap.destroy();
}

{
  const curveDepth = 30;
  const { canvas, seatMap } = createFiveSeatMap({ curveDepth });
  fastDragAcrossRow(canvas, { curveDepth, endY: 72 });
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    ["A-1", "A-2", "A-3", "A-4", "A-5"],
    "终点偏离弧线时仍应按起止横坐标补齐整排区间",
  );
  seatMap.destroy();
}

{
  const curveDepth = 30;
  const { canvas, seatMap } = createFiveSeatMap({
    selectedSeatIds: ["A-1", "A-3", "A-5"],
    highlightedSeatIds: ["A-1", "A-3", "A-5"],
    curveDepth,
  });
  fastDragAcrossRow(canvas, { curveDepth, endY: 72 });
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    ["A-1", "A-2", "A-3", "A-4", "A-5"],
    "第一次手动拖动应替换自动推荐并形成连续区间",
  );
  seatMap.destroy();
}

{
  const { canvas, seatMap } = createFiveSeatMap({
    selectedSeatIds: ["A-1", "A-3", "A-5"],
    highlightedSeatIds: ["A-1", "A-3", "A-5"],
  });
  canvas.dispatchEvent(createClickEvent(150, 72));
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    ["A-3"],
    "第一次手动单击应整体替换自动推荐，而不是只取消推荐中的一个座位",
  );
  seatMap.destroy();
}

{
  const { canvas, seatMap } = createFiveSeatMap({
    selectedSeatIds: ["A-1", "A-2", "A-3", "A-4", "A-5"],
  });
  fastDragAcrossRow(canvas);
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    [],
    "从已选座位开始快速 Ctrl 拖动应连续取消经过的座位",
  );
  seatMap.destroy();
}

{
  const { canvas, seatMap, getLimitCallCount } = createFiveSeatMap({ maxSelected: 2 });
  fastDragAcrossRow(canvas);
  assert.deepEqual(
    seatMap.getSelectedSeatIds(),
    ["A-1", "A-2"],
    "快速拖动仍应遵守最大选座数量",
  );
  assert.equal(getLimitCallCount(), 1, "一次拖动达到上限时只提示一次");
  seatMap.destroy();
}

console.log("seat-map drag regression tests passed");
