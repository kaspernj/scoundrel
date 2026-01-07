<?php

use PHPUnit\Framework\TestCase;

final class InstanceIdTest extends TestCase
{
    private string $serverPath;

    protected function setUp(): void
    {
        $serverPath = realpath(__DIR__ . '/../server/server.php');
        if (!$serverPath || !file_exists($serverPath)) {
            $this->fail('Server script not found: ' . $serverPath);
        }

        $this->serverPath = $serverPath;
    }

    public function testInstanceIdInReadyLineAndProxyPayload(): void
    {
        [$process, $pipes] = $this->startServer();

        try {
            $readyLine = $this->readLine($pipes[1]);
            $this->assertNotFalse($readyLine, 'No ready line received from PHP server');

            $match = [];
            $matched = preg_match('/^php_script_ready:(\d+):([^\s]+)\s*$/', trim($readyLine), $match);
            $this->assertSame(1, $matched, 'Unexpected ready line: ' . $readyLine);

            $instanceId = $match[2];

            $this->sendCommand($pipes[0], 1, ['type' => 'new', 'class' => 'stdClass', 'args' => []]);
            [$type, $respId, $data] = $this->readResponse($pipes[1]);

            $this->assertSame('answer', $type);
            $this->assertSame(1, $respId);
            $this->assertSame('proxyobj', $data[0]);
            $this->assertSame($instanceId, $data[2]);
        } finally {
            $this->closeServer($process, $pipes);
        }
    }

    public function testMismatchedInstanceIdDoesNotResolveProxy(): void
    {
        [$process, $pipes] = $this->startServer();

        try {
            $readyLine = $this->readLine($pipes[1]);
            $this->assertNotFalse($readyLine, 'No ready line received from PHP server');

            $match = [];
            $matched = preg_match('/^php_script_ready:(\d+):([^\s]+)\s*$/', trim($readyLine), $match);
            $this->assertSame(1, $matched, 'Unexpected ready line: ' . $readyLine);

            $instanceId = $match[2];

            $this->sendCommand($pipes[0], 1, ['type' => 'new', 'class' => 'stdClass', 'args' => []]);
            [$type, $respId, $data] = $this->readResponse($pipes[1]);

            $this->assertSame('answer', $type);
            $this->assertSame(1, $respId);

            $objectId = $data[1];

            $this->sendCommand($pipes[0], 2, [
                'type' => 'func',
                'func_name' => 'is_array',
                'args' => [
                    ['type' => 'proxyobj', 'id' => $objectId, 'instance_id' => $instanceId],
                ],
            ]);
            [, , $resolvedResult] = $this->readResponse($pipes[1]);
            $this->assertFalse($resolvedResult);

            $this->sendCommand($pipes[0], 3, [
                'type' => 'func',
                'func_name' => 'is_array',
                'args' => [
                    ['type' => 'proxyobj', 'id' => 999, 'instance_id' => 'other-instance'],
                ],
            ]);
            [, , $unresolvedResult] = $this->readResponse($pipes[1]);
            $this->assertTrue($unresolvedResult);
        } finally {
            $this->closeServer($process, $pipes);
        }
    }

    private function startServer(): array
    {
        $cmd = PHP_BINARY . ' ' . escapeshellarg($this->serverPath);
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($cmd, $descriptors, $pipes);
        $this->assertIsResource($process);

        return [$process, $pipes];
    }

    private function closeServer($process, array $pipes): void
    {
        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }

        if (is_resource($process)) {
            proc_terminate($process);
        }
    }

    private function sendCommand($stdin, int $id, array $payload): void
    {
        $encoded = base64_encode(serialize($payload));
        fwrite($stdin, 'send:' . $id . ':' . $encoded . "\n");
    }

    private function readLine($stdout)
    {
        return fgets($stdout);
    }

    private function readResponse($stdout): array
    {
        while (($line = fgets($stdout)) !== false) {
            if (preg_match('/%\{\{php_process:begin\}\}(.+)%\{\{php_process:end\}\}/', $line, $match)) {
                $payload = $match[1];
                $parts = explode(':', $payload, 3);
                $this->assertGreaterThanOrEqual(3, count($parts), 'Invalid response payload: ' . $payload);

                $type = $parts[0];
                $id = intval($parts[1]);
                $data = unserialize(base64_decode($parts[2]));

                return [$type, $id, $data];
            }
        }

        $this->fail('No response received');
    }
}
