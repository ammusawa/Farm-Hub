/**
 * Password Hash Generator
 * 
 * This script generates bcrypt password hashes for seeding the database
 * 
 * Usage: node scripts/generate-password-hash.js [password]
 * 
 * Example: node scripts/generate-password-hash.js Admin123!
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'Admin123!';

bcrypt.hash(password, 10)
  .then(hash => {
    console.log('\n========================================');
    console.log('Password Hash Generator');
    console.log('========================================');
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log('\nSQL INSERT statement:');
    console.log(`INSERT INTO users (name, email, password, role) VALUES`);
    console.log(`('Admin User', 'admin@example.com', '${hash}', 'admin');`);
    console.log('========================================\n');
  })
  .catch(error => {
    console.error('Error generating hash:', error);
    process.exit(1);
  });

