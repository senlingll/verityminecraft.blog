/**
 * AI Pregnancy Test Analyzer Service
 * Uses OpenRouter API with Qwen Vision model to analyze pregnancy test photos
 */

export interface PregnancyTestAnalysisRequest {
  imageUrl: string;      // Public URL or base64 of the image to analyze
}

export interface PregnancyTestAnalysisResult {
  success: boolean;
  result?: string;               // "Positive", "Negative", "Invalid", "Faint Positive"
  confidence?: string;           // Confidence level (High/Medium/Low)
  lineIntensity?: string;        // Line intensity description
  testType?: string;             // Type of test detected (Line test, Digital, etc.)
  characteristics?: string[];    // Observations about the test
  description?: string;          // Detailed description
  recommendation?: string;       // What to do next
  rating?: {
    label: string;               // Result label
    description: string;         // Detailed description
  };
  error?: string;
}

// Legacy interface for compatibility with existing frontend
export interface AttractivenessAnalysisResult extends PregnancyTestAnalysisResult {
  bodyFatPercentage?: number;
  bodyType?: string;
  fatDistribution?: string;
  healthCategory?: string;
  features?: string[];
  animalType?: string;
  animalPercentage?: number;
  animalBeautyType?: string;
  allAnimals?: { [key: string]: number };
  goldenRatioScore?: string;
  facialHarmony?: string;
  measurements?: string[];
}

