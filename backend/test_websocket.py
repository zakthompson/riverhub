#!/usr/bin/env python3
"""
Simple WebSocket test client for testing RFID server.
Tests both card read broadcasts and write requests.
"""
import asyncio
import json
import websockets


async def test_websocket():
    uri = "ws://localhost:8765/ws"
    print(f"Connecting to {uri}...")

    try:
        async with websockets.connect(uri) as websocket:
            print("✓ Connected to WebSocket server")

            # Listen for card read messages for 15 seconds
            print("\nListening for card reads (15 seconds)...")

            async def receive_messages():
                """Receive and display card read broadcasts"""
                while True:
                    try:
                        message = await websocket.recv()
                        data = json.loads(message)
                        print(f"📡 Received: {json.dumps(data, indent=2)}")
                    except websockets.exceptions.ConnectionClosed:
                        print("Connection closed")
                        break
                    except Exception as e:
                        print(f"Error receiving message: {e}")
                        break

            # Start listening task
            listen_task = asyncio.create_task(receive_messages())

            # Wait a bit to receive some card reads
            await asyncio.sleep(10)

            # Send a write request
            print("\n📝 Sending write request...")
            write_request = {
                "type": "write_request",
                "data": "spotify:playlist:TEST123"
            }
            await websocket.send(json.dumps(write_request))
            print(f"Sent: {json.dumps(write_request, indent=2)}")

            # Wait a bit more to see the response and more card reads
            await asyncio.sleep(5)

            # Cancel listening task
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass

            print("\n✓ Test completed successfully!")

    except ConnectionRefusedError:
        print("✗ Connection refused. Is the server running?")
        print("  Start the server with: python main.py")
    except Exception as e:
        print(f"✗ Error: {e}")


if __name__ == "__main__":
    asyncio.run(test_websocket())
