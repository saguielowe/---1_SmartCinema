// B: 负责推荐规则、连续座位搜索和推荐理由。
// 当前先放一个最小占位实现，保证 A / C / D 有固定输入输出可接。

export function getDefaultRecommendation() {
  return {
    recommendedSeatIds: ["F-8", "F-9"],
    fallbackSeatIds: ["G-8", "G-9"],
    score: "excellent",
    reasons: ["中后排视角更舒适", "座位连续且靠近中心区域"],
  };
}

export function recommendSeats() {
  // TODO: 后续在这里接入年龄限制、票种规则和连续座位搜索。
  return getDefaultRecommendation();
}
