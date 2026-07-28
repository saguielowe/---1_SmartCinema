const SCORE_LABELS = {
  excellent: "极佳",
  good: "优秀",
  normal: "一般",
};

const TICKET_TYPE_LABELS = {
  single: "个人票",
  couple: "情侣票",
  family: "家庭票",
  group: "团体票",
};

export function getDefaultRecommendation() {
  return {
    recommendedSeatIds: [],
    fallbackSeatIds: [],
    score: "normal",
    scoreLabel: SCORE_LABELS.normal,
    scoreValue: 0,
    reasons: ["请选择场次并填写观影条件。"],
    recommendedArea: "",
    warnings: [],
    scoreDetails: {
      angle: 0,
      distance: 0,
      spacing: 0,
      preference: 0,
    },
  };
}

export function recommendSeats(recommendationInput = {}, hallOrOptions, maybeSeatState = []) {
  const { hall, seatState, schedule } = normalizeArguments(hallOrOptions, maybeSeatState);

  if (!hall?.rows?.length) {
    return {
      ...getDefaultRecommendation(),
      warnings: ["缺少影厅数据，无法生成推荐。"],
    };
  }

  const input = normalizeInput({
    selectedScheduleId: schedule?.scheduleId,
    selectedMovieId: schedule?.movieId,
    ...recommendationInput,
  });
  const seats = buildSeatIndex(hall);
  let candidates = findCandidates({ seats, hall, seatState, input });

  // 团体票首先保证同排连座；当中央走道或已售座位把一排切开时，
  // 再退化为相邻的多个连续座位区，避免人数稍多就直接没有推荐结果。
  if (candidates.length === 0 && input.ticketType === "group") {
    candidates = findSplitGroupCandidates({ seats, hall, seatState, input });
  }

  if (candidates.length === 0) {
    return buildEmptyResult(input, hall);
  }

  const [best] = candidates;
  const fallback = candidates.find((candidate) => !hasSeatOverlap(best.seatIds, candidate.seatIds));

  return buildResult({ best, fallback, input });
}

export function evaluateViewingExperience(seatIds, hallOrOptions, maybeSeatState = []) {
  const { hall, seatState, schedule } = normalizeArguments(hallOrOptions, maybeSeatState);

  if (!hall?.rows?.length || !Array.isArray(seatIds) || seatIds.length === 0) {
    return getDefaultRecommendation();
  }

  const seats = buildSeatIndex(hall);
  const block = seats.filter((seat) => seatIds.includes(seat.seatId));

  if (block.length === 0) {
    return getDefaultRecommendation();
  }

  const candidate = scoreSeatBlock({
    block,
    allSeats: seats,
    seatState,
    input: normalizeInput({
      peopleCount: seatIds.length,
      selectedScheduleId: schedule?.scheduleId,
    }),
    hall,
  });

  return {
    score: candidate.score,
    scoreLabel: SCORE_LABELS[candidate.score],
    scoreValue: candidate.scoreValue,
    scoreDetails: candidate.scoreDetails,
  };
}

export function debugRecommendation(recommendationInput = {}, hallOrOptions, maybeSeatState = []) {
  const { hall, seatState, schedule } = normalizeArguments(hallOrOptions, maybeSeatState);
  const input = normalizeInput({
    selectedScheduleId: schedule?.scheduleId,
    selectedMovieId: schedule?.movieId,
    ...recommendationInput,
  });
  const result = recommendSeats(input, { hall, seatState, schedule });
  const seats = hall?.rows?.length ? buildSeatIndex(hall) : [];
  const candidates = hall?.rows?.length
    ? findCandidates({ seats, hall, seatState, input }).slice(0, 8)
    : [];

  return {
    input,
    schedule,
    hallSummary: summarizeHall(hall),
    seatStateSummary: summarizeSeatState(seatState, input.selectedScheduleId),
    result,
    candidates: candidates.map((candidate, index) => ({
      rank: index + 1,
      seatIds: candidate.seatIds,
      scoreLabel: SCORE_LABELS[candidate.score],
      scoreValue: candidate.scoreValue,
      recommendedArea: candidate.recommendedArea,
      scoreDetails: candidate.scoreDetails,
    })),
    text: formatDebugReport({
      input,
      schedule,
      hall,
      seatState,
      result,
      candidates,
    }),
  };
}

