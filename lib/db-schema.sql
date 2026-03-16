-- ============================================================================
-- AgriConsult Hub - Complete Database Schema
-- ============================================================================
-- 
-- This schema includes ALL tables and columns for the AgriConsult Hub platform:
--
-- CORE TABLES:
--   1. users                    - User accounts with roles (user, professional, admin)
--   2. professional_applications - Professional verification applications
--   3. professional_files       - Multiple file uploads for applications
--   4. content                  - Articles, videos, and tips with full metadata
--
-- INTERACTION TABLES:
--   5. ratings                  - User ratings (1-5 stars) for content
--   6. comments                 - Threaded comments on content
--   7. content_likes           - Like/dislike system for content
--   8. subscriptions           - User subscriptions to professionals
--
-- VIDEO & TRANSLATION TABLES:
--   9. video_transcripts        - Video transcripts and subtitles (multi-language)
--  10. content_translations     - Translated video files and processing status
--
-- UI & LOCALIZATION:
--  11. translations             - UI label translations (en, ha, ig, yo)
--
-- ============================================================================
-- USAGE:
--   Run: npm run setup-db
--   This will:
--   - Create the database if it doesn't exist
--   - Create all tables with proper indexes and foreign keys
--   - Add any missing columns to existing tables
--   - Verify all tables exist and are properly configured
-- ============================================================================

CREATE DATABASE IF NOT EXISTS agriconsult_hub;
USE agriconsult_hub;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'professional', 'admin') DEFAULT 'user',
  isVerifiedProfessional BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Professional applications table
CREATE TABLE IF NOT EXISTS professional_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  credentialsFile VARCHAR(500),
  experience TEXT,
  qualifications TEXT,
  specialization VARCHAR(255),
  yearsOfExperience INT,
  location VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  adminNotes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Content table
