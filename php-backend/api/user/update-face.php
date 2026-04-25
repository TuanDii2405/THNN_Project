<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../lib/Auth.php';
require_once __DIR__ . '/../../lib/FaceBridge.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$sessionUser = require_login();
$input = json_input();
$imageBase64 = (string)($input['image_base64'] ?? '');

if ($imageBase64 === '') {
    fail('image_base64 is required');
}

$ai = call_ai('/extract-encoding', [
    'image_base64' => $imageBase64,
]);
$encoding = $ai['face_encoding'] ?? null;

if (!is_array($encoding)) {
    fail('Unable to extract face encoding', 422);
}

$pdo = db();
$stmt = $pdo->prepare('UPDATE users SET face_encoding = :encoding, updated_at = NOW() WHERE id = :id');
$stmt->execute([
    'encoding' => json_encode($encoding),
    'id' => $sessionUser['id'],
]);

json_response([
    'ok' => true,
    'message' => 'Face data updated',
]);