function normalizeArguments(hallOrOptions, maybeSeatState) {
  if (hallOrOptions?.hall) {
    return {
      hall: hallOrOptions.hall,
      seatState: hallOrOptions.seatState ?? [],
      schedule: hallOrOptions.schedule,
    };
  }

  return {
    hall: hallOrOptions,
    seatState: maybeSeatState ?? [],
    schedule: undefined,
  };
}

function normalizeInput(input) {
  const ticketType = input.ticketType ?? "single";
  const passengers = normalizePassengers(input);
  const warnings = [];
  let peopleCount = Number(input.peopleCount) || passengers.length || 1;

  if (ticketType === "single") {
    peopleCount = 1;
  }

  if (ticketType === "couple") {
    peopleCount = 2;
  }

  if (ticketType === "family") {
    peopleCount = Math.max(2, peopleCount, passengers.length);
  }

  if (ticketType === "group") {
    if (peopleCount > 20) {
      warnings.push("团体票最多支持 20 人，已按 20 人搜索。");
      peopleCount = 20;
    }
  }

  while (passengers.length < peopleCount) {
    passengers.push({ name: `成员${passengers.length + 1}`, age: 30 });
  }

  const ages = passengers.map((passenger) => Number(passenger.age)).filter(Number.isFinite);

  return {
    ...input,
    ticketType,
    ticketTypeLabel: TICKET_TYPE_LABELS[ticketType] ?? "个人票",
    peopleCount,
    passengers,
    ages,
    hasTeen: ages.some((age) => age < 15),
    hasSenior: ages.some((age) => age > 60),
    needAccessibility:
      Boolean(input.needAccessibility) || Boolean(input.preferences?.accessibilityNeeded),
    preferenceMode: normalizePreferenceMode(input.preferenceMode, input.preferences),
    preferences: {
      preferCenter: input.preferences?.preferCenter ?? false,
      preferBack: input.preferences?.preferBack ?? false,
      preferAisle: input.preferences?.preferAisle ?? false,
      accessibilityNeeded: input.preferences?.accessibilityNeeded ?? false,
    },
    warnings,
  };
}

function normalizePreferenceMode(preferenceMode, preferences = {}) {
  if (["center", "back", "aisle", "none"].includes(preferenceMode)) {
    return preferenceMode;
  }
  if (preferences.preferAisle) return "aisle";
  if (preferences.preferBack) return "back";
  if (preferences.preferCenter) return "center";
  return "none";
}

function normalizePassengers(input) {
  if (Array.isArray(input.passengers) && input.passengers.length > 0) {
    return input.passengers
      .map((passenger, index) => ({
        name: passenger.name?.trim() || `成员${index + 1}`,
        age: Number(passenger.age),
      }))
      .filter((passenger) => Number.isFinite(passenger.age));
  }

  if (Array.isArray(input.ages)) {
    return input.ages
      .map((age, index) => ({ name: `成员${index + 1}`, age: Number(age) }))
      .filter((passenger) => Number.isFinite(passenger.age));
  }

  return [];
}

function buildSeatIndex(hall) {
  return hall.rows.flatMap((row, rowIndex) => {
    let seatNumber = 0;
    const seatCount = [...row.pattern].filter(isSeatCell).length;

    return row.pattern
      .split("")
      .map((cellType, cellIndex) => {
        if (!isSeatCell(cellType)) {
          return null;
        }

        seatNumber += 1;

        return {
          seatId: `${row.rowLabel}-${seatNumber}`,
          rowLabel: row.rowLabel,
          rowIndex,
          cellIndex,
          seatNumber,
          seatCount,
          rowLength: row.pattern.length,
          rowPattern: row.pattern,
          type: cellType,
          isAccessibility: cellType === "W",
        };
      })
      .filter(Boolean);
  });
}