CREATE TABLE IF NOT EXISTS content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  language ENUM('en', 'ha', 'ig', 'yo') DEFAULT 'en',
  authorId INT NOT NULL,
  cropType VARCHAR(100),
  contentType ENUM('article', 'video', 'tip') DEFAULT 'article',
  tags VARCHAR(500),
  videoFile VARCHAR(500) NULL,
  videoThumbnail VARCHAR(500) NULL,
  videoDuration INT NULL COMMENT 'Duration in seconds',
  videoSize BIGINT NULL COMMENT 'File size in bytes',
  videoFormat VARCHAR(50) NULL COMMENT 'Video format (mp4, webm, etc.)',
  videoResolution VARCHAR(20) NULL COMMENT 'Video resolution (e.g., 1920x1080)',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_language (language),
  INDEX idx_authorId (authorId),
  INDEX idx_cropType (cropType),
  INDEX idx_contentType (contentType),
  FULLTEXT idx_search (title, body, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  contentId INT NOT NULL,
  stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_content (userId, contentId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_contentId (contentId),
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comments table (supports threaded comments)
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  contentId INT NOT NULL,
  parentId INT NULL,
  message TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
  FOREIGN KEY (parentId) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_contentId (contentId),
  INDEX idx_parentId (parentId),
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Translations table for UI labels
CREATE TABLE IF NOT EXISTS translations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  en TEXT NOT NULL,
  ha TEXT,
  ig TEXT,
  yo TEXT,
  INDEX idx_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default translations (ignore duplicates if they already exist)
INSERT IGNORE INTO translations (`key`, en, ha, ig, yo) VALUES
('app.name', 'AgriConsult Hub', 'Cibiyar Shawarwari Noma', 'AgriConsult Hub', 'Agbaye Igbimọ Agbe'),
('nav.home', 'Home', 'Gida', 'Ụlọ', 'Ile'),
('nav.search', 'Search', 'Bincika', 'Chọọ', 'Wa'),
('nav.upload', 'Upload', 'Loda', 'Bulite', 'Gbe soke'),
('nav.login', 'Login', 'Shiga', 'Banye', 'Wọle'),
('nav.logout', 'Logout', 'Fita', 'Pụọ', 'Jade'),
('nav.admin', 'Admin', 'Admin', 'Admin', 'Admin'),
('home.featured', 'Featured Content', 'Abubuwan da aka Nuna', 'Ọdịnaya Egosipụtara', 'Akojo Oju-iwe'),
('content.rate', 'Rate', 'Ƙididdigewa', 'Ọnụọgụgụ', 'Iwọn'),
('content.comment', 'Comment', 'Sharhi', 'Okwu', 'Ọrọ'),
('content.ask', 'Ask Question', 'Yi Tambaya', 'Jụọ Ajụjụ', 'Beere Ibeere'),
('button.submit', 'Submit', 'Tura', 'Nyefee', 'Fi silẹ'),
('button.cancel', 'Cancel', 'Soke', 'Kagbuo', 'Fagilee'),
('button.save', 'Save', 'Ajiye', 'Chekwaa', 'Fi pamọ'),
('form.title', 'Title', 'Take', 'Aha', 'Akọle'),
('form.body', 'Content', 'Abun ciki', 'Ọdịnaya', 'Akojo'),
('form.language', 'Language', 'Harshe', 'Asụsụ', 'Ede'),
('form.crop', 'Crop Type', 'Nau''in Amfanin gona', 'Ụdị Ihe ọkụkụ', 'Iru Eso'),
('form.type', 'Content Type', 'Nau''in Abun ciki', 'Ụdị Ọdịnaya', 'Iru Akojo'),
('search.placeholder', 'Search for farming tips...', 'Nemo shawarwari game da noma...', 'Chọọ ndụmọdụ ọrụ ugbo...', 'Wa imọran ọgbẹ...'),
('filter.crop', 'Filter by Crop', 'Tace ta Amfanin gona', 'Nchacha site na Ihe ọkụkụ', 'Ṣe asọtọ nipasẹ Eso'),
('filter.language', 'Filter by Language', 'Tace ta Harshe', 'Nchacha site na Asụsụ', 'Ṣe asọtọ nipasẹ Ede'),
('filter.type', 'Filter by Type', 'Tace ta Nau''i', 'Nchacha site na Ụdị', 'Ṣe asọtọ nipasẹ Iru'),
('professional.apply', 'Apply as Professional', 'Nema a matsayin Ƙwararru', 'Tinye akwụkwọ dị ka Ọkachamara', 'Waye gẹgẹ bi Olukọni'),
('professional.upload', 'Upload Credentials', 'Loda Takaddun shaida', 'Bulite Asambodo', 'Gbe Awọn Ẹri soke'),
('admin.approve', 'Approve', 'Yarda', 'Kwenye', 'Gba'),
('admin.reject', 'Reject', 'ƙi', 'Jụ', 'Kọ'),
('offline.banner', 'You are offline. Showing cached content.', 'Kuna cikin yanayin kashe. Ana nuna abubuwan da aka adana.', 'Ị nọ na ntanetị. Na-egosi ọdịnaya echekwara.', 'O wa ni aifoju. Nfihan akojo ti a fi pamọ.');

-- Content likes table (for storing likes/dislikes)
CREATE TABLE IF NOT EXISTS content_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  contentId INT NOT NULL,
  type ENUM('like', 'dislike') NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_content (userId, contentId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_contentId (contentId),
  INDEX idx_userId (userId),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Subscriptions table (for users to subscribe to professionals)
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscriberId INT NOT NULL COMMENT 'User who is subscribing',
  professionalId INT NOT NULL COMMENT 'Professional being subscribed to',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_subscription (subscriberId, professionalId),
  FOREIGN KEY (subscriberId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (professionalId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_subscriber (subscriberId),
  INDEX idx_professional (professionalId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Content translations table (for storing translated videos)
CREATE TABLE IF NOT EXISTS content_translations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contentId INT NOT NULL COMMENT 'Reference to content table',
  sourceLanguage VARCHAR(10) NOT NULL COMMENT 'Original video language',
  targetLanguage VARCHAR(10) NOT NULL COMMENT 'Translated video language',
  translatedVideoFile VARCHAR(500) NULL COMMENT 'Path to translated video file',
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_content_target (contentId, targetLanguage),
  FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_contentId (contentId),
  INDEX idx_targetLanguage (targetLanguage),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Professional files table (for multiple file uploads in applications)
CREATE TABLE IF NOT EXISTS professional_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  applicationId INT NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  fileType VARCHAR(100),
  fileSize INT,
  uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicationId) REFERENCES professional_applications(id) ON DELETE CASCADE,
  INDEX idx_applicationId (applicationId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Video transcripts table (for storing video transcripts and subtitles)
CREATE TABLE IF NOT EXISTS video_transcripts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contentId INT NOT NULL,
  language VARCHAR(10) NOT NULL,
  transcript TEXT,
  subtitles JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_content_language (contentId, language),
  FOREIGN KEY (contentId) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_contentId (contentId),
  INDEX idx_language (language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE platform_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    planName VARCHAR(100) NOT NULL COMMENT 'e.g., Monthly Premium, Annual Pro, Basic Owner',
    paymentProvider VARCHAR(50) DEFAULT NULL COMMENT 'stripe, paystack, flutterwave, manual',
    subscriptionId VARCHAR(100) DEFAULT NULL COMMENT 'Provider subscription reference',
    status ENUM('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'expired') 
        NOT NULL DEFAULT 'active',
    amountPaid DECIMAL(12,2) NOT NULL COMMENT 'Amount paid in Naira',
    currency ENUM('NGN') DEFAULT 'NGN',
    currentPeriodStart DATETIME NOT NULL,
    currentPeriodEnd DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for fast lookups
    INDEX idx_userId (userId),
    INDEX idx_status (status),
    INDEX idx_periodEnd (currentPeriodEnd),
    INDEX idx_subscriptionId (subscriptionId),
    
    -- Foreign key - MUST match users.id type exactly
    CONSTRAINT fk_platform_sub_user 
        FOREIGN KEY (userId) 
        REFERENCES users(id) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;