import { Hono } from 'hono';
import type { Env } from '../db';
import { StorageService } from '../storage';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

const storageRoutes = new Hono<{ Bindings: Env }>();

// Upload image (requires authentication)
storageRoutes.post('/upload', authMiddleware(), async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const storageService = new StorageService(c.env);
    
    // Get file from form data
    const formData = await c.req.formData();
    const fileItem = formData.get('image');
    
    if (!fileItem || typeof fileItem === 'string') {
      return c.json({ error: 'No image file provided' }, 400);
    }
    
    const file = fileItem as File;

    // Validate file
    const validation = storageService.validateImageFile(file.type, file.size);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    // Convert file to ArrayBuffer
    const imageData = await file.arrayBuffer();
    
    // Upload to R2 (mark as original)
    const result = await storageService.uploadImage(
      imageData,
      file.name,
      file.type,
      auth.user.uuid,
      (auth.user.email || ''),
      { variant: 'original' }
    );

    if (result.success) {
      return c.json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url: result.url,
          key: result.key,
          savedFilename: result.savedFilename,
          originalFilename: result.originalFilename,
          originalExtension: result.originalExtension,
        },
      });
    } else {
      return c.json({
        success: false,
        error: result.error,
      }, 500);
    }
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get image (public access)
storageRoutes.get('/images/*', async (c) => {
  try {
    // Extract key from URL path more reliably
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    
    // Remove the /api/storage/images/ prefix to get the key
    const imagesPrefix = '/api/storage/images/';
    if (!pathname.startsWith(imagesPrefix)) {
      return c.json({ error: 'Invalid image path' }, 400);
    }
    
    const key = pathname.substring(imagesPrefix.length);
    console.log('Image access request - Key:', key, 'URL:', c.req.url);
    
    if (!key || key.length === 0) {
      return c.json({ 
        error: 'Invalid image key',
        debug: {
          url: c.req.url,
          pathname,
          extractedKey: key
        }
      }, 400);
    }

    const storageService = new StorageService(c.env);
    const object = await storageService.getImage(key);

    if (!object) {
      return c.json({ error: 'Image not found' }, 404);
    }

    const contentType = object.httpMetadata?.contentType || 'image/jpeg';
    const etag = object.etag;

    // Check if client has cached version
    const clientETag = c.req.header('If-None-Match');
    if (clientETag && etag && clientETag === etag) {
      return c.body(null, 304);
    }

    // Attempt to return as ArrayBuffer (avoids TS issues on body type)
    const objAny: any = object as any;
    if (typeof objAny.arrayBuffer === 'function') {
      const buf = await objAny.arrayBuffer();
      return new Response(buf, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag || ''
        },
      });
    }

    // Fallback to streaming body if available
    if (objAny.body) {
      return new Response(objAny.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag || ''
        },
      });
    }

    // If neither available, return 500
    return c.json({ error: 'Image content unavailable' }, 500);
  } catch (error) {
    console.error('Error serving image:', error);
    return c.json({ error: 'Failed to serve image' }, 500);
  }
});

// List user's images (requires authentication)
storageRoutes.get('/my-images', authMiddleware(), async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const storageService = new StorageService(c.env);
    const limit = parseInt(c.req.query('limit') || '50');
    
    const imageKeys = await storageService.listUserImages((auth.user.email || ''), limit);
    
    // Get metadata for each image
    const images = await Promise.all(
      imageKeys.map(async (key) => {
        const metadata = await storageService.getImageMetadata(key);
        return {
          key,
          url: `/api/storage/images/${key}`,
          ...metadata,
        };
      })
    );

    return c.json({
      success: true,
      images: images.filter(img => img.filename), // Filter out failed metadata fetches
    });
  } catch (error) {
    console.error('Error listing images:', error);
    return c.json({
      error: 'Failed to list images',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Delete image (requires authentication)
storageRoutes.delete('/images/*', authMiddleware(), async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    // Extract key from URL path like the GET /images/* route
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const imagesPrefix = '/api/storage/images/';
    if (!pathname.startsWith(imagesPrefix)) {
      return c.json({ error: 'Invalid image path' }, 400);
    }
    const key = pathname.substring(imagesPrefix.length);

    const storageService = new StorageService(c.env);
    
    // Verify user owns this image
    const metadata = await storageService.getImageMetadata(key);
    if (!metadata || metadata.userUuid !== auth.user.uuid) {
      return c.json({ error: 'Image not found or access denied' }, 404);
    }
    
    const success = await storageService.deleteImage(key);
    
    if (success) {
      return c.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } else {
      return c.json({
        success: false,
        error: 'Failed to delete image',
      }, 500);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    return c.json({
      error: 'Delete failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get image metadata (requires authentication for user's own images)
storageRoutes.get('/metadata/*', authMiddleware(), async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    // Extract key from URL path: /api/storage/metadata/{key...}
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const metaPrefix = '/api/storage/metadata/';
    if (!pathname.startsWith(metaPrefix)) {
      return c.json({ error: 'Invalid metadata path' }, 400);
    }
    const key = pathname.substring(metaPrefix.length);

    const storageService = new StorageService(c.env);
    
    const metadata = await storageService.getImageMetadata(key);
    
    if (!metadata) {
      return c.json({ error: 'Image not found' }, 404);
    }

    // Only allow users to see metadata for their own images
    if (metadata.userUuid !== auth.user.uuid) {
      return c.json({ error: 'Access denied' }, 403);
    }

    return c.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error('Error getting metadata:', error);
    return c.json({
      error: 'Failed to get metadata',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default storageRoutes;