function findCandidates({ seats, hall, seatState, input }) {
  const seatsByRow = groupSeatsByRow(seats);
  const rowCount = hall.rows.length;
  const candidates = [];

  seatsByRow.forEach((rowSeats) => {
    if (!rowIsAllowed(rowSeats[0].rowIndex, rowCount, input)) {
      return;
    }

    findContinuousBlocks(rowSeats, input.peopleCount, seatState, input).forEach((block) => {
      candidates.push(scoreSeatBlock({ block, allSeats: seats, seatState, input, hall }));
    });
  });

  return candidates.sort((a, b) => b.scoreValue - a.scoreValue);
}

function groupSeatsByRow(seats) {
  const rowMap = new Map();

  seats.forEach((seat) => {
    if (!rowMap.has(seat.rowLabel)) {
      rowMap.set(seat.rowLabel, []);
    }

    rowMap.get(seat.rowLabel).push(seat);
  });

  return [...rowMap.values()].map((rowSeats) =>
    rowSeats.sort((a, b) => a.cellIndex - b.cellIndex),
  );
}

function findContinuousBlocks(rowSeats, peopleCount, seatState, input) {
  const blocks = [];

  for (let start = 0; start <= rowSeats.length - peopleCount; start += 1) {
    const block = rowSeats.slice(start, start + peopleCount);
    const isContinuous = block.every((seat, index) => (
      index === 0 || seat.cellIndex === block[index - 1].cellIndex + 1
    ));
    const allAvailable = block.every((seat) =>
      isSeatAvailable(seat.seatId, seatState, input.selectedScheduleId),
    );
    const accessibilityFits =
      !input.needAccessibility || block.some((seat) => seat.isAccessibility);

    if (isContinuous && allAvailable && accessibilityFits) {
      blocks.push(block);
    }
  }

  return blocks;
}

function findSplitGroupCandidates({ seats, hall, seatState, input }) {
  const rowCount = hall.rows.length;
  const components = groupSeatsByRow(seats)
    .filter((rowSeats) => rowIsAllowed(rowSeats[0].rowIndex, rowCount, input))
    .flatMap((rowSeats) => getAvailableComponents(rowSeats, seatState, input));

  if (components.length === 0) return [];

  const candidates = [];
  const targetRow = getTargetRowRatio(input) * Math.max(rowCount - 1, 1);

  // 以每一个允许排为中心尝试组合；优先同排、靠中间的分区，必要时才扩展到邻排。
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    if (!rowIsAllowed(rowIndex, rowCount, input)) continue;

    const selected = selectSplitGroupSeats({
      components,
      peopleCount: input.peopleCount,
      needAccessibility: input.needAccessibility,
      targetRow: rowIndex,
    });

    if (selected.length !== input.peopleCount) continue;
    if (input.needAccessibility && !selected.some((seat) => seat.isAccessibility)) continue;

    const componentCount = countSeatComponents(selected);
    if (componentCount < 2) continue;

    const candidate = scoreSeatBlock({ block: selected, allSeats: seats, seatState, input, hall });
    candidate.isSplitGroup = true;
    candidate.componentCount = componentCount;
    candidate.targetRowDistance = Math.abs(rowIndex - targetRow);
    candidates.push(candidate);
  }

  return candidates
    .sort((a, b) => b.scoreValue - a.scoreValue || a.targetRowDistance - b.targetRowDistance);
}

