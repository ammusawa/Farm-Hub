-- Create content_likes table for storing likes/dislikes
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

