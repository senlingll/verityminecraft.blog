/**
 * AI Poem Generator API Routes
 * Handles poem generation with rate limiting
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { getClientIP } from '../middleware';
import { AnonymousRateLimitService } from '../rate-limit';
import { PoemGeneratorService } from '../poem-generator';
import type { Env } from '../db';

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('/*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
}));

/**
 * POST /api/poem/generate
 * Generate poem based on user input
 */
app.post('/generate', async (c: Context) => {
  try {
    const clientIP = getClientIP(c);
    
    if (!clientIP) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Unable to identify client',
      }, 400);
    }

    // Rate limit: 10 generations per day for free users
    const rateLimitService = new AnonymousRateLimitService(c.env.DB);
    const limitResult = await rateLimitService.checkAndRecordCall(
      clientIP,
      'poem-generator',
      10
    );

    if (!limitResult.allowed) {
      return c.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: limitResult.message || 'Daily limit exceeded',
        remaining: 0,
        resetAt: limitResult.resetAt,
      }, 429);
    }

    // Parse request body
    const body = await c.req.json();
    const { idea, style, mood, language } = body;

    if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Please provide a poem idea (at least 3 characters)',
      }, 400);
    }

    if (idea.length > 1000) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Poem idea is too long (max 1000 characters)',
      }, 400);
    }

    // Generate poem
    const poemService = new PoemGeneratorService(c.env);
    
    if (!poemService.isConfigured()) {
      return c.json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'AI poem service is not configured',
      }, 503);
    }

    const result = await poemService.generatePoem({
      idea: idea.trim(),
      style: style || 'auto',
      mood: mood || 'auto',
      language: language || 'en',
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: 'GENERATION_FAILED',
        message: result.error || 'Failed to generate poem',
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        title: result.title,
        poem: result.poem,
        sections: result.sections,
        style: result.style,
        mood: result.mood,
      },
      rateLimit: {
        remaining: limitResult.remaining,
        resetAt: limitResult.resetAt,
      },
    });

  } catch (error) {
    console.error('Poem generation error:', error);
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }, 500);
  }
});

/**
 * GET /api/poem/quota
 * Get remaining quota for current user
 */
app.get('/quota', async (c: Context) => {
  try {
    const clientIP = getClientIP(c);
    
    if (!clientIP) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Unable to identify client',
      }, 400);
    }

    const rateLimitService = new AnonymousRateLimitService(c.env.DB);
    const status = await rateLimitService.getCallStatus(clientIP, 'poem-generator');

    const maxCalls = 10;
    const remaining = Math.max(0, maxCalls - status.count);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return c.json({
      success: true,
      quota: {
        total: maxCalls,
        used: status.count,
        remaining: remaining,
        resetAt: tomorrow.toISOString(),
      },
    });

  } catch (error) {
    console.error('Get quota error:', error);
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to get quota information',
    }, 500);
  }
});

/**
 * GET /api/poem/health
 * Health check endpoint
 */
app.get('/health', async (c: Context) => {
  const poemService = new PoemGeneratorService(c.env);
  
  return c.json({
    success: true,
    status: 'healthy',
    services: {
      generator: poemService.isConfigured() ? 'configured' : 'not_configured',
      database: !!c.env.DB ? 'available' : 'unavailable',
    },
  });
});

export default app;
