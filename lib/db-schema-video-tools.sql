-- Add video metadata columns to content table
-- Run this to add advanced video features

ALTER TABLE content ADD COLUMN videoFile VARCHAR(500) NULL;
ALTER TABLE content ADD COLUMN videoThumbnail VARCHAR(500) NULL;
ALTER TABLE content ADD COLUMN videoDuration INT NULL COMMENT 'Duration in seconds';
ALTER TABLE content ADD COLUMN videoSize BIGINT NULL COMMENT 'File size in bytes';
ALTER TABLE content ADD COLUMN videoFormat VARCHAR(50) NULL COMMENT 'Video format (mp4, webm, etc.)';
ALTER TABLE content ADD COLUMN videoResolution VARCHAR(20) NULL COMMENT 'Video resolution (e.g., 1920x1080)';

