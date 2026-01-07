import json

import pytest

from scoundrel_python.web_socket_server import ScoundrelPythonServer, WebSocketClient


class DummyWebSocket:
  def __init__(self, recv_messages=None):
    self.sent = []
    self.recv_messages = list(recv_messages or [])
    self.on_recv = None

  async def recv(self):
    if not self.recv_messages:
      raise RuntimeError("No more messages")

    if self.on_recv:
      self.on_recv()

    return self.recv_messages.pop(0)

  async def send(self, payload):
    self.sent.append(payload)


def test_parse_arg_resolves_reference():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)
  client.instance_id = "instance-1"
  client.objects[1] = "value"

  payload = {
    "__scoundrel_type": "reference",
    "__scoundrel_object_id": 1,
    "__scoundrel_instance_id": "instance-1"
  }

  assert client.parse_arg(payload) == "value"


def test_parse_arg_keeps_mismatched_reference():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)
  client.instance_id = "instance-1"
  client.objects[1] = "value"

  payload = {
    "__scoundrel_type": "reference",
    "__scoundrel_object_id": 1,
    "__scoundrel_instance_id": "instance-2"
  }

  assert client.parse_arg(payload) == payload


@pytest.mark.asyncio
async def test_command_read_attribute_returns_result():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)
  object_id = client.spawn_object(type("AttrObject", (), {"name": "Scoundrel"})())

  await client.command_read_attribute(7, {
    "attribute_name": "name",
    "reference_id": object_id,
    "with": "result"
  })

  payload = json.loads(ws.sent[0])
  assert payload["command_id"] == 7
  assert payload["data"]["data"]["response"] == "Scoundrel"


@pytest.mark.asyncio
async def test_command_read_attribute_returns_reference():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)
  object_id = client.spawn_object(type("AttrObject", (), {"items": [1, 2, 3]})())

  await client.command_read_attribute(8, {
    "attribute_name": "items",
    "reference_id": object_id,
    "with": "reference"
  })

  payload = json.loads(ws.sent[0])
  response = payload["data"]["data"]

  assert response["response"] == 2
  assert response["instance_id"] == client.instance_id
  assert client.objects[response["response"]] == [1, 2, 3]


def test_server_parses_arguments():
  server = ScoundrelPythonServer.from_argv(["--host", "127.0.0.1", "--port", "5555"])

  assert server.host == "127.0.0.1"
  assert server.port == 5555


@pytest.mark.asyncio
async def test_command_new_object_with_reference_passes_args():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)

  class Example:
    def __init__(self, name, count):
      self.name = name
      self.count = count

  import scoundrel_python.web_socket_server as server

  server.Example = Example

  await client.command_new_object_with_reference(9, {
    "class_name": "Example",
    "args": ["alpha", 3]
  })

  payload = json.loads(ws.sent[0])
  object_id = payload["data"]["data"]["object_id"]
  instance = client.objects[object_id]

  assert instance.name == "alpha"
  assert instance.count == 3


@pytest.mark.asyncio
async def test_command_call_method_on_reference_returns_result():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)

  class Example:
    def __init__(self):
      self.value = "ok"

    def get_value(self):
      return self.value

  object_id = client.spawn_object(Example())

  await client.command_call_method_on_reference(10, {
    "args": [],
    "method_name": "get_value",
    "reference_id": object_id,
    "with": "result"
  })

  payload = json.loads(ws.sent[0])
  assert payload["data"]["data"]["response"] == "ok"


@pytest.mark.asyncio
async def test_command_call_method_on_reference_returns_reference():
  ws = DummyWebSocket()
  client = WebSocketClient(ws)

  class Example:
    def __init__(self):
      self.items = [1, 2]

    def get_items(self):
      return self.items

  object_id = client.spawn_object(Example())

  await client.command_call_method_on_reference(11, {
    "args": [],
    "method_name": "get_items",
    "reference_id": object_id,
    "with": "reference"
  })

  payload = json.loads(ws.sent[0])
  response = payload["data"]["data"]

  assert response["response"] == 2
  assert response["instance_id"] == client.instance_id
  assert client.objects[response["response"]] == [1, 2]


@pytest.mark.asyncio
async def test_listen_rejects_unknown_command():
  message = json.dumps({"command": "missing_command", "command_id": 12, "data": {}})
  ws = DummyWebSocket([message])
  client = WebSocketClient(ws)
  ws.on_recv = lambda: setattr(client, "running", False)

  await client.listen()

  payload = json.loads(ws.sent[0])
  assert payload["data"]["error"] == "No such command missing_command"
