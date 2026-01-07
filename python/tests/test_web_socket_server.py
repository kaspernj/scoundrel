import json

import pytest

from scoundrel_python.web_socket_server import WebSocketClient


class DummyWebSocket:
  def __init__(self):
    self.sent = []

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
