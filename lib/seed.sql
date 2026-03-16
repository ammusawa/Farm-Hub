-- AgriConsult Hub - Database Seed File
-- This file creates initial admin and test users
-- Run this after creating the database schema

USE agriconsult_hub;

-- ============================================
-- ADMIN USERS
-- ============================================
-- Default admin password: Admin123!
-- Password hash generated with bcrypt (10 rounds)
-- You can change the password after first login

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Admin User', 'admin@agriconsult.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'admin', FALSE, NOW()),
('Super Admin', 'superadmin@agriconsult.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'admin', FALSE, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- TEST USERS (Regular Users)
-- ============================================
-- Default password for all test users: Test123!
-- Password hash: $2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('John Farmer', 'farmer1@example.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'user', FALSE, NOW()),
('Mary Grower', 'farmer2@example.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'user', FALSE, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- TEST PROFESSIONAL USERS
-- ============================================
-- Default password: Test123!
-- These users are registered as professionals but not yet verified

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Dr. Agriculture Expert', 'professional1@example.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'professional', FALSE, NOW()),
('Master Farmer', 'professional2@example.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'professional', FALSE, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- VERIFIED PROFESSIONAL USER
-- ============================================
-- This user is already verified and can upload content

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Verified Expert', 'verified@example.com', '$2a$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', 'professional', TRUE, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- NOTE: The password hashes above are placeholders
-- You need to generate real bcrypt hashes
-- ============================================
-- To generate a proper password hash, use one of these methods:
--
-- Method 1: Using Node.js
-- Run: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YourPassword', 10).then(hash => console.log(hash));"
--
-- Method 2: Using online tool (less secure, use only for development)
-- Visit: https://bcrypt-generator.com/
--
-- Method 3: Register through the web interface and update role
-- 1. Register a user at /login
-- 2. Run: UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
--
-- ============================================

