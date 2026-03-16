-- Simple schema update for professional_applications table
-- Run this file to add new columns for profile data
-- If columns already exist, you'll get errors - that's okay, just ignore them

-- Add new columns (ignore errors if they already exist)
ALTER TABLE professional_applications ADD COLUMN experience TEXT;
ALTER TABLE professional_applications ADD COLUMN qualifications TEXT;
ALTER TABLE professional_applications ADD COLUMN specialization VARCHAR(255);
ALTER TABLE professional_applications ADD COLUMN yearsOfExperience INT;
ALTER TABLE professional_applications ADD COLUMN location VARCHAR(255);

-- Create professional_files table for multiple file uploads
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

