const DEFAULT_WEBSOCKET_URL = "ws://127.0.0.1:8765";
const CHANNEL_NAME = "smartcinema-realtime-v1";

export function createRealtimeSeatClient({
  websocketUrl = DEFAULT_WEBSOCKET_URL,
  onStatus = () => {},
  onRemoteSelections = () => {},
} = {}) {
  const clientId = globalThis.crypto?.randomUUID?.() ||
    `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const remoteSelections = new Map();
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  let socket = null;
  let reconnectTimer = 0;
  let activeScheduleId = "";
  let destroyed = false;

  channel?.addEventListener("message", (event) => {
    applyRealtimeMessage(event.data, { source: "broadcast" });
  });

  function connect() {
    if (destroyed || !("WebSocket" in window)) {
      updateStatus();
      return;
    }

    onStatus({ state: "connecting", label: "多人同步连接中…" });
    try {
      socket = new WebSocket(websocketUrl);
    } catch {
      scheduleReconnect();
      updateStatus();
      return;
    }

    socket.addEventListener("open", () => {
      sendSocketMessage({ type: "hello", clientId });
      updateStatus();
    });

    socket.addEventListener("message", (event) => {
      try {
        applyRealtimeMessage(JSON.parse(event.data), { source: "websocket" });
      } catch {
        // 忽略格式错误的模拟消息，避免影响本地选座主流程。
      }
    });

    socket.addEventListener("close", () => {
      socket = null;
      updateStatus();
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket?.close();
    });
  }

  function scheduleReconnect() {
    if (destroyed || reconnectTimer) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect();
    }, 2400);
  }

  function setActiveSchedule(scheduleId) {
    const nextScheduleId = scheduleId || "";
    if (activeScheduleId && activeScheduleId !== nextScheduleId) {
      publishMessage({
        type: "seat-preview",
        clientId,
        scheduleId: activeScheduleId,
        seatIds: [],
      });
    }
    activeScheduleId = nextScheduleId;
    emitRemoteSelections();
  }

  function publishSelection(scheduleId, seatIds) {
    if (!scheduleId) return;
    publishMessage({
      type: "seat-preview",
      clientId,
      scheduleId,
      seatIds: [...new Set(seatIds || [])],
    });
  }

  function publishMessage(message) {
    sendSocketMessage(message);
    channel?.postMessage(message);
  }

  function sendSocketMessage(message) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  function applyRealtimeMessage(message, { source } = {}) {
    if (!message || message.clientId === clientId) return;

    if (message.type === "snapshot") {
      remoteSelections.clear();
      (message.selections || []).forEach((selection) => {
        if (selection.clientId !== clientId) {
          remoteSelections.set(selection.clientId, {
            scheduleId: selection.scheduleId,
            seatIds: [...new Set(selection.seatIds || [])],
          });
        }
      });
    } else if (message.type === "seat-preview") {
      if (!message.scheduleId || !(message.seatIds || []).length) {
        remoteSelections.delete(message.clientId);
      } else {
        remoteSelections.set(message.clientId, {
          scheduleId: message.scheduleId,
          seatIds: [...new Set(message.seatIds || [])],
        });
      }
    } else if (message.type === "client-left") {
      remoteSelections.delete(message.clientId);
    } else {
      return;
    }

    emitRemoteSelections();
    if (source === "broadcast" && socket?.readyState !== WebSocket.OPEN) {
      updateStatus();
    }
  }

  function emitRemoteSelections() {
    const activeSelections = [...remoteSelections.entries()]
      .filter(([, selection]) => selection.scheduleId === activeScheduleId);
    onRemoteSelections({
      seatIds: [...new Set(activeSelections.flatMap(([, selection]) => selection.seatIds))],
      clientCount: activeSelections.length,
    });
    updateStatus(activeSelections.length);
  }

  function updateStatus(activeClientCount = 0) {
    if (socket?.readyState === WebSocket.OPEN) {
      onStatus({
        state: "online",
        label: `WebSocket 已连接${activeClientCount ? ` · ${activeClientCount} 位观众正在选座` : ""}`,
      });
      return;
    }
    if (channel) {
      onStatus({
        state: "fallback",
        label: `本机多标签模拟${activeClientCount ? ` · ${activeClientCount} 位观众正在选座` : ""}`,
      });
      return;
    }
    onStatus({ state: "offline", label: "实时协同不可用" });
  }

  function destroy() {
    destroyed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (activeScheduleId) {
      publishMessage({
        type: "seat-preview",
        clientId,
        scheduleId: activeScheduleId,
        seatIds: [],
      });
    }
    socket?.close();
    channel?.close();
    remoteSelections.clear();
  }

  connect();

  return {
    clientId,
    setActiveSchedule,
    publishSelection,
    destroy,
  };
}
