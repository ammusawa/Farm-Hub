#!/bin/bash

echo "========================================"
echo "Emergency MySQL Connection Fix"
echo "========================================"
echo ""
echo "This script will help you fix 'Too many connections' error"
echo ""

echo "Step 1: Stopping any running Node.js processes..."
pkill -f "node.*dev" 2>/dev/null
sleep 3

echo ""
echo "Step 2: Restarting MySQL service..."
if command -v systemctl &> /dev/null; then
    sudo systemctl restart mysql
    echo "MySQL service restarted"
elif command -v service &> /dev/null; then
    sudo service mysql restart
    echo "MySQL service restarted"
else
    echo "Please restart MySQL manually"
fi

echo ""
echo "Step 3: Waiting for MySQL to start..."
sleep 5

echo ""
echo "✅ Done! You can now:"
echo "   - Run: npm run dev"
echo "   - Or connect to MySQL and increase max_connections"
echo ""

