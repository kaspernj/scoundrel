<?php

namespace Scoundrel;

use RuntimeException;

final class Regex
{
    private string $pattern;
    private string $flags;

    public function __construct(string $pattern, string $flags = '')
    {
        $this->pattern = $pattern;
        $this->flags = $flags;
    }

    public static function fromString(string $raw): self
    {
        if (!preg_match('#^/(.*)/([a-z]*)$#', $raw, $matches)) {
            throw new RuntimeException('Invalid regex payload');
        }

        return new self($matches[1], $matches[2]);
    }

    public function getPattern(): string
    {
        return $this->pattern;
    }

    public function getFlags(): string
    {
        return $this->flags;
    }

    public function toString(): string
    {
        return '/' . $this->pattern . '/' . $this->flags;
    }
}
