import assert from "node:assert/strict";
import {
  extractPeopleCount,
  parseAdvisorRequest,
  parseChineseNumber,
} from "../03_源码/js/advisor.js";

assert.equal(extractPeopleCount("一家四口"), 4);
assert.equal(extractPeopleCount("8人团体"), 8);
assert.equal(parseChineseNumber("十二"), 12);
assert.equal(parseChineseNumber("二十"), 20);

assert.deepEqual(
  parseAdvisorRequest("一家四口，有孩子，希望靠过道方便进出，也比较怕吵"),
  {
    peopleCount: 4,
    ticketType: "family",
    preference: "aisle",
    hasTeen: true,
    hasSenior: false,
    needAccessibility: false,
    wantsAisle: true,
    wantsQuiet: true,
    wantsBack: false,
    wantsCenter: false,
  },
);

const seniorGroup = parseAdvisorRequest("8人团体，有老人，希望视角好一些");
assert.equal(seniorGroup.peopleCount, 8);
assert.equal(seniorGroup.ticketType, "group");
assert.equal(seniorGroup.hasSenior, true);
assert.equal(seniorGroup.wantsCenter, true);

const accessibleCouple = parseAdvisorRequest("情侣约会，两位，其中一位坐轮椅");
assert.equal(accessibleCouple.peopleCount, 2);
assert.equal(accessibleCouple.ticketType, "couple");
assert.equal(accessibleCouple.needAccessibility, true);

console.log("advisor intent regression tests passed");