function getAvailableComponents(rowSeats, seatState, input) {
  const components = [];
  let component = [];

  rowSeats.forEach((seat) => {
    const previous = component[component.length - 1];
    const continues = previous && seat.cellIndex === previous.cellIndex + 1;
    const available = isSeatAvailable(seat.seatId, seatState, input.selectedScheduleId);

    if (!available || !continues && component.length > 0) {
      if (component.length > 0) components.push(component);
      component = [];
    }

    if (available) component.push(seat);
  });

  if (component.length > 0) components.push(component);
  return components;
}

function selectSplitGroupSeats({ components, peopleCount, needAccessibility, targetRow }) {
  const rankedComponents = [...components].sort((left, right) => (
    getComponentPriority(left, targetRow) - getComponentPriority(right, targetRow)
  ));
  const selected = [];
  let remaining = peopleCount;

  if (needAccessibility) {
    const accessible = rankedComponents.find((component) => component.some((seat) => seat.isAccessibility));
    if (!accessible) return [];
    const picked = takeComponentSeats(accessible, Math.min(remaining, accessible.length), true);
    selected.push(...picked);
    remaining -= picked.length;
  }

  for (const component of rankedComponents) {
    if (remaining === 0) break;
    if (selected.some((seat) => component.includes(seat))) continue;
    const picked = takeComponentSeats(component, Math.min(remaining, component.length), false);
    selected.push(...picked);
    remaining -= picked.length;
  }

  return selected;
}

function getComponentPriority(component, targetRow) {
  const rowDistance = Math.abs(component[0].rowIndex - targetRow);
  const center = component.reduce((sum, seat) => sum + (seat.cellIndex + 0.5) / seat.rowLength, 0) / component.length;
  return rowDistance * 4 + Math.abs(center - 0.5) * 2;
}

function takeComponentSeats(component, count, requireAccessibility) {
  if (count >= component.length) return [...component];

  let best = component.slice(0, count);
  let bestPriority = Number.POSITIVE_INFINITY;

  for (let start = 0; start <= component.length - count; start += 1) {
    const slice = component.slice(start, start + count);
    if (requireAccessibility && !slice.some((seat) => seat.isAccessibility)) continue;
    const center = slice.reduce((sum, seat) => sum + (seat.cellIndex + 0.5) / seat.rowLength, 0) / slice.length;
    const priority = Math.abs(center - 0.5);
    if (priority < bestPriority) {
      best = slice;
      bestPriority = priority;
    }
  }

  return best;
}

function countSeatComponents(seats) {
  const sorted = [...seats].sort((left, right) => left.rowIndex - right.rowIndex || left.cellIndex - right.cellIndex);
  return sorted.reduce((count, seat, index) => {
    if (index === 0) return 1;
    const previous = sorted[index - 1];
    return count + (seat.rowIndex !== previous.rowIndex || seat.cellIndex !== previous.cellIndex + 1 ? 1 : 0);
  }, 0);
}

function scoreSeatBlock({ block, allSeats, seatState, input, hall }) {
  const rowCount = hall.rows.length;
  const rowRatio =
    block.reduce((sum, seat) => sum + seat.rowIndex, 0) /
    Math.max(block.length * (rowCount - 1), 1);
  const centerRatio =
    block.reduce((sum, seat) => sum + (seat.cellIndex + 0.5) / seat.rowLength, 0) /
    block.length;
  const angle = clamp01(1 - Math.abs(centerRatio - 0.5) * 2);
  const distance = clamp01(1 - Math.abs(rowRatio - getTargetRowRatio(input)) / 0.55);
  const spacing = calculateSpacingScore(block, allSeats, seatState, input.selectedScheduleId);
  const preference = calculatePreferenceScore(block, input, centerRatio, rowRatio);
  const scoreValue = Math.round(clamp(angle * 25 + distance * 25 + spacing * 15 + preference * 35, 0, 100));
  const score = getScoreGrade(scoreValue);

  return {
    seatIds: block.map((seat) => seat.seatId),
    block,
    score,
    scoreValue,
    scoreDetails: {
      angle: round(angle),
      distance: round(distance),
      spacing: round(spacing),
      preference: round(preference),
    },
    recommendedArea: getAreaName(rowRatio, centerRatio),
  };
}

