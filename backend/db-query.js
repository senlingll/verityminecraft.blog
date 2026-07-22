#!/usr/bin/env node

// Database query helper script
// Usage: node db-query.js "SELECT * FROM users"

import { execSync } from 'child_process';

const query = process.argv[2];

if (!query) {
  console.log('Usage: node db-query.js "YOUR SQL QUERY"');
  console.log('');
  console.log('Examples:');
  console.log('  node db-query.js "SELECT * FROM users LIMIT 5"');
  console.log('  node db-query.js "SELECT COUNT(*) FROM orders"');
  console.log('  node db-query.js "DESCRIBE users"');
  process.exit(1);
}

try {
  console.log(`🔍 Executing: ${query}`);
  console.log('');
  
  const command = `wrangler d1 execute aipoemgenerator-blog --command "${query.replace(/"/g, '\\"')}"`;
  const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  
  console.log(output);
} catch (error) {
  console.error('❌ Error executing query:');
  console.error(error.stdout || error.message);
  process.exit(1);
}