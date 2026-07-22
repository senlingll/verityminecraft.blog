/**
 * AI Song Lyrics Generator API Routes
 * Handles lyrics generation with rate limiting
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { getClientIP } from '../middleware';
import { AnonymousRateLimitService } from '../rate-limit';
import { LyricsGeneratorService } from '../lyrics-generator';
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
 * POST /api/lyrics/generate
 * Generate song lyrics based on user input
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
      'lyrics-generator',
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
        message: 'Please provide a song idea (at least 3 characters)',
      }, 400);
    }

    if (idea.length > 1000) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Song idea is too long (max 1000 characters)',
      }, 400);
    }

    // Generate lyrics
    const lyricsService = new LyricsGeneratorService(c.env);
    
    if (!lyricsService.isConfigured()) {
      return c.json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'AI lyrics service is not configured',
      }, 503);
    }

    const result = await lyricsService.generateLyrics({
      idea: idea.trim(),
      style: style || 'auto',
      mood: mood || 'auto',
      language: language || 'en',
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: 'GENERATION_FAILED',
        message: result.error || 'Failed to generate lyrics',
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        title: result.title,
        lyrics: result.lyrics,
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
    console.error('Lyrics generation error:', error);
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }, 500);
  }
});

/**
 * GET /api/lyrics/quota
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
    const status = await rateLimitService.getCallStatus(clientIP, 'lyrics-generator');

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
 * GET /api/lyrics/health
 * Health check endpoint
 */
app.get('/health', async (c: Context) => {
  const lyricsService = new LyricsGeneratorService(c.env);
  
  return c.json({
    success: true,
    status: 'healthy',
    services: {
      generator: lyricsService.isConfigured() ? 'configured' : 'not_configured',
      database: !!c.env.DB ? 'available' : 'unavailable',
    },
  });
});

export default app;
