/**
 * Script to check and fix MySQL connection issues
 * Run this if you're getting "Too many connections" errors
 */

const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkConnections() {
  let connection;
  try {
    // Try to connect with a timeout
    connection = await Promise.race([
      mysql.createConnection({
        host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306'),
        user: process.env.DATABASE_USER || process.env.DB_USER || 'root',
        password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '',
        connectTimeout: 5000,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);

    console.log('🔍 Checking MySQL connection status...\n');

    // Check max connections
    const [maxConn] = await connection.execute("SHOW VARIABLES LIKE 'max_connections'");
    console.log(`📊 Max connections: ${maxConn[0].Value}`);

    // Check current connections
    const [currentConn] = await connection.execute("SHOW STATUS LIKE 'Threads_connected'");
    console.log(`📊 Current connections: ${currentConn[0].Value}`);

    // Show all processes
    const [processes] = await connection.execute("SHOW PROCESSLIST");
    console.log(`\n📋 Active connections (${processes.length}):`);
    
    const groupedByUser = {};
    processes.forEach(proc => {
      const user = proc.User || 'unknown';
      if (!groupedByUser[user]) {
        groupedByUser[user] = 0;
      }
      groupedByUser[user]++;
    });

    Object.entries(groupedByUser).forEach(([user, count]) => {
      console.log(`   ${user}: ${count} connections`);
    });

    // Show idle connections (sleeping for more than 30 seconds)
    const idleConnections = processes.filter(p => 
      p.Command === 'Sleep' && p.Time > 30
    );
    
    if (idleConnections.length > 0) {
      console.log(`\n⚠️  Found ${idleConnections.length} idle connections (sleeping > 30s)`);
      console.log('   These can be killed to free up connections.\n');
      
      console.log('💡 To kill idle connections, run:');
      idleConnections.forEach(proc => {
        console.log(`   KILL ${proc.Id};`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (parseInt(currentConn[0].Value) > parseInt(maxConn[0].Value) * 0.8) {
      console.log('   ⚠️  Connection usage is high (>80%)');
      console.log('   Consider increasing max_connections:');
      console.log('   SET GLOBAL max_connections = 200;');
    }
    
    console.log('\n   To increase max_connections permanently, edit my.cnf:');
    console.log('   [mysqld]');
    console.log('   max_connections = 200');
    console.log('   Then restart MySQL service.\n');

  } catch (error) {
    if (error.code === 'ER_CON_COUNT_ERROR' || error.message.includes('Too many connections')) {
      console.error('❌ Error: Too many connections!\n');
      console.log('🔧 Immediate Solutions:\n');
      
      console.log('1. RESTART YOUR DEVELOPMENT SERVER:');
      console.log('   - Stop the server (Ctrl+C)');
      console.log('   - Wait 5 seconds');
      console.log('   - Restart: npm run dev\n');
      
      console.log('2. INCREASE MySQL MAX_CONNECTIONS (requires MySQL admin access):');
      console.log('   Connect to MySQL as root and run:');
      console.log('   SET GLOBAL max_connections = 200;\n');
      
      console.log('3. KILL IDLE CONNECTIONS (if you can connect as root):');
      console.log('   mysql -u root -p');
      console.log('   SHOW PROCESSLIST;');
      console.log('   KILL <process_id>;  -- Kill idle connections\n');
      
      console.log('4. RESTART MySQL SERVICE:');
      console.log('   Windows: Restart MySQL service from Services');
      console.log('   Linux/Mac: sudo systemctl restart mysql\n');
      
      console.log('5. CHECK FOR MULTIPLE SERVER INSTANCES:');
      console.log('   - Make sure only ONE instance of npm run dev is running');
      console.log('   - Check Task Manager (Windows) or Activity Monitor (Mac)\n');
      
      console.log('💡 The connection pool is set to max 5 connections.');
      console.log('   If you still get errors after restarting, increase MySQL max_connections.\n');
      
      // Try to provide SQL commands to run manually
      console.log('📝 SQL Commands to run manually (as MySQL root):');
      console.log('   SET GLOBAL max_connections = 200;');
      console.log('   SHOW VARIABLES LIKE "max_connections";');
      console.log('   SHOW STATUS LIKE "Threads_connected";');
      console.log('   SHOW PROCESSLIST;');
      
    } else {
      console.error('❌ Error:', error.message);
      console.log('\n💡 Make sure MySQL is running and credentials are correct.');
    }
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // Ignore errors when closing
      }
    }
  }
}

checkConnections();

