import { Hono } from 'hono';
import type { Env } from '../db';
import { createDb } from '../db';
import { UserService } from '../user';
import { OrderService } from '../orders';
import { ApiKeyService } from '../apikeys';
import { authMiddleware } from '../middleware';

const userRoutes = new Hono<{ Bindings: Env }>();

// Apply authentication middleware to all user routes
userRoutes.use('/*', authMiddleware());

// Get user profile
userRoutes.get('/profile', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    const userService = new UserService(db);
    
    const user = await userService.findUserByUuid(auth.user.uuid);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        locale: user.locale,
        invite_code: user.invite_code,
        is_affiliate: user.is_affiliate,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return c.json({
      error: 'Failed to get user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Update user profile
userRoutes.patch('/profile', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const body = await c.req.json();
    const { nickname, locale } = body;
    
    const db = createDb(c.env);
    const userService = new UserService(db);
    
    const updatedUser = await userService.updateUser(auth.user.uuid, {
      nickname,
      locale,
    });
    
    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        uuid: updatedUser.uuid,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        avatar_url: updatedUser.avatar_url,
        locale: updatedUser.locale,
        invite_code: updatedUser.invite_code,
        is_affiliate: updatedUser.is_affiliate,
        updated_at: updatedUser.updated_at,
      },
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return c.json({
      error: 'Failed to update user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user statistics (credits, orders, etc.)
userRoutes.get('/stats', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    
    // This would typically involve joins with credits and orders tables
    // For now, return basic user info
    const userService = new UserService(db);
    const user = await userService.findUserByUuid(auth.user.uuid);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      stats: {
        user_uuid: user.uuid,
        total_credits: 0,
        total_orders: 0,
        is_affiliate: user.is_affiliate,
        invite_code: user.invite_code,
        member_since: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return c.json({
      error: 'Failed to get user statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

  // Get user's orders
userRoutes.get('/my-orders', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    // Get pagination parameters
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const rawStatus = c.req.query('status'); // Optional status filter
    // Treat empty strings as null to avoid filtering inconsistency
    const status = rawStatus && rawStatus.trim() !== '' ? rawStatus : null;
    
    // Validate pagination parameters
    if (limit > 100) {
      return c.json({ error: 'Limit cannot exceed 100' }, 400);
    }
    
    if (limit < 1 || offset < 0) {
      return c.json({ error: 'Invalid pagination parameters' }, 400);
    }
    
    const db = createDb(c.env);
    const orderService = new OrderService(db);
    const userService = new UserService(db);
    
    // Get user info for email fallback
    const user = await userService.findUserByUuid(auth.user.uuid);
    const userEmail = user?.email || '';
    
    // Add debug logging
    console.log('[DEBUG] my-orders request:', {
      userUuid: auth.user.uuid,
      userEmail,
      limit,
      offset,
      rawStatus,
      normalizedStatus: status
    });
    
    let orders;
    let totalCount;
    
    if (status) {
      // Use status filtering - get both orders and count with same filter
      orders = await orderService.getUserOrdersByStatus(auth.user.uuid, status, limit, offset);
      // We need a count method that uses the same status filter
      // For now, let's get all orders with this status and count them
      const allOrdersWithStatus = await orderService.getUserOrdersByStatus(auth.user.uuid, status, 1000, 0);
      totalCount = allOrdersWithStatus.length;
    } else {
      // Try enhanced methods first with email fallback
      try {
        orders = await orderService.getUserOrdersWithEmailFallback(auth.user.uuid, userEmail, limit, offset);
        totalCount = await orderService.getUserOrderCountWithEmailFallback(auth.user.uuid, userEmail);
      } catch (fallbackError) {
        console.warn('[DEBUG] Enhanced methods failed, falling back to basic methods:', fallbackError);
        // Fallback to original methods if enhanced ones fail
        orders = await orderService.getUserOrders(auth.user.uuid, limit, offset);
        totalCount = await orderService.getUserOrderCount(auth.user.uuid);
      }
    }
    
    console.log('[DEBUG] my-orders result:', {
      ordersLength: orders.length,
      totalCount,
      status
    });
    
    return c.json({
      success: true,
      data: {
        orders,
        pagination: {
          limit,
          offset,
          total: totalCount,
          has_more: offset + limit < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    return c.json({
      error: 'Failed to get user orders',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's order summary
userRoutes.get('/my-orders/summary', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    const orderService = new OrderService(db);
    const userService = new UserService(db);
    
    // Get user info for email fallback
    const user = await userService.findUserByUuid(auth.user.uuid);
    const userEmail = user?.email || '';
    
    console.log('[DEBUG] my-orders/summary request:', {
      userUuid: auth.user.uuid,
      userEmail
    });
    
    let summary;
    try {
      // Try enhanced method with email fallback first
      summary = await orderService.getUserOrderSummaryWithEmailFallback(auth.user.uuid, userEmail);
    } catch (fallbackError) {
      console.warn('[DEBUG] Enhanced summary method failed, falling back to basic method:', fallbackError);
      // Fallback to original method
      summary = await orderService.getUserOrderSummary(auth.user.uuid);
    }
    
    console.log('[DEBUG] my-orders/summary result:', summary);
    
    return c.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get user order summary error:', error);
    return c.json({
      error: 'Failed to get user order summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's API keys
userRoutes.get('/api-keys', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    // Get pagination parameters
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Validate pagination parameters
    if (limit > 100) {
      return c.json({ error: 'Limit cannot exceed 100' }, 400);
    }
    
    if (limit < 1 || offset < 0) {
      return c.json({ error: 'Invalid pagination parameters' }, 400);
    }
    
    const db = createDb(c.env);
    const apiKeyService = new ApiKeyService(db);
    
    const apiKeys = await apiKeyService.getUserApiKeys(auth.user.uuid, limit, offset);
    const totalCount = await apiKeyService.getUserApiKeyCount(auth.user.uuid);
    
    return c.json({
      success: true,
      data: {
        api_keys: apiKeys,
        pagination: {
          limit,
          offset,
          total: totalCount,
          has_more: offset + limit < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get user API keys error:', error);
    return c.json({
      error: 'Failed to get user API keys',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's API key summary
userRoutes.get('/api-keys/summary', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    const apiKeyService = new ApiKeyService(db);
    
    const summary = await apiKeyService.getUserApiKeySummary(auth.user.uuid);
    
    return c.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get user API key summary error:', error);
    return c.json({
      error: 'Failed to get user API key summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Create new API key
userRoutes.post('/api-keys', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const body = await c.req.json();
    const { title } = body;
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'API key title is required' }, 400);
    }
    
    if (title.length > 100) {
      return c.json({ error: 'API key title cannot exceed 100 characters' }, 400);
    }
    
    const db = createDb(c.env);
    const apiKeyService = new ApiKeyService(db);
    
    const newApiKey = await apiKeyService.createApiKey({
      title: title.trim(),
      user_uuid: auth.user.uuid
    });
    
    return c.json({
      success: true,
      data: {
        api_key: newApiKey,
        message: 'API key created successfully. Please save it securely as it will not be shown again.'
      }
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return c.json({
      error: 'Failed to create API key',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Delete API key
userRoutes.delete('/api-keys/:id', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const apiKeyId = parseInt(c.req.param('id'));
    
    if (isNaN(apiKeyId)) {
      return c.json({ error: 'Invalid API key ID' }, 400);
    }
    
    const db = createDb(c.env);
    const apiKeyService = new ApiKeyService(db);
    
    const deleted = await apiKeyService.deleteApiKey(apiKeyId, auth.user.uuid);
    
    if (!deleted) {
      return c.json({ error: 'API key not found or access denied' }, 404);
    }
    
    return c.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    return c.json({
      error: 'Failed to delete API key',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Update API key status
userRoutes.patch('/api-keys/:id', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const apiKeyId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { status } = body;
    
    if (isNaN(apiKeyId)) {
      return c.json({ error: 'Invalid API key ID' }, 400);
    }
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return c.json({ error: 'Invalid status. Must be "active" or "inactive"' }, 400);
    }
    
    const db = createDb(c.env);
    const apiKeyService = new ApiKeyService(db);
    
    const updatedApiKey = await apiKeyService.updateApiKeyStatus(apiKeyId, auth.user.uuid, status);
    
    if (!updatedApiKey) {
      return c.json({ error: 'API key not found or access denied' }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        api_key: updatedApiKey
      }
    });
  } catch (error) {
    console.error('Update API key status error:', error);
    return c.json({
      error: 'Failed to update API key status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});


export default userRoutes;