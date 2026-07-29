export function calculateScheduleMetrics({ schedule, hall, seatState = [], orders = [] }) {
  const capacity = Number(hall?.capacity) || seatState.length;
  const available = seatState.filter((seat) => seat.status === "available").length;
  const reserved = seatState.filter((seat) => seat.status === "reserved").length;
  const sold = seatState.filter((seat) => seat.status === "sold").length;
  const occupancyRate = capacity ? sold / capacity : 0;
  const viewerRatings = orders
    .map((order) => Number(order.viewerRating?.ratingValue))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const viewerRatingTotal = viewerRatings.reduce((total, rating) => total + rating, 0);

  return {
    capacity,
    available,
    reserved,
    sold,
    occupancyRate,
    orderCount: orders.length,
    estimatedRevenue: sold * (Number(schedule?.price) || 0),
    viewerRatingCount: viewerRatings.length,
    viewerRatingTotal,
    viewerRatingAverage: viewerRatings.length ? viewerRatingTotal / viewerRatings.length : null,
  };
}

export function calculateComparisonSummary(metricsList = []) {
  return metricsList.reduce((summary, metrics) => {
    summary.capacity += metrics.capacity;
    summary.sold += metrics.sold;
    summary.reserved += metrics.reserved;
    summary.orderCount += metrics.orderCount;
    summary.estimatedRevenue += metrics.estimatedRevenue;
    summary.viewerRatingCount += metrics.viewerRatingCount || 0;
    summary.viewerRatingTotal += metrics.viewerRatingTotal || 0;
    summary.occupancyRate = summary.capacity ? summary.sold / summary.capacity : 0;
    summary.viewerRatingAverage = summary.viewerRatingCount
      ? summary.viewerRatingTotal / summary.viewerRatingCount
      : null;
    return summary;
  }, {
    capacity: 0,
    sold: 0,
    reserved: 0,
    orderCount: 0,
    estimatedRevenue: 0,
    occupancyRate: 0,
    viewerRatingCount: 0,
    viewerRatingTotal: 0,
    viewerRatingAverage: null,
  });
}
