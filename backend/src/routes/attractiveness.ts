/**
 * AI Pregnancy Test API Routes
 * Handles anonymous pregnancy test photo analysis with rate limiting
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import { getClientIP } from '../middleware';
import { AnonymousRateLimitService } from '../rate-limit';
import { AttractivenessAnalyzerService } from '../attractiveness-analyzer';
import type { Env } from '../db';

const app = new Hono<{ Bindings: Env }>();

// CORS configuration for frontend
app.use('/*', cors({
  origin: (origin) => origin, // Allow all origins for public API
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
}));

/**
 * POST /api/attractiveness/analyze
 * Analyze pregnancy test photo
 */
app.post('/analyze', async (c: Context) => {
  try {
    // 1. Get client IP for rate limiting
    const clientIP = getClientIP(c);
    
    if (!clientIP) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Unable to identify client',
      }, 400);
    }

    // 2. Check rate limit (3 calls per day for anonymous users)
    const rateLimitService = new AnonymousRateLimitService(c.env.DB);
    const limitResult = await rateLimitService.checkAndRecordCall(
      clientIP,
      'pregnancy-test-checker',
      3 // Maximum 3 calls per day
    );

    // 3. If rate limit exceeded, return error
    if (!limitResult.allowed) {
      return c.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: limitResult.message || 'Daily limit exceeded',
        remaining: 0,
        resetAt: limitResult.resetAt,
      }, 429);
    }

    // 4. Parse request body
    const body = await c.req.json();
    const { image, language } = body;

    if (!image) {
      return c.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Image data is required',
      }, 400);
    }

    // 5. Validate image format and size
    if (!image.startsWith('data:image/')) {
      return c.json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Invalid image format. Please upload a valid image.',
      }, 400);
    }

    // Check approximate size (base64 is ~33% larger than original)
    const base64Length = image.length;
    const approximateSize = (base64Length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (approximateSize > maxSize) {
      return c.json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Image size must be less than 10MB',
      }, 400);
    }

    // 6. Analyze pregnancy test using AI
    const analyzerService = new AttractivenessAnalyzerService(c.env);
    
    if (!analyzerService.isConfigured()) {
      return c.json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'AI pregnancy test service is not configured',
      }, 503);
    }

    // Use the image data directly (base64 data URL)
    const userLanguage = language || 'en';
    const analysisResult = await analyzerService.analyzeAttractiveness(image, userLanguage);

    if (!analysisResult.success) {
      return c.json({
        success: false,
        error: 'ANALYSIS_FAILED',
        message: analysisResult.error || 'Failed to analyze pregnancy test from image',
      }, 500);
    }

    // 7. Return success response with rate limit info
    return c.json({
      success: true,
      data: {
        // Pregnancy test result fields
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        lineIntensity: analysisResult.lineIntensity,
        testType: analysisResult.testType,
        characteristics: analysisResult.characteristics,
        description: analysisResult.description,
        recommendation: analysisResult.recommendation,
        rating: analysisResult.rating,
        features: analysisResult.features,
        // Legacy compatibility for frontend
        bodyFatPercentage: analysisResult.bodyFatPercentage,
        bodyType: analysisResult.bodyType,
        fatDistribution: analysisResult.fatDistribution,
        healthCategory: analysisResult.healthCategory,
        animalType: analysisResult.animalType,
        animalPercentage: analysisResult.animalPercentage,
        animalBeautyType: analysisResult.animalBeautyType,
      },
      rateLimit: {
        remaining: limitResult.remaining,
        resetAt: limitResult.resetAt,
      },
    });

  } catch (error) {
    console.error('Attractiveness analysis error:', error);
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }, 500);
  }
});

/**
 * GET /api/attractiveness/quota
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
    const status = await rateLimitService.getCallStatus(
      clientIP,
      'pregnancy-test-checker'
    );

    const maxCalls = 3;
    const remaining = Math.max(0, maxCalls - status.count);
    
    // Calculate reset time (next day midnight)
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
 * GET /api/attractiveness/health
 * Health check endpoint
 */
app.get('/health', async (c: Context) => {
  const analyzerService = new AttractivenessAnalyzerService(c.env);
  
  return c.json({
    success: true,
    status: 'healthy',
    services: {
      analyzer: analyzerService.isConfigured() ? 'configured' : 'not_configured',
      storage: !!c.env.R2_IMAGES_BUCKET ? 'available' : 'unavailable',
      database: !!c.env.DB ? 'available' : 'unavailable',
    },
  });
});

export default app;
