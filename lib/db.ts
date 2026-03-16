import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '3306'),
  user: process.env.DATABASE_USER || process.env.DB_USER || 'root',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'agriconsult_hub',
  waitForConnections: true,
  connectionLimit: 5, // Reduced to prevent too many connections
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection timeout settings
  connectTimeout: 10000, // 10 seconds
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('MySQL pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('MySQL connection lost, reconnecting...');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.error('Too many MySQL connections! Please check for connection leaks.');
  }
});

// Graceful shutdown - close all connections when process exits
const gracefulShutdown = async () => {
  console.log('\n🔄 Closing database connections...');
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
    process.exit(1);
  }
};

// Handle different termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, but log it
});

export default pool;