function calculateSpacingScore(block, allSeats, seatState, selectedScheduleId) {
  const selectedIds = new Set(block.map((seat) => seat.seatId));
  const byPosition = new Map(
    allSeats.map((seat) => [`${seat.rowIndex}-${seat.seatNumber}`, seat]),
  );
  const neighborOffsets = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  let availableCount = 0;
  let checkedCount = 0;

  block.forEach((seat) => {
    neighborOffsets.forEach(([rowOffset, numberOffset]) => {
      const neighbor = byPosition.get(`${seat.rowIndex + rowOffset}-${seat.seatNumber + numberOffset}`);

      if (!neighbor || selectedIds.has(neighbor.seatId)) {
        return;
      }

      checkedCount += 1;

      if (isSeatAvailable(neighbor.seatId, seatState, selectedScheduleId)) {
        availableCount += 1;
      }
    });
  });

  return checkedCount === 0 ? 0.7 : clamp01(availableCount / checkedCount);
}

function calculatePreferenceScore(block, input, centerRatio, rowRatio) {
  const preferenceMode = input.preferenceMode || "none";
  const aisleRatio = block.filter((seat) => touchesAisle(seat)).length / Math.max(1, block.length);

  if (preferenceMode === "center") {
    return clamp01(0.15 + (1 - Math.abs(centerRatio - 0.5) * 2) * 0.85);
  }

  if (preferenceMode === "back") {
    return rowRatio >= 0.45 && rowRatio <= 0.86
      ? clamp01(0.3 + rowRatio * 0.7)
      : 0.18;
  }

  if (preferenceMode === "aisle") {
    return clamp01(0.12 + aisleRatio * 0.88);
  }

  let score = 0.55;

  if (input.ticketType === "couple" && block.length === 2) {
    score += 0.08;
  }

  if (input.ticketType === "family" && rowRatio >= 0.42) {
    score += 0.08;
  }

  if (input.ticketType === "group" && block.length === input.peopleCount) {
    score += 0.1;
  }

  return clamp01(score);
}

function buildResult({ best, fallback, input }) {
  const warnings = [...input.warnings];

  if (best.isSplitGroup) {
    warnings.push(`未找到 ${input.peopleCount} 个同排连续空座，已拆分为 ${best.componentCount} 个相邻座位区。`);
  }

  if (input.hasTeen) {
    warnings.push("含 15 岁以下少年，推荐已避开前三排。");
  }

  if (input.hasSenior) {
    warnings.push(
      input.needAccessibility
        ? "含 60 岁以上老年人；无障碍需求优先，必要时会放宽最后三排限制。"
        : "含 60 岁以上老年人，推荐已避开最后三排。",
    );
  }

  return {
    recommendedSeatIds: best.seatIds,
    fallbackSeatIds: fallback?.seatIds ?? [],
    score: best.score,
    scoreLabel: SCORE_LABELS[best.score],
    scoreValue: best.scoreValue,
    reasons: buildReasons(best, input),
    recommendedArea: best.recommendedArea,
    warnings,
    scoreDetails: best.scoreDetails,
  };
}

