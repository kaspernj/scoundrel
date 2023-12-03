import asyncio
import json
import os
import websockets

async def handler(websocket, path):
  raw_data = await websocket.recv()
  data = json.loads(raw_data)

  reply = f"Data recieved as: {data}!"

  await websocket.send(reply)

start_server = websockets.serve(handler, "127.0.0.1", 8080)

print(f'Started with PID {os.getpid()}', flush=True)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
