<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function env_value(string $key, string $default): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function json_response(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $statusCode = 400): void
{
    json_response(['ok' => false, 'message' => $message], $statusCode);
}

const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'face_auth';
const DB_USER = 'root';
const DB_PASS = '';

const AI_API_BASE = 'http://127.0.0.1:8001';
