#!/usr/bin/env python3

import argparse
import asyncio
import collections.abc
import importlib
import json
import os
import websockets

def debug(message):
  print(message, flush=True)

class WebSocketClient:
  def __init__(self, ws):
    self.ws = ws
    self.running = True
    self.objects = {}
    self.objects_count = 0
    debug("WebSocketClient initialized")

  async def listen(self):
    debug("Starting running loop")

    while self.running:
      raw_data = await self.ws.recv()

      debug(f"Raw data received: {raw_data}")

      data = json.loads(raw_data)
      command = data["data"]["command"]
      command_id = data["command_id"]

      debug(f"Data recieved as: {data}!")

      command_method = getattr(self, f"command_{command}")

      if command_method:
        try:
          await command_method(command_id, data["data"])
        except Exception as error:
          await self.respond_with_error(command_id, str(error))
          raise
          return
      else:
        await self.respond_with_error(command_id, f'No such command {command}')

  async def respond_to_command(self, command_id, data):
    data = {"type": "command_response", "command_id": command_id, "data": data}
    data_json = json.dumps(data)

    debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def respond_with_error(self, command_id, error):
    data = {"type": "command_response", "command_id": command_id, "error": error}
    data_json = json.dumps(data)

    debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def command_new_object_with_reference(self, command_id, data):
    class_name = data["class_name"]

    if class_name == "[]":
      instance = []
    else:
      klass = eval(class_name)
      instance = klass()

    object_id = self.spawn_object(instance)

    await self.respond_to_command(command_id, {"object_id": object_id})

  async def command_call_method_on_reference(self, command_id, data):
    args = self.parse_arg(data["args"])
    method_name = data["method_name"]
    reference_id = data["reference_id"]
    with_string = data["with"]
    object = self.objects[reference_id]
    method = getattr(object, method_name)
    result = method(*args)

    if with_string == "reference":
      object_id = self.spawn_object(result)
      response = object_id
    elif with_string == "result":
      response = result

    await self.respond_to_command(command_id, {"response": response})

  async def command_import(self, command_id, data):
    import_name = data["import_name"]
    import_result = importlib.import_module(import_name)
    object_id = self.spawn_object(import_result)

    await self.respond_to_command(command_id, {"object_id": object_id})

  async def command_read_attribute(self, command_id, data):
    attribute_name = data["attribute_name"]
    reference_id = data["reference_id"]
    with_string = data["with"]
    object = self.objects[reference_id]

    result = getattr(object, attribute_name)

    if with_string == "reference":
      object_id = self.spawn_object(result)
      response = object_id
    elif with_string == "result":
      response = result

    await self.respond_to_command(command_id, {"response": response})


  async def command_serialize_reference(self, command_id, data):
    reference_id = data["reference_id"]
    object = self.objects[reference_id]

    await self.respond_to_command(command_id, json.dumps(object))

  def parse_arg(self, arg):
    if type(arg).__name__ in ("list", "tuple"):
      new_array = []

      for x in arg:
        new_array.append(self.parse_arg(x))

      return new_array
    elif isinstance(arg, dict):
      if arg["__scoundrel_type"] == "reference":
        return self.objects[arg["__scoundrel_object_id"]]

      new_dict = {}

      for k, v in arg.items():
        new_dict[k] = self.parse_arg(v)

      return new_dict

    return arg

  def spawn_object(self, object):
    self.objects_count += 1
    object_id = self.objects_count
    self.objects[object_id] = object

    return object_id

async def handler(ws, path):
  web_socket_client = WebSocketClient(ws)
  await web_socket_client.listen()

parser = argparse.ArgumentParser(
  prog="Scoundrel Python Server",
  description="Handles Python code dynamically",
  epilog="Have fun :-)"
)
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", default="53874")

args = parser.parse_args()
port = int(args.port)

start_server = websockets.serve(handler, args.host, port)

debug(f'Started with PID {os.getpid()} on {args.host}:{port}')

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
