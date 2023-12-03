import asyncio
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
    args = data["args"]
    method_name = data["method_name"]
    reference_id = data["reference_id"]
    with_string = data["with"]
    object = self.objects[reference_id]
    method = getattr(object, method_name)

    debug(f"Calling {method_name} on {object}")

    result = method(*args)

    debug(f"Result was: {result}")

    if with_string == "reference":
      object_id = self.spawn_object(result)
      response = object_id
    elif with_string == "result":
      response = result

    await self.respond_to_command(command_id, {"response": response})

  async def command_import(self, command_id, data):
    import_name = data["import_name"]
    import_result = importlib.import_module(import_name)

    self.objects_count += 1
    object_id = self.objects_count

    debug(f"Object ID: {object_id}")
    debug(f"Objects count after: {self.objects_count}")

    self.objects[object_id] = import_result

    await self.respond_to_command(command_id, {"object_id": object_id})

  async def command_read_attribute(self, command_id, data):
    attribute_name = data["attribute_name"]
    reference_id = data["reference_id"]
    with_string = data["with"]
    object = self.objects[reference_id]

    debug(f"Pi on math: {object.pi}")

    result = getattr(object, attribute_name)

    debug(f"Result: {result}")

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

  def spawn_object(self, object):
    self.objects_count += 1
    object_id = self.objects_count

    debug(f"Object ID: {object_id}")
    debug(f"Objects count after: {self.objects_count}")

    self.objects[object_id] = object

    return object_id

async def handler(ws, path):
  debug("New client connected")

  web_socket_client = WebSocketClient(ws)
  await web_socket_client.listen()

start_server = websockets.serve(handler, "127.0.0.1", 8081)

debug(f'Started with PID {os.getpid()}')

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
