import type { Env } from './db';
import { R2_IMAGES_BUCKET } from './db';

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  savedFilename?: string;
  originalFilename?: string;
  originalExtension?: string;
  error?: string;
}

export interface ImageMetadata {
  filename: string;
  contentType: string;
  size: number;
  userUuid: string;
  createdAt: Date;
}

export class StorageService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // Sanitize email to safe path segment: lowercase, replace @->_at_, .->_, and other unsafe chars -> _
  private sanitizeEmail(email: string): string {
    const lower = (email || '').toLowerCase().trim();
    return lower
      .replace(/@/g, '_at_')
      .replace(/\./g, '_')
      .replace(/[^a-z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // Generate human-readable filename
  private generateImageKey(
    userEmail: string,
    originalFilename: string,
    options?: { variant?: string; prompt?: string }
  ): string {
    const timestamp = Date.now();

    // Extract base name and extension
    const lastDot = originalFilename.lastIndexOf('.');
    const rawBase = lastDot > 0 ? originalFilename.slice(0, lastDot) : originalFilename;
    const rawExt = lastDot > 0 ? originalFilename.slice(lastDot + 1) : '';

    const ext = (rawExt || 'jpg').toLowerCase();

    // Sanitize base name
    const baseSanitized = rawBase
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 50);

    // Prompt slug if provided (for generated images)
    const promptSlug = options?.prompt
      ? options.prompt
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60)
      : '';

    const variant = options?.variant ? options.variant.toLowerCase() : undefined;

    // Build readable filename
    let filename: string;
    if (variant === 'original') {
      filename = `${timestamp}_original_${baseSanitized || 'image'}.${ext}`;
    } else if (variant) {
      const name = promptSlug || baseSanitized || 'image';
      filename = `${timestamp}_${variant}_${name}.${ext}`;
    } else {
      filename = `${timestamp}_${baseSanitized || 'image'}.${ext}`;
    }

    // Date-based folders: userUuid/YYYY/MM/DD/filename
    const d = new Date(timestamp);
    const yyyy = d.getUTCFullYear().toString();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');

    const emailPrefix = this.sanitizeEmail(userEmail);
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    return `${emailPrefix}/${yyyymmdd}/${filename}`;
  }

  // Upload image to R2 storage
  async uploadImage(
    imageData: ArrayBuffer,
    filename: string,
    contentType: string,
    userUuid: string,
    userEmail: string,
    options?: { variant?: string; prompt?: string }
  ): Promise<UploadResult> {
    try {
      // Derive original base name and extension
      const lastDot = filename.lastIndexOf('.');
      const origBase = lastDot > 0 ? filename.slice(0, lastDot) : filename;
      const origExt = (lastDot > 0 ? filename.slice(lastDot + 1) : '').toLowerCase();

      const key = this.generateImageKey(userEmail, filename, options);
      const savedFilename = key.split('/').pop() || key;

      // Upload to R2
      await this.env[R2_IMAGES_BUCKET].put(key, imageData, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata: {
          userUuid,
          userEmail: userEmail || '',
          originalFilename: filename,
          originalExtension: origExt,
          variant: options?.variant || '',
          prompt: options?.prompt || '',
          uploadedAt: new Date().toISOString(),
        },
      });

      // Log key for debugging
      console.log('R2 upload success:', { key, contentType, size: imageData.byteLength, userUuid });

      // Generate public URL served by this worker
      const url = `/api/storage/images/${key}`;

      return {
        success: true,
        url,
        key,
        savedFilename,
        originalFilename: filename,
        originalExtension: origExt,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Get image from R2 storage
  async getImage(key: string): Promise<R2ObjectBody | null> {
    try {
      return await this.env[R2_IMAGES_BUCKET].get(key);
    } catch (error) {
      console.error('Error getting image:', error);
      return null;
    }
  }

  // Delete image from R2 storage
  async deleteImage(key: string): Promise<boolean> {
    try {
      await this.env[R2_IMAGES_BUCKET].delete(key);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  // List user's images
  async listUserImages(userEmail: string, limit = 50): Promise<string[]> {
    try {
      const emailPrefix = this.sanitizeEmail(userEmail);
      const objects = await this.env[R2_IMAGES_BUCKET].list({
        prefix: `${emailPrefix}/`,
        limit,
      });

      return objects.objects.map((obj: any) => obj.key);
    } catch (error) {
      console.error('Error listing user images:', error);
      return [];
    }
  }

  // Get image metadata
  async getImageMetadata(key: string): Promise<ImageMetadata | null> {
    try {
      const object = await this.env[R2_IMAGES_BUCKET].get(key);
      
      if (!object) return null;

      return {
        filename: object.customMetadata?.originalFilename || 'unknown',
        contentType: object.httpMetadata?.contentType || 'image/jpeg',
        size: object.size,
        userUuid: object.customMetadata?.userUuid || '',
        createdAt: new Date(object.customMetadata?.uploadedAt || Date.now()),
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return null;
    }
  }

  // Generate signed URL for direct upload (optional for frontend direct upload)
  async generateSignedUploadUrl(
    userUuid: string,
    filename: string,
    contentType: string
  ): Promise<string | null> {
    // Note: R2 doesn't support presigned URLs like S3 in the same way
    // This would require implementing a different approach
    // For now, we'll handle uploads through the API
    return null;
  }

  // Save base64 image to R2 storage
  async saveBase64Image(
    base64Data: string,
    userUuid: string,
    userEmail: string,
    keyPrefix: string,
    mimeType?: string,
    options?: { variant?: string; prompt?: string }
  ): Promise<UploadResult> {
    try {
      // Detect mime type if not provided
      let contentType = mimeType || 'image/png';
      let extension = 'png';
      
      // Try to detect format from base64 header if mime type not provided
      if (!mimeType) {
        const base64Header = base64Data.substring(0, 50);
        if (base64Header.startsWith('/9j/')) {
          contentType = 'image/jpeg';
          extension = 'jpg';
        } else if (base64Header.startsWith('iVBORw0KGgo')) {
          contentType = 'image/png';
          extension = 'png';
        } else if (base64Header.startsWith('UklGR')) {
          contentType = 'image/webp';
          extension = 'webp';
        }
      } else {
        // Extract extension from mime type
        if (contentType.includes('jpeg')) extension = 'jpg';
        else if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('webp')) extension = 'webp';
        else if (contentType.includes('gif')) extension = 'gif';
      }

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Generate filename with prefix
      const timestamp = Date.now();
      const sanitizedPrefix = keyPrefix
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 30);
      
      const filename = `${timestamp}_${sanitizedPrefix}.${extension}`;
      // Date-based folders: userUuid/YYYY/MM/DD/filename
      const d = new Date(timestamp);
      const yyyy = d.getUTCFullYear().toString();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const emailPrefix = this.sanitizeEmail(userEmail);
      const yyyymmdd = `${yyyy}${mm}${dd}`;
      const key = `${emailPrefix}/${yyyymmdd}/${filename}`;

      // Upload to R2
      await this.env[R2_IMAGES_BUCKET].put(key, arrayBuffer, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata: {
          userUuid,
          userEmail: userEmail || '',
          originalFilename: filename,
          originalExtension: extension,
          variant: options?.variant || 'generated',
          prompt: options?.prompt || '',
          source: 'openrouter_base64',
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log('Base64 image saved to R2:', { key, contentType, size: arrayBuffer.byteLength, userUuid });

      // Generate public URL served by this worker
      const url = `/api/storage/images/${key}`;

      return {
        success: true,
        url,
        key,
        savedFilename: filename,
        originalFilename: filename,
        originalExtension: extension,
      };
    } catch (error) {
      console.error('Error saving base64 image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save base64 image',
      };
    }
  }

  // Validate image file
  validateImageFile(contentType: string, size: number): { valid: boolean; error?: string } {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.',
      };
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 10MB.',
      };
    }

    return { valid: true };
  }
}