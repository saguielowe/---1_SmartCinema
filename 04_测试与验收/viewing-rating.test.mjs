import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};

const { store } = await import("../03_源码/js/store.js");

try {
  store.initStore();
  assert.equal(store.login("testuser", "123456").success, true);

  const paidOrder = store.getOrders({ status: "purchased" })[0];
  assert.ok(paidOrder, "Mock 数据应包含普通用户的已支付订单");

  const result = store.submitViewingRating(paidOrder.orderId, {
    ratingValue: 4,
    comment: "  视线清楚，座位舒适  ",
  });
  assert.equal(result.success, true);
  assert.equal(result.order.viewerRating.ratingValue, 4);
  assert.equal(result.order.viewerRating.comment, "视线清楚，座位舒适");
  assert.match(memory.get("smartcinema_orders") || "", /viewerRating/);

  assert.equal(
    store.submitViewingRating(paidOrder.orderId, { ratingValue: 6 }).success,
    false,
    "评分必须限制在 1–5 分",
  );

  store.logout();
  assert.equal(store.login("admin", "admin123").success, true);
  assert.equal(
    store.submitViewingRating(paidOrder.orderId, { ratingValue: 5 }).success,
    false,
    "管理员不能替订单观众评分",
  );

  console.log("viewing rating persistence and permission tests passed");
} finally {
  store.clearAllData();
}
