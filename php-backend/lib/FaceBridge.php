<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function call_ai(string $path, array $payload): array
{
    $url = rtrim(AI_API_BASE, '/') . '/' . ltrim($path, '/');

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30,
    ]);

    $result = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($error !== '') {
        fail('AI service unavailable: ' . $error, 503);
    }

    $decoded = json_decode((string)$result, true);
    if (!is_array($decoded)) {
        fail('AI service returned invalid JSON', 502);
    }

    if ($status >= 400) {
        $msg = $decoded['detail'] ?? $decoded['message'] ?? 'AI processing failed';
        fail((string)$msg, $status);
    }

    return $decoded;
}
