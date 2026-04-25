<?php

declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../lib/Auth.php';

require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, username, role, full_name, is_locked, created_at, updated_at, (face_encoding IS NOT NULL) AS has_face_data FROM users ORDER BY id DESC')->fetchAll();
    json_response(['ok' => true, 'users' => $rows]);
}

$input = json_input();

if ($method === 'POST') {
    $username = trim((string)($input['username'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $role = (string)($input['role'] ?? 'user');
    $fullName = trim((string)($input['full_name'] ?? ''));

    if ($username === '' || $password === '') {
        fail('username and password are required');
    }

    if (!in_array($role, ['admin', 'user'], true)) {
        fail('Invalid role');
    }

    $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, role, full_name, is_locked) VALUES (:username, :password_hash, :role, :full_name, 0)');
    $stmt->execute([
        'username' => $username,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
        'full_name' => $fullName,
    ]);

    json_response(['ok' => true, 'message' => 'User created', 'id' => (int)$pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }

    $fields = [];
    $params = ['id' => $id];

    if (isset($input['full_name'])) {
        $fields[] = 'full_name = :full_name';
        $params['full_name'] = trim((string)$input['full_name']);
    }
    if (isset($input['role'])) {
        $role = (string)$input['role'];
        if (!in_array($role, ['admin', 'user'], true)) {
            fail('Invalid role');
        }
        $fields[] = 'role = :role';
        $params['role'] = $role;
    }
    if (isset($input['is_locked'])) {
        $fields[] = 'is_locked = :is_locked';
        $params['is_locked'] = (int)((bool)$input['is_locked']);
    }

    if ($fields === []) {
        fail('No update fields provided');
    }

    $sql = 'UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_response(['ok' => true, 'message' => 'User updated']);
}

if ($method === 'DELETE') {
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        fail('id is required');
    }

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
    $stmt->execute(['id' => $id]);

    json_response(['ok' => true, 'message' => 'User deleted']);
}

fail('Method not allowed', 405);
