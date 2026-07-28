export function calculateScheduleMetrics({ schedule, hall, seatState = [], orders = [] }) {
  const capacity = Number(hall?.capacity) || seatState.length;
  const available = seatState.filter((seat) => seat.status === "available").length;
  const reserved = seatState.filter((seat) => seat.status === "reserved").length;
  const sold = seatState.filter((seat) => seat.status === "sold").length;
  const occupancyRate = capacity ? sold / capacity : 0;

  return {
    capacity,
    available,
    reserved,
    sold,
    occupancyRate,
    orderCount: orders.length,
    estimatedRevenue: sold * (Number(schedule?.price) || 0),
  };
}

export function calculateComparisonSummary(metricsList = []) {
  return metricsList.reduce((summary, metrics) => {
    summary.capacity += metrics.capacity;
    summary.sold += metrics.sold;
    summary.reserved += metrics.reserved;
    summary.orderCount += metrics.orderCount;
    summary.estimatedRevenue += metrics.estimatedRevenue;
    summary.occupancyRate = summary.capacity ? summary.sold / summary.capacity : 0;
    return summary;
  }, {
    capacity: 0,
    sold: 0,
    reserved: 0,
    orderCount: 0,
    estimatedRevenue: 0,
    occupancyRate: 0,
  });
}
