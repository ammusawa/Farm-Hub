-- SQL script to kill idle MySQL connections
-- Run this as MySQL root user to free up connections

-- First, check current connections
SHOW PROCESSLIST;

-- Show connection count
SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';

-- Kill idle connections (sleeping for more than 30 seconds)
-- Replace <process_id> with actual IDs from SHOW PROCESSLIST
-- Example:
-- KILL 123;
-- KILL 124;

-- Or kill all connections from a specific user (be careful!)
-- SELECT CONCAT('KILL ', id, ';') FROM information_schema.processlist 
-- WHERE user = 'your_app_user' AND command = 'Sleep' AND time > 30;

-- Increase max connections (temporary, until MySQL restart)
SET GLOBAL max_connections = 200;

-- To make it permanent, edit my.cnf or my.ini:
-- [mysqld]
-- max_connections = 200

