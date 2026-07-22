import { Hono } from 'hono';
import type { Env } from '../db';
import { createDb } from '../db';
import { authMiddleware } from '../middleware';
import { OpenRouterService } from '../openrouter';
import { StorageService } from '../storage';
import { CreditsService } from '../credits';
import { getRoomDesignPrompt, isValidStyle, isValidRoomFunction } from '../styles';
import { CREDITS, CREDIT_TRANSACTION_TYPES } from '../constants';

const openrouterRoutes = new Hono<{ Bindings: Env }>();

// Apply authentication middleware to all OpenRouter routes
openrouterRoutes.use('/*', authMiddleware());

// Room design with existing image URL
openrouterRoutes.post('/style-transfer', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const body = await c.req.json();
    const { input_image_url, style, room_function } = body;

    if (!input_image_url || typeof input_image_url !== 'string') {
      return c.json({ error: 'Input image URL is required' }, 400);
    }

    // Validate style and room function if provided
    if (style && !isValidStyle(style)) {
      return c.json({ error: 'Invalid style selected' }, 400);
    }

    if (room_function && !isValidRoomFunction(room_function)) {
      return c.json({ error: 'Invalid room function selected' }, 400);
    }

    // Generate room design prompt based on user selections
    const prompt = getRoomDesignPrompt(style, room_function);

    const db = createDb(c.env);
    const creditsService = new CreditsService(db);

    // Check and deduct credits (2 credits required)
    const totalCredits = await creditsService.getUserTotalCredits(auth.user.uuid);
    if (totalCredits < CREDITS.STYLE_TRANSFER) {
      return c.json({
        success: false,
        error_code: 'insufficient_credits',
        error_type: 'insufficient_credits',
        error: `Insufficient credits. ${CREDITS.STYLE_TRANSFER} credits required.`
      }, 402);
    }

    let creditTransaction = null;

    try {
      // Deduct credits
      creditTransaction = await creditsService.useCredits(
        auth.user.uuid,
        CREDITS.STYLE_TRANSFER,
        CREDIT_TRANSACTION_TYPES.OPENROUTER_STYLE_TRANSFER,
        'room_design'
      );

      console.log(`${CREDITS.STYLE_TRANSFER} credits deducted for room design:`, creditTransaction.trans_no);

      // Initialize services
      const openRouterService = new OpenRouterService(c.env);
      const storageService = new StorageService(c.env);

      // Transfer style using OpenRouter
      const transferResult = await openRouterService.transferStyle(input_image_url, prompt);

      if (!transferResult.success) {
        // Refund credits on failure
        await creditsService.addCredits({
          user_uuid: auth.user.uuid,
          trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
          credits: CREDITS.STYLE_TRANSFER,
          order_no: creditTransaction.trans_no
        });

        return c.json({
          success: false,
          error: transferResult.error || 'Style transfer failed'
        }, 500);
      }

      // Save the base64 image to R2
      const saveResult = await storageService.saveBase64Image(
        transferResult.base64Image!,
        auth.user.uuid,
        (auth.user.email || ''),
        'photo_restoration',
        transferResult.mimeType,
        {
          variant: 'photo_restoration',
          prompt: prompt
        }
      );

      if (!saveResult.success) {
        // Refund credits on storage failure
        await creditsService.addCredits({
          user_uuid: auth.user.uuid,
          trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
          credits: CREDITS.STYLE_TRANSFER,
          order_no: creditTransaction.trans_no
        });

        return c.json({
          success: false,
          error: saveResult.error || 'Failed to save generated image'
        }, 500);
      }

      // Get updated credit balance
      const newBalance = await creditsService.getUserTotalCredits(auth.user.uuid);

      return c.json({
        success: true,
        message: 'Room design completed successfully',
        data: {
          design_id: 'room_design',
          style: style || 'modern',
          room_function: room_function || 'living-room',
          input_image_url,
          output_url: saveResult.url,
          saved: saveResult,
          credit_transaction: creditTransaction.trans_no,
          new_balance: newBalance,
          prompt: prompt
        }
      });

    } catch (error) {
      // Refund credit if transaction was created but process failed
      if (creditTransaction) {
        try {
          await creditsService.addCredits({
            user_uuid: auth.user.uuid,
            trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
            credits: CREDITS.STYLE_TRANSFER,
            order_no: creditTransaction.trans_no
          });
          console.log(`${CREDITS.STYLE_TRANSFER} credits refunded due to processing error`);
        } catch (refundError) {
          console.error('Failed to refund credit:', refundError);
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('OpenRouter style transfer error:', error);
    
    // Handle specific credit errors
    if (error instanceof Error && error.message.includes('insufficient_credits')) {
      return c.json({
        success: false,
        error_code: 'insufficient_credits',
        error_type: 'insufficient_credits',
        error: 'Insufficient credits'
      }, 402);
    }

    return c.json({
      success: false,
      error: 'Style transfer failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Room design with file upload
openrouterRoutes.post('/style-transfer-upload', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }

    const contentType = c.req.header('Content-Type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return c.json({ error: 'Content-Type must be multipart/form-data' }, 400);
    }

    const form = await c.req.formData();
    const fileItem = form.get('image');
    const style = form.get('style') as string;
    const roomFunction = form.get('room_function') as string;

    // Validate file
    if (!fileItem || typeof fileItem === 'string') {
      return c.json({ error: 'No image file provided' }, 400);
    }

    // Validate style and room function if provided
    if (style && !isValidStyle(style)) {
      return c.json({ error: 'Invalid style selected' }, 400);
    }

    if (roomFunction && !isValidRoomFunction(roomFunction)) {
      return c.json({ error: 'Invalid room function selected' }, 400);
    }

    const file = fileItem as File;
    const storageService = new StorageService(c.env);
    
    const validation = storageService.validateImageFile(file.type, file.size);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const db = createDb(c.env);
    const creditsService = new CreditsService(db);

    // Check credits before processing
    const totalCredits = await creditsService.getUserTotalCredits(auth.user.uuid);
    if (totalCredits < CREDITS.STYLE_TRANSFER) {
      return c.json({
        success: false,
        error_code: 'insufficient_credits',
        error_type: 'insufficient_credits',
        error: `Insufficient credits. ${CREDITS.STYLE_TRANSFER} credits required.`
      }, 402);
    }

    let creditTransaction = null;

    try {
      // Deduct credits
      creditTransaction = await creditsService.useCredits(
        auth.user.uuid,
        CREDITS.STYLE_TRANSFER,
        CREDIT_TRANSACTION_TYPES.OPENROUTER_STYLE_TRANSFER,
        'upload_room_design'
      );

      console.log(`${CREDITS.STYLE_TRANSFER} credits deducted for room design:`, creditTransaction.trans_no);

      // Upload original file to R2 to get public URL
      const arrayBuffer = await file.arrayBuffer();
      const uploadOriginal = await storageService.uploadImage(
        arrayBuffer,
        file.name,
        file.type,
        auth.user.uuid,
        (auth.user.email || ''),
        { variant: 'original' }
      );

      if (!uploadOriginal.success || !uploadOriginal.url) {
        // Refund credits on upload failure
        await creditsService.addCredits({
          user_uuid: auth.user.uuid,
          trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
          credits: CREDITS.STYLE_TRANSFER,
          order_no: creditTransaction.trans_no
        });

        return c.json({ 
          success: false, 
          error: uploadOriginal.error || 'Failed to upload image to storage' 
        }, 500);
      }

      // Build absolute URL for OpenRouter (must be publicly accessible)
      const publicBaseUrl = c.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
      const absoluteInputUrl = `${publicBaseUrl}${uploadOriginal.url}`;

      // Generate room design prompt and perform room design
      const prompt = getRoomDesignPrompt(style, roomFunction);
      const openRouterService = new OpenRouterService(c.env);
      
      const transferResult = await openRouterService.transferStyle(absoluteInputUrl, prompt);

      if (!transferResult.success) {
        // Refund credits on transfer failure
        await creditsService.addCredits({
          user_uuid: auth.user.uuid,
          trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
          credits: CREDITS.STYLE_TRANSFER,
          order_no: creditTransaction.trans_no
        });

        return c.json({
          success: false,
          error: transferResult.error || 'Style transfer failed'
        }, 500);
      }

      // Save the generated image
      const saveResult = await storageService.saveBase64Image(
        transferResult.base64Image!,
        auth.user.uuid,
        (auth.user.email || ''),
        'room_design',
        transferResult.mimeType,
        {
          variant: 'room_design',
          prompt: prompt
        }
      );

      if (!saveResult.success) {
        // Refund credits on save failure
        await creditsService.addCredits({
          user_uuid: auth.user.uuid,
          trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
          credits: CREDITS.STYLE_TRANSFER,
          order_no: creditTransaction.trans_no
        });

        return c.json({
          success: false,
          error: saveResult.error || 'Failed to save generated image'
        }, 500);
      }

      // Get updated credit balance
      const newBalance = await creditsService.getUserTotalCredits(auth.user.uuid);

      return c.json({
        success: true,
        message: 'Room design completed successfully',
        data: {
          design_id: 'room_design',
          style: style || 'modern',
          room_function: roomFunction || 'living-room',
          input_image_url: absoluteInputUrl,
          input_saved: uploadOriginal,
          output_url: saveResult.url,
          saved: saveResult,
          credit_transaction: creditTransaction.trans_no,
          new_balance: newBalance,
          prompt: prompt
        }
      });

    } catch (error) {
      // Refund credit if transaction was created but process failed
      if (creditTransaction) {
        try {
          await creditsService.addCredits({
            user_uuid: auth.user.uuid,
            trans_type: CREDIT_TRANSACTION_TYPES.OPENROUTER_REFUND,
            credits: CREDITS.STYLE_TRANSFER,
            order_no: creditTransaction.trans_no
          });
          console.log(`${CREDITS.STYLE_TRANSFER} credits refunded due to room design processing error`);
        } catch (refundError) {
          console.error('Failed to refund credit:', refundError);
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('OpenRouter style transfer upload error:', error);
    
    // Handle specific credit errors
    if (error instanceof Error && error.message.includes('insufficient_credits')) {
      return c.json({
        success: false,
        error_code: 'insufficient_credits',
        error_type: 'insufficient_credits',
        error: 'Insufficient credits'
      }, 402);
    }

    return c.json({
      success: false,
      error: 'Room design upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default openrouterRoutes;
