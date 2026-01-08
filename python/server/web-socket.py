#!/usr/bin/env python3

import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scoundrel_python.web_socket_server import main

def run() -> None:
  main()


if __name__ == "__main__":
  run()
