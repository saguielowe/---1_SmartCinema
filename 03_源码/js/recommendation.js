// 这是推荐模块的占位样例，只用于固定 A / C / D 对接时的输入输出。
// 认领后需要自行实现连续座位搜索、年龄规则、推荐理由和评分。

export function getDefaultRecommendation() {
  return {
    recommendedSeatIds: ["F-8", "F-9"],
    fallbackSeatIds: ["G-8", "G-9"],
    score: "excellent",
    reasons: ["中后排视角更舒适", "座位连续且靠近中心区域"],
  };
}

export function recommendSeats() {
  // TODO: 认领后在这里接入年龄限制、票种规则和连续座位搜索。
  return getDefaultRecommendation();
}
