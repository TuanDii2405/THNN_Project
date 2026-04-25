<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/Auth.php';
require_once __DIR__ . '/../lib/FaceBridge.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}

$input = json_input();
$username = trim((string)($input['username'] ?? ''));
$imageBase64 = (string)($input['image_base64'] ?? '');

if ($username === '' || $imageBase64 === '') {
    fail('username and image_base64 are required');
}

$pdo = db();
$stmt = $pdo->prepare('SELECT id, username, role, full_name, face_encoding, is_locked FROM users WHERE username = :username LIMIT 1');
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();

if (!$user) {
    fail('User not found', 404);
}

if ((int)$user['is_locked'] === 1) {
    fail('Account is locked', 403);
}

if (empty($user['face_encoding'])) {
    fail('Face data not set. Please login by password and enroll face again.', 428);
}

$storedEncoding = json_decode((string)$user['face_encoding'], true);
if (!is_array($storedEncoding)) {
    fail('Stored face encoding is invalid', 500);
}

$liveness = call_ai('/liveness-check', [
    'image_base64' => $imageBase64,
]);
if (!($liveness['is_live'] ?? false)) {
    fail('Liveness check failed', 401);
}

$verify = call_ai('/verify-face', [
    'image_base64' => $imageBase64,
    'stored_encoding' => $storedEncoding,
]);

if (!($verify['matched'] ?? false)) {
    fail('Face verification failed', 401);
}

login_session($user);

json_response([
    'ok' => true,
    'message' => 'Face login successful',
    'distance' => $verify['distance'] ?? null,
    'user' => current_user(),
]);
