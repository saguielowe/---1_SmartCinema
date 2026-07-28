"""SmartCinema minimal WebSocket server.

Only Python's standard library is used. The server broadcasts temporary seat
selections so multiple browser tabs or devices on the same computer can see
one another's in-progress choices.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import struct
from collections.abc import Iterable


WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_MESSAGE_SIZE = 64 * 1024


class RealtimeSeatServer:
    def __init__(self) -> None:
        self.clients: dict[asyncio.StreamWriter, str] = {}
        self.selections: dict[str, dict[str, object]] = {}

    async def handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        client_id = ""
        try:
            headers = await self._read_handshake(reader)
            websocket_key = headers.get("sec-websocket-key", "")
            if not websocket_key:
                raise ValueError("Missing Sec-WebSocket-Key")

            accept = base64.b64encode(
                hashlib.sha1(f"{websocket_key}{WEBSOCKET_GUID}".encode("ascii")).digest()
            ).decode("ascii")
            writer.write(
                (
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    f"Sec-WebSocket-Accept: {accept}\r\n"
                    "\r\n"
                ).encode("ascii")
            )
            await writer.drain()

            while True:
                opcode, payload = await self._read_frame(reader)
                if opcode == 0x8:
                    break
                if opcode == 0x9:
                    await self._send_frame(writer, payload, opcode=0xA)
                    continue
                if opcode != 0x1:
                    continue

                message = json.loads(payload.decode("utf-8"))
                message_type = message.get("type")
                if message_type == "hello":
                    client_id = str(message.get("clientId", ""))[:120]
                    if not client_id:
                        continue
                    self.clients[writer] = client_id
                    await self._send_json(
                        writer,
                        {
                            "type": "snapshot",
                            "clientId": "server",
                            "selections": [
                                {
                                    "clientId": other_client_id,
                                    **selection,
                                }
                                for other_client_id, selection in self.selections.items()
                                if other_client_id != client_id
                            ],
                        },
                    )
                    continue

                if message_type == "seat-preview" and client_id:
                    schedule_id = str(message.get("scheduleId", ""))[:120]
                    seat_ids = self._sanitize_seat_ids(message.get("seatIds", []))
                    if schedule_id and seat_ids:
                        self.selections[client_id] = {
                            "scheduleId": schedule_id,
                            "seatIds": seat_ids,
                        }
                    else:
                        self.selections.pop(client_id, None)

                    await self._broadcast(
                        {
                            "type": "seat-preview",
                            "clientId": client_id,
                            "scheduleId": schedule_id,
                            "seatIds": seat_ids,
                        },
                        exclude=writer,
                    )
        except (
            asyncio.IncompleteReadError,
            ConnectionError,
            json.JSONDecodeError,
            UnicodeDecodeError,
            ValueError,
        ):
            pass
        finally:
            registered_client_id = self.clients.pop(writer, client_id)
            if registered_client_id:
                self.selections.pop(registered_client_id, None)
                await self._broadcast(
                    {
                        "type": "client-left",
                        "clientId": registered_client_id,
                    },
                    exclude=writer,
                )
            writer.close()
            try:
                await writer.wait_closed()
            except ConnectionError:
                pass

    async def _read_handshake(self, reader: asyncio.StreamReader) -> dict[str, str]:
        raw_headers = await asyncio.wait_for(
            reader.readuntil(b"\r\n\r\n"),
            timeout=5,
        )
        if len(raw_headers) > 16 * 1024:
            raise ValueError("Handshake is too large")
        lines = raw_headers.decode("latin-1").split("\r\n")
        if not lines or not lines[0].startswith("GET "):
            raise ValueError("Invalid WebSocket request")
        headers: dict[str, str] = {}
        for line in lines[1:]:
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
        if headers.get("upgrade", "").lower() != "websocket":
            raise ValueError("Upgrade header is not websocket")
        return headers

    async def _read_frame(self, reader: asyncio.StreamReader) -> tuple[int, bytes]:
        first, second = await reader.readexactly(2)
        opcode = first & 0x0F
        is_masked = bool(second & 0x80)
        payload_length = second & 0x7F
        if payload_length == 126:
            payload_length = struct.unpack("!H", await reader.readexactly(2))[0]
        elif payload_length == 127:
            payload_length = struct.unpack("!Q", await reader.readexactly(8))[0]
        if payload_length > MAX_MESSAGE_SIZE:
            raise ValueError("WebSocket message is too large")
        if not is_masked:
            raise ValueError("Client frames must be masked")
        mask = await reader.readexactly(4)
        payload = await reader.readexactly(payload_length)
        return opcode, bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

    async def _send_json(
        self,
        writer: asyncio.StreamWriter,
        message: dict[str, object],
    ) -> None:
        await self._send_frame(
            writer,
            json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        )

    async def _send_frame(
        self,
        writer: asyncio.StreamWriter,
        payload: bytes,
        *,
        opcode: int = 0x1,
    ) -> None:
        first = 0x80 | opcode
        length = len(payload)
        if length < 126:
            header = bytes((first, length))
        elif length <= 0xFFFF:
            header = bytes((first, 126)) + struct.pack("!H", length)
        else:
            header = bytes((first, 127)) + struct.pack("!Q", length)
        writer.write(header + payload)
        await writer.drain()

    async def _broadcast(
        self,
        message: dict[str, object],
        *,
        exclude: asyncio.StreamWriter | None = None,
    ) -> None:
        recipients = [
            writer
            for writer in self.clients
            if writer is not exclude and not writer.is_closing()
        ]
        if not recipients:
            return
        results = await asyncio.gather(
            *(self._send_json(writer, message) for writer in recipients),
            return_exceptions=True,
        )
        for writer, result in zip(recipients, results, strict=False):
            if isinstance(result, Exception):
                writer.close()

    @staticmethod
    def _sanitize_seat_ids(value: object) -> list[str]:
        if not isinstance(value, Iterable) or isinstance(value, (str, bytes, dict)):
            return []
        unique: list[str] = []
        for item in value:
            seat_id = str(item)[:40]
            if seat_id and seat_id not in unique:
                unique.append(seat_id)
            if len(unique) >= 300:
                break
        return unique


async def run_server(host: str, port: int) -> None:
    realtime_server = RealtimeSeatServer()
    server = await asyncio.start_server(realtime_server.handle_client, host, port)
    addresses = ", ".join(str(socket.getsockname()) for socket in server.sockets or [])
    print(f"[SmartCinema] WebSocket realtime server listening on {addresses}", flush=True)
    async with server:
        await server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="SmartCinema WebSocket realtime server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()
    try:
        asyncio.run(run_server(args.host, args.port))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
