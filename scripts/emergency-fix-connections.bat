@echo off
echo ========================================
echo Emergency MySQL Connection Fix
echo ========================================
echo.
echo This script will help you fix "Too many connections" error
echo.

echo Step 1: Stopping any running Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Please restart MySQL service manually:
echo   1. Open Services (services.msc)
echo   2. Find MySQL service
echo   3. Right-click and select Restart
echo.
pause

echo.
echo Step 3: After MySQL restarts, you can:
echo   - Run: npm run dev
echo   - Or connect to MySQL and run: scripts\kill-mysql-connections.sql
echo.
pause

