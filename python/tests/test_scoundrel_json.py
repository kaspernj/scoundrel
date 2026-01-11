import datetime as dt
import re

from scoundrel_python.scoundrel_json import dumps as scoundrel_json_dumps
from scoundrel_python.scoundrel_json import loads as scoundrel_json_loads


def test_scoundrel_json_serializes_datetime():
  timestamp = dt.datetime(2024, 1, 2, 3, 4, 5, tzinfo=dt.timezone.utc)
  payload = scoundrel_json_dumps({"created_at": timestamp})
  parsed = scoundrel_json_loads(payload)

  assert isinstance(parsed["created_at"], dt.datetime)
  assert parsed["created_at"].isoformat() == "2024-01-02T03:04:05+00:00"


def test_scoundrel_json_serializes_regex():
  matcher = re.compile("scoundrel", re.IGNORECASE | re.MULTILINE)
  payload = scoundrel_json_dumps({"matcher": matcher})
  parsed = scoundrel_json_loads(payload)

  assert isinstance(parsed["matcher"], re.Pattern)
  assert parsed["matcher"].pattern == "scoundrel"
  assert parsed["matcher"].flags & re.IGNORECASE
  assert parsed["matcher"].flags & re.MULTILINE
