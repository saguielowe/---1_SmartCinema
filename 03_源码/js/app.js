import { hallMock, seatStateMock } from "./mock-data.js";
import { drawSeatMap } from "./seat-map.js";
import { getDefaultRecommendation } from "./recommendation.js";
import { createStore } from "./store.js";

// D: 页面整合入口。尽量只做模块接线，不要把所有业务逻辑都堆在这里。
const store = createStore({
  hall: hallMock,
  seatState: seatStateMock,
});

const seatCanvas = document.querySelector("#seat-canvas");
const recommendationList = document.querySelector("#recommendation-list");
const orderList = document.querySelector("#order-list");

const recommendation = getDefaultRecommendation();

drawSeatMap(seatCanvas, {
  hall: store.getHall(),
  seatState: store.getSeatState(),
  highlightedSeatIds: recommendation.recommendedSeatIds,
});

renderRecommendation(recommendation);
renderOrders();

function renderRecommendation(result) {
  recommendationList.innerHTML = `
    <li>推荐座位：${result.recommendedSeatIds.join(", ")}</li>
    <li>备选座位：${result.fallbackSeatIds.join(", ")}</li>
    <li>推荐理由：${result.reasons.join("；")}</li>
  `;
}

function renderOrders() {
  // C: 这里后续可以接订单列表和热度数据。
  orderList.innerHTML = `
    <li>订单状态：待接入 store.js</li>
    <li>当前座位状态数：${store.getSeatState().length}</li>
  `;
}
