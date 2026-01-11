<?php

namespace Scoundrel;

use DateTimeImmutable;
use DateTimeInterface;
use RuntimeException;

final class Json
{
    public const TYPE_KEY = '__scoundrel_type__';
    public const VALUE_KEY = 'value';

    /** @var array<int, array{type: string, canSerialize: callable, serialize: callable, deserialize: callable}> */
    private static array $typeHandlers = [];

    public static function registerType(
        string $type,
        callable $canSerialize,
        callable $serialize,
        callable $deserialize
    ): void {
        if (trim($type) === '') {
            throw new RuntimeException('Scoundrel type handler must include a type');
        }

        $handler = [
            'type' => $type,
            'canSerialize' => $canSerialize,
            'serialize' => $serialize,
            'deserialize' => $deserialize,
        ];

        foreach (self::$typeHandlers as $index => $existing) {
            if ($existing['type'] === $type) {
                self::$typeHandlers[$index] = $handler;
                return;
            }
        }

        self::$typeHandlers[] = $handler;
    }

    public static function stringify(mixed $value): string
    {
        $encoded = self::encodeValue($value, 'value');
        return json_encode($encoded, JSON_THROW_ON_ERROR);
    }

    public static function parse(string $raw): mixed
    {
        return self::decodeValue(json_decode($raw, true, 512, JSON_THROW_ON_ERROR));
    }

    private static function encodeValue(mixed $value, string $path): mixed
    {
        $handler = self::findHandlerForValue($value);
        if ($handler !== null) {
            $payload = ($handler['serialize'])($value);
            $payload = self::ensureSerializedArray($handler['type'], $payload, $path);
            return self::encodeArray($payload, $path);
        }

        if ($value === null || is_string($value) || is_bool($value) || is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            if (is_nan($value) || is_infinite($value)) {
                throw new RuntimeException("Cannot serialize non-finite number at {$path}");
            }
            return $value;
        }

        if (is_array($value)) {
            return self::encodeArray($value, $path);
        }

        if ($value instanceof \stdClass) {
            return self::encodeArray(get_object_vars($value), $path);
        }

        if (is_object($value)) {
            $type = get_class($value);
            throw new RuntimeException("Cannot serialize non-plain object '{$type}' at {$path}");
        }

        $type = gettype($value);
        throw new RuntimeException("Cannot serialize unsupported type {$type} at {$path}");
    }

    private static function encodeArray(array $value, string $path): array
    {
        $encoded = [];
        foreach ($value as $key => $child) {
            $childPath = $path . '.' . (string) $key;
            $encoded[$key] = self::encodeValue($child, $childPath);
        }
        return $encoded;
    }

    private static function decodeValue(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }

        $type = $value[self::TYPE_KEY] ?? null;
        if (is_string($type)) {
            $handler = self::findHandlerForType($type);
            if ($handler !== null) {
                return ($handler['deserialize'])($value);
            }
        }

        $decoded = [];
        foreach ($value as $key => $child) {
            $decoded[$key] = self::decodeValue($child);
        }
        return $decoded;
    }

    private static function ensureSerializedArray(string $type, mixed $payload, string $path): array
    {
        if (!is_array($payload)) {
            throw new RuntimeException("Scoundrel type '{$type}' must serialize to an array at {$path}");
        }

        if (!array_key_exists(self::TYPE_KEY, $payload)) {
            $payload[self::TYPE_KEY] = $type;
        }

        return $payload;
    }

    private static function findHandlerForValue(mixed $value): ?array
    {
        foreach (self::$typeHandlers as $handler) {
            if (($handler['canSerialize'])($value)) {
                return $handler;
            }
        }
        return null;
    }

    private static function findHandlerForType(string $type): ?array
    {
        foreach (self::$typeHandlers as $handler) {
            if ($handler['type'] === $type) {
                return $handler;
            }
        }
        return null;
    }
}

Json::registerType(
    'date',
    static fn (mixed $value): bool => $value instanceof DateTimeInterface,
    static fn (DateTimeInterface $value): array => [
        Json::TYPE_KEY => 'date',
        Json::VALUE_KEY => $value->format(DATE_ATOM),
    ],
    static function (array $payload): DateTimeImmutable {
        if (!isset($payload[Json::VALUE_KEY])) {
            throw new RuntimeException('Missing date payload value');
        }
        try {
            return new DateTimeImmutable((string) $payload[Json::VALUE_KEY]);
        } catch (\Exception $error) {
            throw new RuntimeException('Invalid date payload');
        }
    }
);

Json::registerType(
    'regex',
    static fn (mixed $value): bool => $value instanceof Regex,
    static fn (Regex $value): array => [
        Json::TYPE_KEY => 'regex',
        Json::VALUE_KEY => $value->toString(),
    ],
    static function (array $payload): Regex {
        if (!isset($payload[Json::VALUE_KEY])) {
            throw new RuntimeException('Missing regex payload value');
        }
        return Regex::fromString((string) $payload[Json::VALUE_KEY]);
    }
);
