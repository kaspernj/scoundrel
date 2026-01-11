<?php

require_once __DIR__ . '/../src/Json.php';
require_once __DIR__ . '/../src/Regex.php';

use PHPUnit\Framework\TestCase;
use Scoundrel\Json;
use Scoundrel\Regex;

final class JsonTest extends TestCase
{
    public function testSerializesDates(): void
    {
        $createdAt = new DateTimeImmutable('2024-01-02T03:04:05Z');
        $payload = Json::stringify(['createdAt' => $createdAt]);
        $parsed = Json::parse($payload);

        $this->assertInstanceOf(DateTimeImmutable::class, $parsed['createdAt']);
        $this->assertSame('2024-01-02T03:04:05+00:00', $parsed['createdAt']->format(DATE_ATOM));
    }

    public function testSerializesRegex(): void
    {
        $matcher = new Regex('scoundrel', 'im');
        $payload = Json::stringify(['matcher' => $matcher]);
        $parsed = Json::parse($payload);

        $this->assertInstanceOf(Regex::class, $parsed['matcher']);
        $this->assertSame('scoundrel', $parsed['matcher']->getPattern());
        $this->assertSame('im', $parsed['matcher']->getFlags());
    }
}
