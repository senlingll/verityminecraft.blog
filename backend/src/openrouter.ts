// OpenRouter API Client for Style Transfer
export interface OpenRouterResponse {
  id: string;
  provider: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      images?: Array<{
        type: 'image_url';
        image_url: {
          url: string; // base64 data:image/png;base64,... format
        };
      }>;
    };
    finish_reason: string;
  }>;
}

export interface StyleTransferResult {
  success: boolean;
  base64Image?: string; // Pure base64 without data: prefix
  mimeType?: string; // e.g., 'image/png'
  error?: string;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private model = 'google/gemini-2.5-flash-image-preview';

  constructor(env: any) {
    this.apiKey = env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
  }

  /**
   * Transfer image style using OpenRouter's Gemini 2.5 Flash Image Preview
   * @param imageUrl - Public URL of the source image
   * @param prompt - Style transfer prompt
   * @returns Promise with base64 image or error
   */
  async transferStyle(imageUrl: string, prompt: string): Promise<StyleTransferResult> {
    try {
      console.log(`Starting style transfer with prompt: "${prompt}" for image: ${imageUrl}`);
      
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ]
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        return {
          success: false,
          error: `OpenRouter API error: ${response.status} - ${errorText}`
        };
      }

      const data = await response.json() as OpenRouterResponse;
      console.log('OpenRouter response received:', data.id);

      // Extract the base64 image from the response
      const choice = data.choices?.[0];
      if (!choice || !choice.message.images || choice.message.images.length === 0) {
        return {
          success: false,
          error: 'No images returned from OpenRouter'
        };
      }

      const imageData = choice.message.images[0].image_url.url;
      
      // Parse base64 data URL (format: data:image/png;base64,iVBORw0K...)
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return {
          success: false,
          error: 'Invalid base64 image format returned from OpenRouter'
        };
      }

      const mimeType = matches[1]; // e.g., 'image/png'
      const base64Data = matches[2]; // Pure base64 string

      console.log(`Style transfer successful. Image type: ${mimeType}, size: ${base64Data.length} characters`);

      return {
        success: true,
        base64Image: base64Data,
        mimeType: mimeType
      };

    } catch (error) {
      console.error('OpenRouter style transfer error:', error);
      return {
        success: false,
        error: `Style transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate that the environment is properly configured
   * @returns boolean indicating if service is ready
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get service status for debugging
   * @returns object with configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      model: this.model,
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    };
  }
}
