import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// R2 Bucket binding name constant
export const R2_IMAGES_BUCKET = 'aipoemgenerator-blog';

export interface Env {
  ENVIRONMENT?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  OPENROUTER_API_KEY: string;
  PUBLIC_BASE_URL?: string;
  [R2_IMAGES_BUCKET]: R2Bucket;
  DB: D1Database; // Cloudflare D1 database binding
}

export function createDb(env: Env) {
  try {
    console.log('Creating D1 database connection...');
    
    if (!env.DB) {
      throw new Error('D1 database binding is missing');
    }
    
    console.log('D1 database binding found');
    
    // Create Drizzle instance with D1 adapter
    const db = drizzle(env.DB, { 
      schema,
      logger: env.ENVIRONMENT === 'development' // Enable query logging in development
    });
    
    console.log('Drizzle D1 instance created successfully');
    
    return db;
  } catch (error) {
    console.error('D1 database connection error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to create D1 database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export type Database = ReturnType<typeof createDb>;