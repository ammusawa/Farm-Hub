-- Create content_translations table for storing translated videos
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
