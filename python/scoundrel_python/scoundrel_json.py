from __future__ import annotations

import datetime as dt
import json
import math
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List

TYPE_KEY = "__scoundrel_type__"
VALUE_KEY = "value"


@dataclass(frozen=True)
class ScoundrelTypeHandler:
  type: str
  can_serialize: Callable[[Any], bool]
  serialize: Callable[[Any], Dict[str, Any]]
  deserialize: Callable[[Dict[str, Any]], Any]


_type_handlers: List[ScoundrelTypeHandler] = []


def register_scoundrel_type(handler: ScoundrelTypeHandler) -> None:
  if not handler.type:
    raise ValueError("Scoundrel type handler must include a type")

  existing_index = next((idx for idx, item in enumerate(_type_handlers) if item.type == handler.type), None)
  if existing_index is None:
    _type_handlers.append(handler)
  else:
    _type_handlers[existing_index] = handler


def _find_handler_for_value(value: Any) -> ScoundrelTypeHandler | None:
  return next((handler for handler in _type_handlers if handler.can_serialize(value)), None)


def _find_handler_for_type(type_name: str) -> ScoundrelTypeHandler | None:
  return next((handler for handler in _type_handlers if handler.type == type_name), None)


def _ensure_serialized_object(handler: ScoundrelTypeHandler, payload: Any, path: str) -> Dict[str, Any]:
  if not isinstance(payload, dict):
    raise TypeError(f"Scoundrel type '{handler.type}' must serialize to a dict at {path}")

  if TYPE_KEY not in payload:
    payload[TYPE_KEY] = handler.type

  return payload


def _encode_value(value: Any, path: str, seen: Dict[int, str]) -> Any:
  if value is None or isinstance(value, (str, bool, int)):
    return value

  if isinstance(value, float):
    if not math.isfinite(value):
      raise ValueError(f"Cannot serialize non-finite number at {path}")
    return value

  handler = _find_handler_for_value(value)
  if handler is not None:
    serialized = _ensure_serialized_object(handler, handler.serialize(value), path)
    return _encode_object(serialized, path, seen)

  if isinstance(value, (list, tuple)):
    if id(value) in seen:
      raise ValueError(f"Cannot serialize circular reference at {path}")
    seen[id(value)] = path
    return [_encode_value(item, f"{path}[{index}]", seen) for index, item in enumerate(value)]

  if isinstance(value, dict):
    return _encode_object(value, path, seen)

  raise TypeError(f"Cannot serialize unsupported type {type(value).__name__} at {path}")


def _encode_object(value: Dict[str, Any], path: str, seen: Dict[int, str]) -> Dict[str, Any]:
  if id(value) in seen:
    raise ValueError(f"Cannot serialize circular reference at {path}")
  seen[id(value)] = path

  encoded: Dict[str, Any] = {}
  for key, child in value.items():
    key_str = str(key)
    child_path = f"{path}.{key_str}"
    encoded[key_str] = _encode_value(child, child_path, seen)
  return encoded


def _decode_value(value: Any) -> Any:
  if isinstance(value, list):
    return [_decode_value(item) for item in value]

  if isinstance(value, dict):
    type_name = value.get(TYPE_KEY)
    if isinstance(type_name, str):
      handler = _find_handler_for_type(type_name)
      if handler is not None:
        return handler.deserialize(value)
    return {key: _decode_value(child) for key, child in value.items()}

  return value


def dumps(value: Any) -> str:
  encoded = _encode_value(value, "value", {})
  return json.dumps(encoded)


def loads(raw: str) -> Any:
  return _decode_value(json.loads(raw))


def _parse_iso_datetime(raw: str) -> dt.datetime:
  if raw.endswith("Z"):
    raw = raw[:-1] + "+00:00"
  return dt.datetime.fromisoformat(raw)


def _format_datetime(value: dt.datetime) -> str:
  if value.tzinfo is None:
    return value.isoformat()
  return value.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _regex_flags_from_pattern(pattern: re.Pattern) -> str:
  flags = ""
  if pattern.flags & re.IGNORECASE:
    flags += "i"
  if pattern.flags & re.MULTILINE:
    flags += "m"
  if pattern.flags & re.DOTALL:
    flags += "s"
  if pattern.flags & re.UNICODE:
    flags += "u"
  return flags


def _regex_flags_to_re(flags: str) -> int:
  flag_value = 0
  if "i" in flags:
    flag_value |= re.IGNORECASE
  if "m" in flags:
    flag_value |= re.MULTILINE
  if "s" in flags:
    flag_value |= re.DOTALL
  if "u" in flags:
    flag_value |= re.UNICODE
  return flag_value


register_scoundrel_type(
  ScoundrelTypeHandler(
    type="date",
    can_serialize=lambda value: isinstance(value, dt.datetime),
    serialize=lambda value: {TYPE_KEY: "date", VALUE_KEY: _format_datetime(value)},
    deserialize=lambda payload: _parse_iso_datetime(str(payload[VALUE_KEY]))
  )
)

register_scoundrel_type(
  ScoundrelTypeHandler(
    type="regex",
    can_serialize=lambda value: isinstance(value, re.Pattern),
    serialize=lambda value: {TYPE_KEY: "regex", VALUE_KEY: f"/{value.pattern}/{_regex_flags_from_pattern(value)}"},
    deserialize=lambda payload: _deserialize_regex(payload)
  )
)


def _deserialize_regex(payload: Dict[str, Any]) -> re.Pattern:
  raw = str(payload[VALUE_KEY])
  match = re.match(r"^/(.*)/([a-z]*)$", raw)
  if not match:
    raise ValueError("Invalid regex payload")
  pattern, flags = match.groups()
  return re.compile(pattern, flags=_regex_flags_to_re(flags))
