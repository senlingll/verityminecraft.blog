/**
 * AI Song Lyrics Generator Service
 * Uses OpenRouter API with Mistral Nemo model to generate song lyrics
 */

export interface LyricsGenerationRequest {
  idea: string;           // User's song idea/topic
  style?: string;         // Music style (pop, rock, rap, etc.)
  mood?: string;          // Mood (happy, sad, romantic, etc.)
  language?: string;      // Output language
}

export interface LyricsGenerationResult {
  success: boolean;
  title?: string;         // Generated song title
  lyrics?: string;        // Full lyrics text
  sections?: LyricsSection[];  // Structured lyrics sections
  style?: string;         // Detected/used style
  mood?: string;          // Detected/used mood
  error?: string;
}

export interface LyricsSection {
  type: string;           // "verse", "chorus", "bridge", "outro", etc.
  label: string;          // "Verse 1", "Chorus", etc.
  lines: string[];        // Lines of lyrics
}

export class LyricsGeneratorService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string = 'mistralai/mistral-nemo';
  private siteUrl: string;
  private siteName: string;

  constructor(env: any) {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.siteUrl = env.PUBLIC_BASE_URL || 'https://playpokechill.blog';
    this.siteName = 'AI Song Lyrics Generator';
  }

  /**
   * Generate song lyrics based on user input
   */
  async generateLyrics(request: LyricsGenerationRequest): Promise<LyricsGenerationResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenRouter API key not configured',
      };
    }

    try {
      const prompt = this.buildPrompt(request);
      console.log('Generating lyrics with model:', this.model);
      console.log('=== AI PROMPT START ===');
      console.log(prompt);
      console.log('=== AI PROMPT END ===');

      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
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
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'No response from AI model',
        };
      }

      console.log('AI response received, parsing...');
      return this.parseResponse(content, request);

    } catch (error) {
      console.error('Lyrics generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }

  /**
   * Build the prompt for lyrics generation
   */
  private buildPrompt(request: LyricsGenerationRequest): string {
    const style = request.style && request.style !== 'auto' ? request.style : 'pop';
    const mood = request.mood && request.mood !== 'auto' ? request.mood : 'uplifting';
    const language = request.language || 'en';

    return `You are a professional songwriter and lyricist. Create original song lyrics based on the following:

**Song Idea/Topic:** ${request.idea}
**Music Style:** ${style}
**Mood:** ${mood}

**Requirements:**
1. Create a complete song with proper structure (Verse 1, Chorus, Verse 2, Chorus, Bridge, Final Chorus)
2. Make the lyrics emotionally resonant and memorable
3. Include rhymes and rhythm appropriate for the style
4. The chorus should be catchy and repeatable
5. Each verse should tell part of the story/theme
6. The bridge should provide a different perspective or emotional shift

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Song Title Here",
  "style": "${style}",
  "mood": "${mood}",
  "sections": [
    {
      "type": "verse",
      "label": "Verse 1",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "chorus",
      "label": "Chorus",
      "lines": ["Chorus line 1", "Chorus line 2", "Chorus line 3", "Chorus line 4"]
    },
    {
      "type": "verse",
      "label": "Verse 2",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "chorus",
      "label": "Chorus",
      "lines": ["Chorus line 1", "Chorus line 2", "Chorus line 3", "Chorus line 4"]
    },
    {
      "type": "bridge",
      "label": "Bridge",
      "lines": ["Bridge line 1", "Bridge line 2"]
    },
    {
      "type": "chorus",
      "label": "Chorus",
      "lines": ["Chorus line 1", "Chorus line 2", "Chorus line 3", "Chorus line 4"]
    }
  ]
}

Write the lyrics in English. Be creative and original!`;
  }

  /**
   * Parse the AI response into structured lyrics
   */
  private parseResponse(content: string, request: LyricsGenerationRequest): LyricsGenerationResult {
    try {
      let jsonStr = content.trim();
      jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        return this.createFallbackResult(content, request);
      }

      const jsonCandidate = jsonStr.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonCandidate);

      const sections: LyricsSection[] = [];
      let fullLyrics = '';

      if (Array.isArray(parsed.sections)) {
        for (const section of parsed.sections) {
          const lines = Array.isArray(section.lines) ? section.lines : [];
          sections.push({
            type: section.type || 'verse',
            label: section.label || 'Verse',
            lines: lines,
          });
          fullLyrics += `[${section.label || 'Verse'}]\n${lines.join('\n')}\n\n`;
        }
      }

      return {
        success: true,
        title: parsed.title || 'Untitled Song',
        lyrics: fullLyrics.trim(),
        sections: sections,
        style: parsed.style || request.style || 'pop',
        mood: parsed.mood || request.mood || 'uplifting',
      };

    } catch (error) {
      console.error('Failed to parse lyrics response:', error);
      return this.createFallbackResult(content, request);
    }
  }

  /**
   * Create fallback result when JSON parsing fails
   */
  private createFallbackResult(content: string, request: LyricsGenerationRequest): LyricsGenerationResult {
    // Try to extract lyrics from plain text response
    const lines = content.split('\n').filter(line => line.trim());
    const sections: LyricsSection[] = [];
    let currentSection: LyricsSection | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for section headers like [Verse 1], [Chorus], etc.
      const headerMatch = trimmed.match(/^\[([^\]]+)\]$|^(Verse|Chorus|Bridge|Outro|Pre-Chorus|Hook)\s*\d*:?$/i);
      
      if (headerMatch) {
        if (currentSection && currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        const label = headerMatch[1] || headerMatch[2];
        currentSection = {
          type: label.toLowerCase().replace(/\s*\d+$/, ''),
          label: label,
          lines: [],
        };
      } else if (currentSection && trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('"')) {
        currentSection.lines.push(trimmed);
      }
    }

    if (currentSection && currentSection.lines.length > 0) {
      sections.push(currentSection);
    }

    // If no sections found, treat entire content as lyrics
    if (sections.length === 0) {
      sections.push({
        type: 'verse',
        label: 'Lyrics',
        lines: lines.filter(l => l.trim() && !l.includes('{') && !l.includes('"')),
      });
    }

    let fullLyrics = '';
    for (const section of sections) {
      fullLyrics += `[${section.label}]\n${section.lines.join('\n')}\n\n`;
    }

    return {
      success: true,
      title: 'Generated Song',
      lyrics: fullLyrics.trim() || content,
      sections: sections,
      style: request.style || 'pop',
      mood: request.mood || 'uplifting',
    };
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
