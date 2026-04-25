<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../lib/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

require_admin();
$input = json_input();
$userId = (int)($input['user_id'] ?? 0);

if ($userId <= 0) {
    fail('user_id is required');
}

$pdo = db();
$stmt = $pdo->prepare('UPDATE users SET face_encoding = NULL, updated_at = NOW() WHERE id = :id');
$stmt->execute(['id' => $userId]);

json_response([
    'ok' => true,
    'message' => 'Face data reset successfully',
]);
