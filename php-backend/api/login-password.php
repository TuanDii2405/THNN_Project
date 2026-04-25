<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$input = json_input();
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($username === '' || $password === '') {
    fail('username and password are required');
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id, username, password_hash, role, full_name, is_locked FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    fail('Invalid username or password', 401);
}

if ((int)$user['is_locked'] === 1) {
    fail('Account is locked', 403);
}

login_session($user);

json_response([
    'ok' => true,
    'message' => 'Login successful',
    'user' => current_user(),
]);
