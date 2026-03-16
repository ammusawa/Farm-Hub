-- AgriConsult Hub - Database Seed File (with real password hashes)
-- 
-- IMPORTANT: Before using this file, generate real password hashes!
-- Run: node scripts/generate-password-hash.js YourPassword
-- Then replace the placeholder hashes below with the generated ones
--
-- Default passwords used in this seed:
-- - Admin users: Admin123!
-- - Test users: Test123!

USE agriconsult_hub;

-- ============================================
-- ADMIN USERS
-- ============================================
-- Password: Admin123!
-- Generate hash: node scripts/generate-password-hash.js Admin123!

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Admin User', 'admin@agriconsult.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Admin123!', 'admin', FALSE, NOW()),
('Super Admin', 'superadmin@agriconsult.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Admin123!', 'admin', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  password=VALUES(password),
  role=VALUES(role);

-- ============================================
-- TEST USERS (Regular Users)
-- ============================================
-- Password: Test123!
-- Generate hash: node scripts/generate-password-hash.js Test123!

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('John Farmer', 'farmer1@example.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Test123!', 'user', FALSE, NOW()),
('Mary Grower', 'farmer2@example.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Test123!', 'user', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  password=VALUES(password);

-- ============================================
-- TEST PROFESSIONAL USERS (Not Verified)
-- ============================================
-- Password: Test123!

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Dr. Agriculture Expert', 'professional1@example.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Test123!', 'professional', FALSE, NOW()),
('Master Farmer', 'professional2@example.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Test123!', 'professional', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  password=VALUES(password),
  role=VALUES(role);

-- ============================================
-- VERIFIED PROFESSIONAL USER
-- ============================================
-- Password: Test123!
-- This user can immediately upload content

INSERT INTO users (name, email, password, role, isVerifiedProfessional, createdAt) VALUES
('Verified Expert', 'verified@example.com', 'REPLACE_WITH_BCRYPT_HASH_FOR_Test123!', 'professional', TRUE, NOW())
ON DUPLICATE KEY UPDATE 
  name=VALUES(name),
  password=VALUES(password),
  role=VALUES(role),
  isVerifiedProfessional=VALUES(isVerifiedProfessional);

-- ============================================
-- SAMPLE CONTENT (Optional)
-- ============================================
-- Uncomment to add sample content for testing

/*
INSERT INTO content (title, body, language, authorId, cropType, contentType, tags, createdAt) 
SELECT 
  'Introduction to Maize Farming',
  'Maize farming is one of the most important agricultural practices in Nigeria. This guide covers the basics of maize cultivation, from planting to harvest.',
  'en',
  id,
  'maize',
  'article',
  'maize, farming, agriculture, guide',
  NOW()
FROM users 
WHERE email = 'verified@example.com'
LIMIT 1;
*/

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these queries to verify the seed data:

-- SELECT id, name, email, role, isVerifiedProfessional FROM users;
-- SELECT COUNT(*) as admin_count FROM users WHERE role = 'admin';
-- SELECT COUNT(*) as professional_count FROM users WHERE role = 'professional';
-- SELECT COUNT(*) as user_count FROM users WHERE role = 'user';

