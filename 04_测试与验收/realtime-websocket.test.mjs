import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const python = process.env.SMARTCINEMA_TEST_PYTHON || "python";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverScript = path.join(projectRoot, "scripts", "realtime-server.py");
const port = 8876;
const server = spawn(
  python,
  [serverScript, "--host", "127.0.0.1", "--port", String(port)],
  {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverError = "";
server.stderr.setEncoding("utf8");
server.stderr.on("data", (chunk) => {
  serverError += chunk;
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket server startup timed out")), 5000);
    server.stdout.setEncoding("utf8");
    server.stdout.on("data", (chunk) => {
      if (chunk.includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket server exited with ${code}: ${serverError}`));
    });
  });
}

function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket open timed out")), 3000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket open failed"));
    }, { once: true });
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Expected WebSocket message was not received"));
    }, 3000);
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    };
    socket.addEventListener("message", onMessage);
  });
}

let clientA;
let clientB;

try {
  await waitForServer();
  clientA = new WebSocket(`ws://127.0.0.1:${port}`);
  clientB = new WebSocket(`ws://127.0.0.1:${port}`);
  await Promise.all([waitForOpen(clientA), waitForOpen(clientB)]);

  const snapshotA = waitForMessage(clientA, (message) => message.type === "snapshot");
  const snapshotB = waitForMessage(clientB, (message) => message.type === "snapshot");
  clientA.send(JSON.stringify({ type: "hello", clientId: "test-client-a" }));
  clientB.send(JSON.stringify({ type: "hello", clientId: "test-client-b" }));
  await Promise.all([snapshotA, snapshotB]);

  const remoteSelection = waitForMessage(
    clientB,
    (message) => message.type === "seat-preview" && message.clientId === "test-client-a",
  );
  clientA.send(JSON.stringify({
    type: "seat-preview",
    clientId: "test-client-a",
    scheduleId: "s002",
    seatIds: ["A-1", "A-2", "A-3"],
  }));
  assert.deepEqual(
    (await remoteSelection).seatIds,
    ["A-1", "A-2", "A-3"],
    "第二个客户端应收到第一个客户端的实时选座",
  );

  const clientLeft = waitForMessage(
    clientB,
    (message) => message.type === "client-left" && message.clientId === "test-client-a",
  );
  clientA.close();
  assert.equal((await clientLeft).clientId, "test-client-a");

  console.log("realtime WebSocket regression tests passed");
} finally {
  clientA?.close();
  clientB?.close();
  server.kill();
}