function buildReasons(candidate, input) {
  const reasons = [
    candidate.isSplitGroup
      ? `${input.ticketTypeLabel}已在 ${candidate.componentCount} 个相邻座位区匹配 ${input.peopleCount} 个空座。`
      : `${input.ticketTypeLabel}已匹配 ${input.peopleCount} 个同排连续空座。`,
  ];

  if (candidate.scoreDetails.angle >= 0.8) {
    reasons.push("座位靠近影厅中轴线，水平视角更自然。");
  } else {
    reasons.push(
      candidate.isSplitGroup
        ? "当前可用座位区满足人数要求，但横向视角略偏。"
        : "当前可用连座满足人数要求，但横向视角略偏。",
    );
  }

  if (candidate.scoreDetails.distance >= 0.8) {
    reasons.push("排距处于舒适观影区，既不过近也不过远。");
  } else {
    reasons.push("与银幕距离可接受，适合作为当前余票下的推荐。");
  }

  if (candidate.scoreDetails.spacing >= 0.7) {
    reasons.push("周边仍有较多空座，入座和观影干扰较少。");
  }

  return reasons;
}

function buildEmptyResult(input, hall) {
  const warnings = [...input.warnings, "未找到完全满足人数、年龄和连座规则的空座。"];

  if (input.hasTeen) warnings.push("少年规则会排除前三排。");
  if (input.hasSenior) warnings.push("老人规则会排除最后三排。");

  return {
    recommendedSeatIds: [],
    fallbackSeatIds: [],
    score: "normal",
    scoreLabel: SCORE_LABELS.normal,
    scoreValue: 0,
    reasons: [`当前 ${hall.hallName ?? "影厅"} 余票不足，建议减少人数或切换场次。`],
    recommendedArea: "",
    warnings,
    scoreDetails: {
      angle: 0,
      distance: 0,
      spacing: 0,
      preference: 0,
    },
  };
}

function formatDebugReport({ input, schedule, hall, seatState, result, candidates }) {
  const lines = [];

  lines.push("SmartCinema 推荐调试报告");
  lines.push("==========================");
  lines.push(`场次: ${schedule?.scheduleId ?? input.selectedScheduleId ?? "未指定"}`);
  lines.push(`影厅: ${hall?.hallName ?? "未指定"} (${hall?.hallId ?? "unknown"})`);
  lines.push(`票种/人数: ${input.ticketTypeLabel} / ${input.peopleCount} 人`);
  lines.push(`年龄: ${input.ages.length ? input.ages.join(", ") : "未填写，按成年人补齐"}`);
  lines.push(`偏好: ${formatPreferences(input.preferences, input.preferenceMode)}`);
  lines.push("");
  lines.push("座位状态概览");
  lines.push("----------------");
  lines.push(formatSeatStateSummary(summarizeSeatState(seatState, input.selectedScheduleId)));
  lines.push("");
  lines.push("推荐结果");
  lines.push("----------------");
  lines.push(`首选: ${result.recommendedSeatIds.join(", ") || "暂无"}`);
  lines.push(`备选: ${result.fallbackSeatIds.join(", ") || "暂无"}`);
  lines.push(`评分: ${result.scoreLabel} (${result.scoreValue}/100), 区域: ${result.recommendedArea || "暂无"}`);
  lines.push(
    `分项: 视角 ${result.scoreDetails.angle}, 距离 ${result.scoreDetails.distance}, 周边空位 ${result.scoreDetails.spacing}, 偏好 ${result.scoreDetails.preference}`,
  );
  lines.push(`原因: ${result.reasons.join("；")}`);
  if (result.warnings.length) lines.push(`规则提醒: ${result.warnings.join("；")}`);
  lines.push("");
  lines.push("候选 Top 5");
  lines.push("----------------");

  if (candidates.length === 0) {
    lines.push("无候选连座。");
  } else {
    candidates.slice(0, 5).forEach((candidate, index) => {
      lines.push(
        `${index + 1}. ${candidate.seatIds.join(", ")} | ${SCORE_LABELS[candidate.score]} ${
          candidate.scoreValue
        } | ${candidate.recommendedArea} | angle=${candidate.scoreDetails.angle}, distance=${
          candidate.scoreDetails.distance
        }, spacing=${candidate.scoreDetails.spacing}, preference=${candidate.scoreDetails.preference}`,
      );
    });
  }

  return lines.join("\n");
}

