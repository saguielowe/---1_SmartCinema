/**
 * 将自然语言观影需求转换成推荐算法所需的结构化条件。
 * 这是一个完全在浏览器本地运行的轻量意图解析器，不上传用户输入。
 */
export function parseAdvisorRequest(question) {
  const normalizedQuestion = String(question || "").trim();
  const peopleCount = extractPeopleCount(normalizedQuestion);
  const isCouple = /情侣|约会|两口子|二人世界/.test(normalizedQuestion);
  const isFamily = /家庭|一家|家人|亲子/.test(normalizedQuestion);
  const isGroup = /团体|团队|同学|朋友们|公司|集体/.test(normalizedQuestion);
  const hasTeen = /儿童|孩子|小孩|少年|学生娃|15\s*岁以下/.test(normalizedQuestion);
  const hasSenior = /老人|老年|长辈|父母|爷爷|奶奶|60\s*岁以上/.test(normalizedQuestion);
  const needAccessibility = /无障碍|轮椅|行动不便|腿脚不便|残障/.test(normalizedQuestion);
  const wantsAisle = /过道|方便进出|容易出去|厕所|出入口|便捷/.test(normalizedQuestion);
  const wantsQuiet = /安静|怕吵|噪音|少打扰|不被打扰/.test(normalizedQuestion);
  const wantsBack = /后排|中后排|靠后/.test(normalizedQuestion);
  const wantsCenter = /中间|中央|视角|正对|最佳位置/.test(normalizedQuestion);
  const normalizedPeopleCount = Math.min(
    20,
    Math.max(
      1,
      peopleCount || (isCouple ? 2 : isFamily ? 3 : isGroup ? 5 : 1),
    ),
  );
  const ticketType = isCouple
    ? "couple"
    : isFamily
      ? "family"
      : isGroup || normalizedPeopleCount > 2
        ? "group"
        : normalizedPeopleCount === 1
          ? "single"
          : "group";
  const preference = wantsAisle
    ? "aisle"
    : wantsQuiet || wantsBack
      ? "back"
      : "center";

  return {
    peopleCount: ticketType === "couple" ? 2 : normalizedPeopleCount,
    ticketType,
    preference,
    hasTeen,
    hasSenior,
    needAccessibility,
    wantsAisle,
    wantsQuiet,
    wantsBack,
    wantsCenter,
  };
}

export function extractPeopleCount(question) {
  const normalizedQuestion = String(question || "");
  const arabicMatch = normalizedQuestion.match(/(\d{1,2})\s*(?:人|位|个|口)/);
  if (arabicMatch) return Number.parseInt(arabicMatch[1], 10);

  const chineseMatch = normalizedQuestion.match(/([一二两三四五六七八九十]{1,3})\s*(?:人|位|个|口)/);
  if (!chineseMatch) return 0;
  return parseChineseNumber(chineseMatch[1]);
}

export function parseChineseNumber(value) {
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, units] = value.split("十");
    return (digits[tens] || 1) * 10 + (digits[units] || 0);
  }
  return digits[value] || 0;
}