export class AttractivenessAnalyzerService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string = 'qwen/qwen2.5-vl-72b-instruct';
  private siteUrl: string;
  private siteName: string;

  constructor(env: any) {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.siteUrl = env.PUBLIC_BASE_URL || 'https://playpokechill.blog';
    this.siteName = 'AI Pregnancy Test';
  }

  /**
   * Analyze pregnancy test from image
   * @param imageUrl - Public URL or base64 data URL of the image
   * @param language - Language code (en, etc.)
   * @returns PregnancyTestAnalysisResult
   */
  async analyzeAttractiveness(
    imageUrl: string,
    language: string = 'en'
  ): Promise<AttractivenessAnalysisResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenRouter API key not configured',
      };
    }

    try {
      const prompt = this.buildAnalysisPrompt(language);

      console.log('Analyzing pregnancy test with model:', this.model);

      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', errorText);
        return {
          success: false,
          error: `API request failed: ${response.status}`,
        };
      }

      const data: any = await response.json();
      console.log('OpenRouter API response received');

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('No content in AI response:', JSON.stringify(data));
        return {
          success: false,
          error: 'No response from AI model',
        };
      }

      console.log('AI response content:', content);

      const result = this.parseAnalysisResponse(content);
      console.log('Parsed result:', JSON.stringify(result));

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Pregnancy test analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }

  /**
   * Build the analysis prompt for pregnancy test analysis
   */
  private buildAnalysisPrompt(language: string = 'en'): string {
    const prompt = `You are an AI pregnancy test analyzer. Analyze the pregnancy test photo and determine the result.

IMPORTANT: Look carefully at the test result window and identify:
1. The control line (C) - should always be present for a valid test
2. The test line (T) - presence indicates positive result

**Result Categories:**

- **Positive**: Two clear lines visible (control line + test line). Even a faint test line is positive.
- **Faint Positive**: Control line is clear, test line is visible but faint/light. This usually indicates early pregnancy.
- **Negative**: Only one line visible (control line only). No test line present.
- **Invalid**: No control line visible, or test appears damaged/unclear. Test should be retaken.
- **Evaporation Line**: A colorless indent line that appears after the test dries (not a true positive).

**What to Look For:**
- Control line (C): Should be dark and clear for valid test
- Test line (T): Any color (pink/blue depending on brand) indicates positive
- Line intensity: Dark, medium, faint, or very faint
- Test type: Line test, digital test, plus/minus test
- Test brand if identifiable

**For Digital Tests:**
- Look for "Pregnant", "Not Pregnant", "+", "-", or weeks indicator
- Digital tests are easier to read - report exactly what is displayed

CRITICAL: Respond with ONLY valid JSON. No text before or after. No markdown code blocks.

Required JSON format:
{
  "result": "Positive" or "Faint Positive" or "Negative" or "Invalid" or "Evaporation Line",
  "confidence": "High" or "Medium" or "Low",
  "lineIntensity": "description of line darkness (e.g., 'Dark and clear', 'Faint but visible', 'Very faint', 'No test line')",
  "testType": "Line Test" or "Digital Test" or "Plus/Minus Test" or "Unknown",
  "characteristics": ["observation 1", "observation 2", "observation 3", "observation 4"],
  "description": "Detailed description of what was observed on the test",
  "recommendation": "What the user should do next based on the result",
  "rating": {
    "label": "Result label (Positive/Negative/etc.)",
    "description": "Explanation of the result and what it means"
  }
}

**IMPORTANT: Write all text fields in English.**

Analyze the pregnancy test image carefully and return ONLY the JSON object.`;

    return prompt;
  }


  /**
   * Parse the AI response and extract structured data
   */
  private parseAnalysisResponse(content: string): Partial<AttractivenessAnalysisResult> {
    try {
      console.log('Parsing AI response, content length:', content.length);

      let jsonStr = content.trim();
      jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('No valid JSON braces found in response');
        return this.createDefaultResult(content);
      }

      const jsonCandidate = jsonStr.substring(firstBrace, lastBrace + 1);
      console.log('Extracted JSON candidate:', jsonCandidate);

      let parsed: any;
      try {
        parsed = JSON.parse(jsonCandidate);
        console.log('Successfully parsed JSON:', parsed);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return this.createDefaultResult(content);
      }

      // Extract pregnancy test result fields
      const testResult = parsed.result || parsed.Result || 'Unknown';
      const confidence = parsed.confidence || parsed.Confidence || 'Medium';
      const lineIntensity = parsed.lineIntensity || parsed.line_intensity || 'Unknown';
      const testType = parsed.testType || parsed.test_type || 'Line Test';
      const characteristics = Array.isArray(parsed.characteristics) ? parsed.characteristics : [];
      const description = parsed.description || parsed.Description || '';
      const recommendation = parsed.recommendation || parsed.Recommendation || '';

      // Map result to a display value for frontend compatibility
      const resultMapping: { [key: string]: string } = {
        'Positive': 'Positive',
        'Faint Positive': 'Faint Positive',
        'Negative': 'Negative',
        'Invalid': 'Invalid',
        'Evaporation Line': 'Evaporation Line'
      };

      const displayResult = resultMapping[testResult] || testResult;

      const result: Partial<AttractivenessAnalysisResult> = {
        // Pregnancy test specific fields
        result: displayResult,
        confidence: confidence,
        lineIntensity: lineIntensity,
        testType: testType,
        characteristics: characteristics,
        description: description,
        recommendation: recommendation,
        rating: parsed.rating || {
          label: displayResult,
          description: description,
        },
        features: characteristics,
        // Legacy compatibility mapping for frontend
        bodyFatPercentage: testResult === 'Positive' ? 100 : testResult === 'Faint Positive' ? 75 : 0,
        bodyType: displayResult,
        fatDistribution: lineIntensity,
        healthCategory: confidence,
        animalType: displayResult,
        animalPercentage: testResult === 'Positive' ? 100 : testResult === 'Faint Positive' ? 75 : 0,
        animalBeautyType: testType,
      };

      console.log('Final parsed result:', result);
      return result;

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.createDefaultResult(content);
    }
  }

  /**
   * Create a default result when parsing fails
   */
  private createDefaultResult(content: string): Partial<AttractivenessAnalysisResult> {
    console.log('Creating default result from content');

    const lowerContent = content.toLowerCase();
    let detectedResult = 'Unknown';
    let detectedConfidence = 'Low';

    // Try to detect result from text
    if (lowerContent.includes('positive') && !lowerContent.includes('not positive') && !lowerContent.includes('negative')) {
      if (lowerContent.includes('faint')) {
        detectedResult = 'Faint Positive';
      } else {
        detectedResult = 'Positive';
      }
      detectedConfidence = 'Medium';
    } else if (lowerContent.includes('negative') || lowerContent.includes('not pregnant')) {
      detectedResult = 'Negative';
      detectedConfidence = 'Medium';
    } else if (lowerContent.includes('invalid') || lowerContent.includes('error')) {
      detectedResult = 'Invalid';
      detectedConfidence = 'Medium';
    }

    return {
      result: detectedResult,
      confidence: detectedConfidence,
      lineIntensity: 'Unable to determine',
      testType: 'Unknown',
      characteristics: [
        'Test image analyzed',
        'Result interpretation attempted',
        'Please ensure good lighting and clear photo',
        'Consider retaking photo if result unclear'
      ],
      description: `The test result appears to be ${detectedResult}. For best results, please upload a clear, well-lit photo of your pregnancy test.`,
      recommendation: detectedResult === 'Positive' || detectedResult === 'Faint Positive' 
        ? 'Consider confirming with another test in 2-3 days and consult your healthcare provider.'
        : 'If you expected a different result, wait a few days and test again with first morning urine.',
      rating: {
        label: detectedResult,
        description: `Analysis result: ${detectedResult}. Confidence: ${detectedConfidence}.`,
      },
      features: [
        'Test image analyzed',
        'Result interpretation attempted'
      ],
      // Legacy compatibility
      bodyFatPercentage: detectedResult === 'Positive' ? 100 : detectedResult === 'Faint Positive' ? 75 : 0,
      bodyType: detectedResult,
      fatDistribution: 'Unable to determine',
      healthCategory: detectedConfidence,
      animalType: detectedResult,
      animalPercentage: detectedResult === 'Positive' ? 100 : detectedResult === 'Faint Positive' ? 75 : 0,
      animalBeautyType: 'Unknown',
    };
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
