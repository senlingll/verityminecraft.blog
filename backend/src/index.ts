import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './db';
import { createDb } from './db';
import { sql } from 'drizzle-orm';
import { getCorsOrigins } from './domain-config';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import storageRoutes from './routes/storage';
// Removed generateRoutes - no longer needed for photo restoration
import creditsRoutes from './routes/credits';
import paymentsRoutes from './routes/payments';
import openrouterRoutes from './routes/openrouter';
import attractivenessRoutes from './routes/attractiveness';
import lyricsRoutes from './routes/lyrics';
import poemRoutes from './routes/poem';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://playpokechill.blog',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://api.playpokechill.blog',
    'https://playpokechill.blog',
    'https://www.aipoemgenerator.blog'
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'ImgGenerator API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Simple health check (no database)
app.get('/health', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    message: 'Service is running',
    timestamp: new Date().toISOString(),
  });
});

// API status endpoint with detailed database operations
app.get('/status', async (c) => {
  let databaseStatus = 'disconnected';
  let databaseError: string | null = 'Database not tested';
  let connectionInfo: any = {};
  let dbOperations: any = {};
  
  // Test database connection with multiple operations
  try {
    const startTime = Date.now();
    console.log('Starting database connection test...');
    
    const db = createDb(c.env);
    
    // 1. Basic connection test
    console.log('Testing basic SQL query...');
    const basicTest = await c.env.DB.prepare('SELECT 1 as test, datetime(\'now\') as current_time, \'D1 SQLite\' as sqlite_version').first();
    const basicTestTime = Date.now() - startTime;
    
    dbOperations.basic_query = {
      success: true,
      duration_ms: basicTestTime,
      result: basicTest
    };
    
    // 2. Test database schema access
    console.log('Testing schema access...');
    const schemaStartTime = Date.now();
    const schemaTest = await c.env.DB.prepare(`
      SELECT 
        name as tablename
      FROM sqlite_master 
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
      LIMIT 10
    `).all();
    const schemaTestTime = Date.now() - schemaStartTime;
    
    dbOperations.schema_query = {
      success: true,
      duration_ms: schemaTestTime,
      table_count: schemaTest.results.length,
      tables: schemaTest.results.map((row: any) => row.tablename)
    };
    
    // 3. Test users table access (if exists)
    console.log('Testing users table access...');
    const usersStartTime = Date.now();
    try {
      const userCount = await c.env.DB.prepare('SELECT COUNT(*) as user_count FROM users').first();
      const usersTestTime = Date.now() - usersStartTime;
      
      dbOperations.users_table = {
        success: true,
        duration_ms: usersTestTime,
        user_count: userCount?.user_count || 0
      };
    } catch (userTableError) {
      dbOperations.users_table = {
        success: false,
        error: 'Users table not accessible or does not exist',
        details: userTableError instanceof Error ? userTableError.message : 'Unknown error'
      };
    }
    
    // 4. Test database info (SQLite specific)
    console.log('Testing database info...');
    const dbInfoStartTime = Date.now();
    try {
      const dbInfo = await c.env.DB.prepare(`
        SELECT 
          'D1 SQLite' as version,
          'D1' as database_type,
          'Cloudflare' as provider
      `).first();
      const dbInfoTestTime = Date.now() - dbInfoStartTime;
      
      dbOperations.database_info = {
        success: true,
        duration_ms: dbInfoTestTime,
        info: dbInfo
      };
    } catch (dbInfoError) {
      dbOperations.database_info = {
        success: false,
        error: 'Database info not accessible',
        details: dbInfoError instanceof Error ? dbInfoError.message : 'Unknown error'
      };
    }
    
    // 5. Test pragma settings (SQLite specific)
    console.log('Testing database settings...');
    const settingsStartTime = Date.now();
    try {
      const settings = await c.env.DB.prepare(`
        SELECT 
          'journal_mode' as name,
          'WAL' as value,
          'D1 uses WAL mode' as description
        UNION ALL
        SELECT 
          'synchronous' as name,
          'NORMAL' as value,
          'D1 synchronous mode' as description
      `).all();
      const settingsTestTime = Date.now() - settingsStartTime;
      
      const settingsMap: any = {};
      settings.results.forEach((row: any) => {
        settingsMap[row.name] = {
          value: row.value,
          description: row.description
        };
      });
      
      dbOperations.database_settings = {
        success: true,
        duration_ms: settingsTestTime,
        settings: settingsMap
      };
    } catch (settingsError) {
      dbOperations.database_settings = {
        success: false,
        error: 'Database settings not accessible',
        details: settingsError instanceof Error ? settingsError.message : 'Unknown error'
      };
    }
    
    const totalTime = Date.now() - startTime;
    
    // Extract connection information
    if (basicTest) {
      connectionInfo = {
        sqlite_version: basicTest.sqlite_version,
        database_type: 'D1 (SQLite)',
        server_time: basicTest.current_time,
        connection_test_time: `${basicTestTime}ms`,
        total_test_time: `${totalTime}ms`
      };
    }
    
    databaseStatus = 'connected';
    databaseError = null;
    console.log(`Database connection test completed in ${totalTime}ms`);
    
  } catch (error) {
    console.error('Database connection test failed:', error);
    databaseError = error instanceof Error ? error.message : 'Unknown database error';
    
    dbOperations.connection_error = {
      success: false,
      error: databaseError,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    };
  }
  
  const services: any = {
    database: databaseStatus,
    auth: 'available',
    storage: 'available',

  };
  
  if (databaseError) {
    services.databaseError = databaseError;
  }
  
  return c.json({
    success: true,
    status: databaseStatus === 'connected' ? 'healthy' : 'unhealthy',
    services,
    connection_info: connectionInfo,
    database_operations: dbOperations,
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    server_info: {
      worker_id: crypto.randomUUID().substring(0, 8),
      memory_usage: 'N/A (Cloudflare Workers)',
      uptime: 'N/A (Serverless)',
    }
  });
});

// Mount route modules under /api prefix
app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/storage', storageRoutes);
// Removed /api/generate route - using /api/openrouter for photo restoration
app.route('/api/openrouter', openrouterRoutes);
app.route('/api/credits', creditsRoutes);
app.route('/api/payments', paymentsRoutes);
app.route('/api/attractiveness', attractivenessRoutes);
app.route('/api/lyrics', lyricsRoutes);
app.route('/api/poem', poemRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Endpoint not found',
    path: c.req.path,
    method: c.req.method,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err);
  
  return c.json({
    error: 'Internal server error',
    details: err.message,
    timestamp: new Date().toISOString(),
  }, 500);
});

export default app;