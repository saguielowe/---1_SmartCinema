// 这是状态模块的占位样例，避免其他模块直接互相读写全局变量。
// 认领后需要自行实现 LocalStorage、订单、用户认证和热度数据。

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
