<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../lib/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed', 405);
}

$sessionUser = require_login();

$pdo = db();
$stmt = $pdo->prepare('SELECT id, username, role, full_name, face_encoding, is_locked, created_at, updated_at FROM users WHERE id = :id LIMIT 1');
$stmt->execute(['id' => $sessionUser['id']]);
$user = $stmt->fetch();

if (!$user) {
    fail('User not found', 404);
}

$user['has_face_data'] = !empty($user['face_encoding']);
unset($user['face_encoding']);

json_response([
    'ok' => true,
    'user' => $user,
]);