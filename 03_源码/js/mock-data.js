// 公共测试数据：先让各模块有统一的假数据可跑，后面再逐步替换成真实流程。

export const hallMock = {
  hallId: "hall-imax",
  hallName: "IMAX厅",
  hallType: "imax",
  screenLabel: "银幕",
  rows: [
    { rowLabel: "A", pattern: "XXXSSSSAASSSSXXX", offsetX: -12, curveDepth: 12 },
    { rowLabel: "B", pattern: "XXSSSSSAASSSSSXX", offsetX: -8, curveDepth: 11 },
    { rowLabel: "C", pattern: "XSSSSSSAASSSSSSX", offsetX: -4, curveDepth: 10 },
    { rowLabel: "D", pattern: "SSSSSSSAASSSSSSS", offsetX: 0, curveDepth: 9 },
    { rowLabel: "E", pattern: "SSSSSSSAASSSSSSS", offsetX: 0, curveDepth: 8 },
    { rowLabel: "F", pattern: "SSSSSSSAASSSSSSS", offsetX: 0, curveDepth: 7 },
    { rowLabel: "G", pattern: "XSSSSSSAASSSSSSX", offsetX: 4, curveDepth: 8 },
    { rowLabel: "H", pattern: "XXSSSSSAASSSSSXX", offsetX: 8, curveDepth: 9 },
  ],
};

export const seatStateMock = [
  { scheduleId: "s001", seatId: "D-8", status: "sold" },
  { scheduleId: "s001", seatId: "D-9", status: "sold" },
  { scheduleId: "s001", seatId: "E-8", status: "selected" },
  { scheduleId: "s001", seatId: "F-10", status: "reserved" },
];
