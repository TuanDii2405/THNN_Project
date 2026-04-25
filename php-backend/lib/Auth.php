<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function login_session(array $user): void
{
    $_SESSION['user'] = [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'full_name' => $user['full_name'] ?? '',
    ];
}

function require_login(): array
{
    $user = current_user();
    if (!$user) {
        fail('Unauthorized', 401);
    }

    return $user;
}

function require_admin(): array
{
    $user = require_login();
    if (($user['role'] ?? '') !== 'admin') {
        fail('Forbidden: admin only', 403);
    }

    return $user;
}
