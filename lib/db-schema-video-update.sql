-- Add video file column to content table
-- Run this to add video upload support

ALTER TABLE content ADD COLUMN videoFile VARCHAR(500) NULL;

