<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../lib/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$sessionUser = require_login();
$input = json_input();
$currentPassword = (string)($input['current_password'] ?? '');
$newPassword = (string)($input['new_password'] ?? '');

if ($currentPassword === '' || $newPassword === '') {
    fail('current_password and new_password are required');
}

if (strlen($newPassword) < 6) {
    fail('new_password must be at least 6 characters');
}

$pdo = db();
$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
$stmt->execute(['id' => $sessionUser['id']]);
$user = $stmt->fetch();

if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
    fail('Current password is incorrect', 401);
}

$update = $pdo->prepare('UPDATE users SET password_hash = :password_hash, updated_at = NOW() WHERE id = :id');
$update->execute([
    'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
    'id' => $sessionUser['id'],
]);

json_response([
    'ok' => true,
    'message' => 'Password changed successfully',
]);