function summarizeHall(hall) {
  if (!hall?.rows?.length) {
    return { hallId: "", hallName: "", rowCount: 0, capacity: 0 };
  }

  return {
    hallId: hall.hallId,
    hallName: hall.hallName,
    rowCount: hall.rows.length,
    capacity: buildSeatIndex(hall).length,
  };
}

function summarizeSeatState(seatState, selectedScheduleId) {
  const filteredSeatState = selectedScheduleId
    ? seatState.filter((seat) => !seat.scheduleId || seat.scheduleId === selectedScheduleId)
    : seatState;
  const summary = {
    total: filteredSeatState.length,
    available: 0,
    selected: 0,
    reserved: 0,
    sold: 0,
  };

  filteredSeatState.forEach((seat) => {
    if (summary[seat.status] !== undefined) {
      summary[seat.status] += 1;
    }
  });

  return summary;
}

function formatSeatStateSummary(summary) {
  return `total=${summary.total}, available=${summary.available}, selected=${summary.selected}, reserved=${summary.reserved}, sold=${summary.sold}`;
}

function formatPreferences(preferences, preferenceMode = "none") {
  const names = [];
  if (preferenceMode === "center" || preferences.preferCenter) names.push("中区");
  if (preferenceMode === "back" || preferences.preferBack) names.push("中后排");
  if (preferenceMode === "aisle" || preferences.preferAisle) names.push("靠过道");
  if (preferences.accessibilityNeeded) names.push("无障碍");
  return names.length ? names.join("、") : "无";
}

function rowIsAllowed(rowIndex, rowCount, input) {
  // 无障碍需求属于硬约束，优先于年龄带来的排数建议。
  // 实际候选仍必须包含 W 座位，不会因此推荐普通座位。
  if (input.needAccessibility) return true;
  if (input.hasTeen && rowIndex < 3) return false;
  if (input.hasSenior && rowIndex >= rowCount - 3) return false;
  return true;
}

function isSeatAvailable(seatId, seatState, selectedScheduleId) {
  const state = seatState.find((item) => {
    if (item.seatId !== seatId) return false;
    if (!selectedScheduleId || !item.scheduleId) return true;
    return item.scheduleId === selectedScheduleId;
  });

  return !state || state.status === "available";
}

function getTargetRowRatio(input) {
  if (input.preferenceMode === "back") return 0.72;
  if (input.ticketType === "family") return 0.6;
  if (input.ticketType === "group") return input.hasSenior ? 0.52 : 0.62;
  if (input.hasSenior && input.hasTeen) return 0.5;
  if (input.hasSenior) return 0.45;
  if (input.hasTeen) return 0.58;
  return 0.55;
}

function getAreaName(rowRatio, centerRatio) {
  const rowArea = rowRatio < 0.34 ? "front" : rowRatio > 0.66 ? "back" : "middle";
  const columnArea = Math.abs(centerRatio - 0.5) <= 0.18 ? "center" : "side";

  if (rowArea === "middle" && columnArea === "center") return "middle-center";
  if (rowArea === "back" && columnArea === "center") return "middle-back";
  return `${rowArea}-${columnArea}`;
}

function getScoreGrade(scoreValue) {
  if (scoreValue >= 85) return "excellent";
  if (scoreValue >= 65) return "good";
  return "normal";
}

function hasSeatOverlap(firstSeatIds, secondSeatIds) {
  const firstSet = new Set(firstSeatIds);
  return secondSeatIds.some((seatId) => firstSet.has(seatId));
}

function isSeatCell(cellType) {
  return cellType === "S" || cellType === "W";
}

function touchesAisle(seat) {
  const previousCell = seat.rowPattern[seat.cellIndex - 1];
  const nextCell = seat.rowPattern[seat.cellIndex + 1];
  return previousCell === "A" || nextCell === "A" || previousCell === undefined || nextCell === undefined;
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
