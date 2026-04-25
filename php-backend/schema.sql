CREATE DATABASE IF NOT EXISTS face_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE face_auth;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    full_name VARCHAR(150) DEFAULT NULL,
    face_encoding JSON DEFAULT NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, role, full_name)
VALUES ('admin', '$2y$10$j5Jk6ZE3uefMwW6EqN7xUeHq9QmUL3ncm1j95D7R3SxQ4kQf5yb6S', 'admin', 'System Admin')
ON DUPLICATE KEY UPDATE username = username;

-- Default admin password is: Admin@123
