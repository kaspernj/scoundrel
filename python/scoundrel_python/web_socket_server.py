import argparse
import asyncio
import importlib
import json
import os
import threading
import uuid

import websockets


class WebSocketClient:
  def __init__(self, ws, debug=None):
    self.ws = ws
    self.running = True
    self.objects = {}
    self.objects_count = 0
    self.instance_id = uuid.uuid4().hex
    self._debug = debug or self._default_debug
    self._debug("WebSocketClient initialized")

  @staticmethod
  def _default_debug(message):
    print(message, flush=True)

  async def listen(self):
    self._debug("Starting running loop")

    while self.running:
      self._debug("Waiting for new input")
      raw_data = await self.ws.recv()

      self._debug(f"Raw data received: {raw_data}")

      data = json.loads(raw_data)
      command = data["command"]
      command_id = data["command_id"]

      self._debug(f"Data recieved as: {data}!")

      command_method = getattr(self, f"command_{command}", None)

      if command_method:
        thread = threading.Thread(target=self.run_command_in_thread, args=(command_method, command_id, data))
        thread.start()
      else:
        await self.respond_with_error(command_id, f"No such command {command}")

  def run_command_in_thread(self, command_method, command_id, data):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    loop.run_until_complete(self.run_command(command_method, command_id, data))
    loop.close()

  async def run_command(self, command_method, command_id, data):
    try:
      await command_method(command_id, data["data"])
    except Exception as error:
      self._debug(f"ERROR: {error}")
      await self.respond_with_error(command_id, str(error))
      raise

  async def respond_to_command(self, command_id, data):
    data = {"command": "command_response", "command_id": command_id, "data": {"data": data}}
    data_json = json.dumps(data)

    self._debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def respond_with_error(self, command_id, error):
    data = {"command": "command_response", "command_id": command_id, "data": {"error": error}}
    data_json = json.dumps(data)

    self._debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def command_new_object_with_reference(self, command_id, data):
    class_name = data["class_name"]
    args = self.parse_arg(data.get("args", []))

    if class_name == "[]":
      instance = list(args)
    else:
      klass = eval(class_name)
      instance = klass(*args)

    object_id = self.spawn_object(instance)

    await self.respond_to_command(command_id, {"object_id": object_id, "instance_id": self.instance_id})

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
    else:
      raise ValueError(f"Unknown return type: {with_string}")

    response_payload = {"response": response}
    if with_string == "reference":
      response_payload["instance_id"] = self.instance_id

    await self.respond_to_command(command_id, response_payload)

  async def command_import(self, command_id, data):
    import_name = data["import_name"]
    import_result = importlib.import_module(import_name)
    object_id = self.spawn_object(import_result)

    await self.respond_to_command(command_id, {"object_id": object_id, "instance_id": self.instance_id})

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
    else:
      raise ValueError(f"Unknown return type: {with_string}")

    response_payload = {"response": response}
    if with_string == "reference":
      response_payload["instance_id"] = self.instance_id

    await self.respond_to_command(command_id, response_payload)

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
      if arg.get("__scoundrel_type") == "reference":
        instance_id = arg.get("__scoundrel_instance_id")
        if instance_id is None or instance_id == self.instance_id:
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


class ScoundrelPythonServer:
  def __init__(self, host="127.0.0.1", port=53874, debug=None):
    self.host = host
    self.port = int(port)
    self._debug = debug or self._default_debug

  @staticmethod
  def _default_debug(message):
    print(message, flush=True)

  async def handler(self, ws, path):
    web_socket_client = WebSocketClient(ws, debug=self._debug)
    await web_socket_client.listen()

  def run(self):
    start_server = websockets.serve(self.handler, self.host, self.port)

    self._debug(f"Started with PID {os.getpid()} on {self.host}:{self.port}")

    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_server)
    loop.run_forever()

  @classmethod
  def from_argv(cls, argv=None):
    parser = argparse.ArgumentParser(
      prog="Scoundrel Python Server",
      description="Handles Python code dynamically",
      epilog="Have fun :-)"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="53874")

    args = parser.parse_args(argv)

    return cls(host=args.host, port=args.port)


def main(argv=None):
  ScoundrelPythonServer.from_argv(argv).run()


if __name__ == "__main__":
  main()
