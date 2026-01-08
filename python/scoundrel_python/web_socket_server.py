import argparse
import asyncio
import importlib
import json
import os
import threading
import uuid
from typing import Any, Awaitable, Callable, Dict, Optional, Sequence

import websockets


class WebSocketClient:
  def __init__(self, ws: Any, debug: Optional[Callable[[str], None]] = None) -> None:
    self.ws: Any = ws
    self.running: bool = True
    self.objects: Dict[int, Any] = {}
    self.objects_count: int = 0
    self.instance_id: str = uuid.uuid4().hex
    self._debug: Callable[[str], None] = debug or self._default_debug
    self._debug("WebSocketClient initialized")

  @staticmethod
  def _default_debug(message: str) -> None:
    print(message, flush=True)

  async def listen(self) -> None:
    self._debug("Starting running loop")

    while self.running:
      self._debug("Waiting for new input")
      raw_data = await self.ws.recv()

      self._debug(f"Raw data received: {raw_data}")

      data = json.loads(raw_data)
      command = data["command"]
      command_id = data["command_id"]
      released_ids = data.get("released_reference_ids")

      self._debug(f"Data recieved as: {data}!")

      self.release_references(released_ids)

      command_method = getattr(self, f"command_{command}", None)

      if command_method:
        thread = threading.Thread(target=self.run_command_in_thread, args=(command_method, command_id, data))
        thread.start()
      else:
        await self.respond_with_error(command_id, f"No such command {command}")

  def run_command_in_thread(
    self,
    command_method: Callable[[int, Dict[str, Any]], Awaitable[None]],
    command_id: int,
    data: Dict[str, Any]
  ) -> None:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    loop.run_until_complete(self.run_command(command_method, command_id, data))
    loop.close()

  async def run_command(
    self,
    command_method: Callable[[int, Dict[str, Any]], Awaitable[None]],
    command_id: int,
    data: Dict[str, Any]
  ) -> None:
    try:
      await command_method(command_id, data["data"])
    except Exception as error:
      self._debug(f"ERROR: {error}")
      await self.respond_with_error(command_id, str(error))
      raise

  async def respond_to_command(self, command_id: int, data: Any) -> None:
    data = {"command": "command_response", "command_id": command_id, "data": {"data": data}}
    data_json = json.dumps(data)

    self._debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def respond_with_error(self, command_id: int, error: str) -> None:
    data = {"command": "command_response", "command_id": command_id, "data": {"error": error}}
    data_json = json.dumps(data)

    self._debug(f"Reply: {data_json}")

    await self.ws.send(data_json)

  async def command_new_object_with_reference(self, command_id: int, data: Dict[str, Any]) -> None:
    class_name = data["class_name"]
    args = self.parse_arg(data.get("args", []))

    if class_name == "[]":
      instance = list(args)
    else:
      klass = eval(class_name)
      instance = klass(*args)

    object_id = self.spawn_object(instance)

    await self.respond_to_command(command_id, {"object_id": object_id, "instance_id": self.instance_id})

  async def command_call_method_on_reference(self, command_id: int, data: Dict[str, Any]) -> None:
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

    response_payload: Dict[str, Any] = {"response": response}
    if with_string == "reference":
      response_payload["instance_id"] = self.instance_id

    await self.respond_to_command(command_id, response_payload)

  async def command_import(self, command_id: int, data: Dict[str, Any]) -> None:
    import_name = data["import_name"]
    import_result = importlib.import_module(import_name)
    object_id = self.spawn_object(import_result)

    await self.respond_to_command(command_id, {"object_id": object_id, "instance_id": self.instance_id})

  async def command_read_attribute(self, command_id: int, data: Dict[str, Any]) -> None:
    attribute_name = data["attribute_name"]
    reference_id = data["reference_id"]
    with_string = data["with"]
    object = self.objects[reference_id]

    result = self.read_attribute_value(object, attribute_name)

    if with_string == "reference":
      object_id = self.spawn_object(result)
      response = object_id
    elif with_string == "result":
      response = result
    else:
      raise ValueError(f"Unknown return type: {with_string}")

    response_payload: Dict[str, Any] = {"response": response}
    if with_string == "reference":
      response_payload["instance_id"] = self.instance_id

    await self.respond_to_command(command_id, response_payload)

  async def command_serialize_reference(self, command_id: int, data: Dict[str, Any]) -> None:
    reference_id = data["reference_id"]
    object = self.objects[reference_id]

    await self.respond_to_command(command_id, json.dumps(object))

  def read_attribute_value(self, object: Any, attribute_name: Any) -> Any:
    if isinstance(object, (list, tuple)):
      index = self.parse_index(attribute_name)
      if index is not None:
        return object[index]
      if attribute_name == "length":
        return len(object)
    elif isinstance(object, dict):
      if attribute_name in object:
        return object[attribute_name]
      if attribute_name == "length":
        return len(object)

    return getattr(object, attribute_name)

  @staticmethod
  def parse_index(attribute_name: Any) -> Optional[int]:
    if isinstance(attribute_name, int):
      return attribute_name
    if isinstance(attribute_name, str) and attribute_name.isdigit():
      return int(attribute_name)
    return None

  def parse_arg(self, arg: Any) -> Any:
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

  def spawn_object(self, object: Any) -> int:
    self.objects_count += 1
    object_id = self.objects_count
    self.objects[object_id] = object

    return object_id

  def release_references(self, released_ids: Optional[Sequence[int]]) -> None:
    if not isinstance(released_ids, list):
      return

    for reference_id in released_ids:
      if reference_id in self.objects:
        del self.objects[reference_id]


class ScoundrelPythonServer:
  def __init__(
    self,
    host: str = "127.0.0.1",
    port: int = 53874,
    debug: Optional[Callable[[str], None]] = None
  ) -> None:
    self.host: str = host
    self.port: int = int(port)
    self._debug: Callable[[str], None] = debug or self._default_debug

  @staticmethod
  def _default_debug(message: str) -> None:
    print(message, flush=True)

  async def handler(self, ws: Any, path: str) -> None:
    web_socket_client = WebSocketClient(ws, debug=self._debug)
    await web_socket_client.listen()

  def run(self) -> None:
    start_server = websockets.serve(self.handler, self.host, self.port)

    self._debug(f"Started with PID {os.getpid()} on {self.host}:{self.port}")

    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_server)
    loop.run_forever()

  @classmethod
  def from_argv(cls, argv: Optional[Sequence[str]] = None) -> "ScoundrelPythonServer":
    parser = argparse.ArgumentParser(
      prog="Scoundrel Python Server",
      description="Handles Python code dynamically",
      epilog="Have fun :-)"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="53874")

    args = parser.parse_args(argv)

    return cls(host=args.host, port=args.port)


def main(argv: Optional[Sequence[str]] = None) -> None:
  ScoundrelPythonServer.from_argv(argv).run()


if __name__ == "__main__":
  main()
