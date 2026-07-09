// C: 负责登录状态、订单、LocalStorage 和热度数据。
// 当前先提供一个最小状态容器，避免 A / B / D 直接互相读写全局变量。

export function createStore(initialState) {
  const state = {
    hall: initialState.hall,
    seatState: initialState.seatState,
  };

  return {
    getHall() {
      return state.hall;
    },
    getSeatState() {
      return state.seatState;
    },
    setSeatState(nextSeatState) {
      state.seatState = nextSeatState;
    },
  };
}
