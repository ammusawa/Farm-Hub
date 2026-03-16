-- Create subscriptions table for users to subscribe to professionals
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

