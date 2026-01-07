<?php

function assert_equal($expected, $actual, $message) {
  if ($expected !== $actual) {
    throw new Exception($message . " expected=" . var_export($expected, true) . " actual=" . var_export($actual, true));
  }
}

function read_response($stdout) {
  while (($line = fgets($stdout)) !== false) {
    if (preg_match('/%\\{\\{php_process:begin\\}\\}(.+)%\\{\\{php_process:end\\}\\}/', $line, $match)) {
      $payload = $match[1];
      $parts = explode(":", $payload, 3);
      if (count($parts) < 3) {
        throw new Exception("Invalid response payload: " . $payload);
      }

      $type = $parts[0];
      $id = intval($parts[1]);
      $data = unserialize(base64_decode($parts[2]));

      return array($type, $id, $data);
    }
  }

  throw new Exception("No response received");
}

function send_command($stdin, $id, $payload) {
  $encoded = base64_encode(serialize($payload));
  fwrite($stdin, "send:" . $id . ":" . $encoded . "\n");
}

$server_path = realpath(__DIR__ . "/../server/server.php");
if (!$server_path || !file_exists($server_path)) {
  throw new Exception("Server script not found: " . $server_path);
}

$cmd = PHP_BINARY . " " . escapeshellarg($server_path);
$descriptors = array(
  0 => array("pipe", "r"),
  1 => array("pipe", "w"),
  2 => array("pipe", "w")
);

$process = proc_open($cmd, $descriptors, $pipes);
if (!is_resource($process)) {
  throw new Exception("Failed to start PHP server process");
}

try {
  $ready_line = fgets($pipes[1]);
  if ($ready_line === false) {
    throw new Exception("No ready line received from PHP server");
  }

  if (!preg_match('/^php_script_ready:(\\d+):([^\\s]+)\\s*$/', trim($ready_line), $match)) {
    throw new Exception("Unexpected ready line: " . $ready_line);
  }

  $instance_id = $match[2];

  send_command($pipes[0], 1, array("type" => "new", "class" => "stdClass", "args" => array()));
  list($type, $resp_id, $data) = read_response($pipes[1]);

  assert_equal("answer", $type, "response type");
  assert_equal(1, $resp_id, "response id");
  assert_equal("proxyobj", $data[0], "proxy object tag");
  assert_equal($instance_id, $data[2], "instance id in proxy payload");

  $object_id = $data[1];

  send_command($pipes[0], 2, array(
    "type" => "func",
    "func_name" => "is_array",
    "args" => array(
      array("type" => "proxyobj", "id" => $object_id, "instance_id" => $instance_id)
    )
  ));
  list($_type, $_resp_id, $resolved_result) = read_response($pipes[1]);
  assert_equal(false, $resolved_result, "matched instance references should resolve to objects");

  send_command($pipes[0], 3, array(
    "type" => "func",
    "func_name" => "is_array",
    "args" => array(
      array("type" => "proxyobj", "id" => 999, "instance_id" => "other-instance")
    )
  ));
  list($_type, $_resp_id, $unresolved_result) = read_response($pipes[1]);
  assert_equal(true, $unresolved_result, "mismatched instance references should remain arrays");
} finally {
  foreach ($pipes as $pipe) {
    fclose($pipe);
  }
  proc_terminate($process);
}
