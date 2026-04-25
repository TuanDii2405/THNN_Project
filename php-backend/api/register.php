<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/FaceBridge.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$input = json_input();
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');
$fullName = trim((string)($input['full_name'] ?? ''));
$imageBase64 = (string)($input['image_base64'] ?? '');

if ($username === '' || $password === '' || $imageBase64 === '') {
    fail('username, password, image_base64 are required');
}

if (strlen($password) < 6) {
    fail('Password must be at least 6 characters');
}

$pdo = db();
$check = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
$check->execute(['username' => $username]);
if ($check->fetch()) {
    fail('Username already exists', 409);
}

$ai = call_ai('/extract-encoding', [
    'image_base64' => $imageBase64,
]);

$encoding = $ai['face_encoding'] ?? null;
if (!is_array($encoding)) {
    fail('Unable to extract face encoding', 422);
}

$insert = $pdo->prepare('INSERT INTO users (username, password_hash, role, full_name, face_encoding, is_locked) VALUES (:username, :password_hash, :role, :full_name, :face_encoding, 0)');
$insert->execute([
    'username' => $username,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => 'user',
    'full_name' => $fullName,
    'face_encoding' => json_encode($encoding),
]);

json_response([
    'ok' => true,
    'message' => 'User registered successfully',
    'user_id' => (int)$pdo->lastInsertId(),
]);
