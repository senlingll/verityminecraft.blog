/**
 * AI Poem Generator Service
 * Uses OpenRouter API with Mistral Nemo model to generate poems
 */

export interface PoemGenerationRequest {
  idea: string;           // User's poem idea/topic
  style?: string;         // Poetry style (haiku, sonnet, free verse, etc.)
  mood?: string;          // Mood (romantic, melancholic, joyful, etc.)
  language?: string;      // Output language
}

export interface PoemGenerationResult {
  success: boolean;
  title?: string;         // Generated poem title
  poem?: string;          // Full poem text
  sections?: PoemSection[];  // Structured poem sections (stanzas)
  style?: string;         // Detected/used style
  mood?: string;          // Detected/used mood
  error?: string;
}

export interface PoemSection {
  type: string;           // "stanza", "refrain", "couplet", etc.
  label: string;          // "Stanza 1", "Refrain", etc.
  lines: string[];        // Lines of poetry
}

export class PoemGeneratorService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string = 'mistralai/mistral-nemo';
  private siteUrl: string;
  private siteName: string;

  constructor(env: any) {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.siteUrl = env.PUBLIC_BASE_URL || 'https://playpokechill.blog';
    this.siteName = 'AI Poem Generator';
  }

  /**
   * Generate poem based on user input
   */
  async generatePoem(request: PoemGenerationRequest): Promise<PoemGenerationResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenRouter API key not configured',
      };
    }

    try {
      const prompt = this.buildPrompt(request);
      console.log('Generating poem with model:', this.model);
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
      console.error('Poem generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  }


  /**
   * Build the prompt for poem generation
   */
  private buildPrompt(request: PoemGenerationRequest): string {
    const style = request.style && request.style !== 'auto' ? request.style.replace('_', ' ') : 'free verse';
    const mood = request.mood && request.mood !== 'auto' ? request.mood : 'reflective';
    const language = request.language || 'en';
    const styleLower = style.toLowerCase();

    // Check if this is an acrostic poem request
    const isAcrostic = styleLower === 'acrostic' || 
                       request.idea.toLowerCase().includes('acrostic');

    if (isAcrostic) {
      return this.buildAcrosticPrompt(request, mood);
    }

    // Check for haiku
    if (styleLower === 'haiku') {
      return this.buildHaikuPrompt(request, mood);
    }

    // Check for sonnet
    if (styleLower === 'sonnet') {
      return this.buildSonnetPrompt(request, mood);
    }

    // Check for limerick
    if (styleLower === 'limerick') {
      return this.buildLimerickPrompt(request, mood);
    }

    // Check for love poem
    if (styleLower === 'love' || styleLower === 'love poem') {
      return this.buildLovePoemPrompt(request, mood);
    }

    // Check for cinquain
    if (styleLower === 'cinquain') {
      return this.buildCinquainPrompt(request, mood);
    }

    // Check for couplet
    if (styleLower === 'couplet') {
      return this.buildCoupletPrompt(request, mood);
    }

    // Default: Free verse, romantic, ballad, ode, elegy, narrative, lyric, etc.
    return `You are a professional poet and creative writer. Create an original poem based on the following:

**Poem Topic/Theme:** ${request.idea}
**Poetry Style:** ${style}
**Mood:** ${mood}

**Requirements:**
1. Create a beautiful, emotionally resonant poem
2. Use vivid imagery and sensory details
3. Include appropriate poetic devices (metaphors, similes, alliteration, etc.)
4. Maintain consistent rhythm and flow
5. The poem should have 3-5 stanzas with 4-6 lines each
6. Use rhyme scheme appropriate for the style (ABAB, AABB, or free verse)

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Poem Title Here",
  "style": "${style}",
  "mood": "${mood}",
  "sections": [
    {
      "type": "stanza",
      "label": "Stanza 1",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "stanza",
      "label": "Stanza 2",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "stanza",
      "label": "Stanza 3",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    }
  ]
}

Write the poem in English. Be creative, evocative, and original!`;
  }

  /**
   * Build prompt for acrostic poems
   */
  private buildAcrosticPrompt(request: PoemGenerationRequest, mood: string): string {
    // Try to extract the acrostic word from the idea
    const acrosticMatch = request.idea.match(/acrostic\s+(?:poem\s+)?(?:for\s+|using\s+|with\s+)?["']?(\w+)["']?/i) ||
                          request.idea.match(/["'](\w+)["']\s+acrostic/i) ||
                          request.idea.match(/^(\w+)$/);
    
    const acrosticWord = acrosticMatch ? acrosticMatch[1].toUpperCase() : 'POEM';

    return `You are a professional poet. Create an ACROSTIC poem where the first letter of each line spells out "${acrosticWord}".

**Word to spell:** ${acrosticWord}
**Theme/Context:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. The FIRST LETTER of each line MUST spell out "${acrosticWord}" vertically
2. Each line should be meaningful and relate to the theme
3. The poem should flow naturally and be emotionally resonant
4. Use vivid imagery and poetic language

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Acrostic: ${acrosticWord}",
  "style": "acrostic",
  "mood": "${mood}",
  "sections": [
    {
      "type": "acrostic",
      "label": "Acrostic Poem",
      "lines": [
        "${acrosticWord[0]} - First line starting with ${acrosticWord[0]}",
        "${acrosticWord[1] || ''} - Second line starting with ${acrosticWord[1] || 'next letter'}",
        "... continue for each letter"
      ]
    }
  ]
}

IMPORTANT: Each line MUST start with the corresponding letter from "${acrosticWord}". There should be exactly ${acrosticWord.length} lines.`;
  }

  /**
   * Build prompt for haiku
   */
  private buildHaikuPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a master haiku poet. Create a traditional Japanese-style haiku based on:

**Theme:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. Follow the 5-7-5 syllable structure strictly
2. Capture a moment in nature or human experience
3. Include a seasonal reference (kigo) if appropriate
4. Create a sense of insight or revelation
5. Use concrete, sensory imagery

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Haiku: [Brief Theme]",
  "style": "haiku",
  "mood": "${mood}",
  "sections": [
    {
      "type": "haiku",
      "label": "Haiku",
      "lines": [
        "Five syllable line",
        "Seven syllables here now",
        "Five syllables end"
      ]
    }
  ]
}

Create a profound, evocative haiku in English.`;
  }

  /**
   * Build prompt for sonnet
   */
  private buildSonnetPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a master poet in the tradition of Shakespeare and Petrarch. Create a sonnet based on:

**Theme:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. Write exactly 14 lines in iambic pentameter (10 syllables per line)
2. Use Shakespearean rhyme scheme: ABAB CDCD EFEF GG
3. Develop the theme through three quatrains and a concluding couplet
4. The final couplet should provide a twist, resolution, or insight
5. Use rich imagery and poetic language

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Sonnet: [Theme]",
  "style": "sonnet",
  "mood": "${mood}",
  "sections": [
    {
      "type": "quatrain",
      "label": "Quatrain 1",
      "lines": ["Line 1 (A)", "Line 2 (B)", "Line 3 (A)", "Line 4 (B)"]
    },
    {
      "type": "quatrain",
      "label": "Quatrain 2",
      "lines": ["Line 5 (C)", "Line 6 (D)", "Line 7 (C)", "Line 8 (D)"]
    },
    {
      "type": "quatrain",
      "label": "Quatrain 3",
      "lines": ["Line 9 (E)", "Line 10 (F)", "Line 11 (E)", "Line 12 (F)"]
    },
    {
      "type": "couplet",
      "label": "Couplet",
      "lines": ["Line 13 (G)", "Line 14 (G)"]
    }
  ]
}

Create an eloquent, moving sonnet in English.`;
  }

  /**
   * Build prompt for limerick
   */
  private buildLimerickPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a witty poet specializing in limericks. Create a limerick based on:

**Theme:** ${request.idea}
**Mood:** ${mood} (with humor)

**Requirements:**
1. Follow the AABBA rhyme scheme strictly
2. Lines 1, 2, 5 should have 7-10 syllables
3. Lines 3, 4 should have 5-7 syllables
4. Include wit, humor, or a clever twist
5. The final line should deliver a punchline or surprise

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Limerick: [Theme]",
  "style": "limerick",
  "mood": "humorous",
  "sections": [
    {
      "type": "limerick",
      "label": "Limerick",
      "lines": [
        "Line 1 (A rhyme, 7-10 syllables)",
        "Line 2 (A rhyme, 7-10 syllables)",
        "Line 3 (B rhyme, 5-7 syllables)",
        "Line 4 (B rhyme, 5-7 syllables)",
        "Line 5 (A rhyme, 7-10 syllables - punchline)"
      ]
    }
  ]
}

Create a clever, entertaining limerick in English.`;
  }

  /**
   * Build prompt for love poems
   */
  private buildLovePoemPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a romantic poet specializing in love poetry. Create a heartfelt love poem based on:

**Theme:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. Express deep, genuine emotions of love and affection
2. Use romantic imagery (hearts, stars, flowers, nature)
3. Include metaphors and similes that capture the essence of love
4. Create 3-4 stanzas with 4-6 lines each
5. Use a gentle rhyme scheme (ABAB or AABB)
6. Make it personal and touching

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Love Poem Title",
  "style": "love poem",
  "mood": "${mood}",
  "sections": [
    {
      "type": "stanza",
      "label": "Stanza 1",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "stanza",
      "label": "Stanza 2",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    },
    {
      "type": "stanza",
      "label": "Stanza 3",
      "lines": ["Line 1", "Line 2", "Line 3", "Line 4"]
    }
  ]
}

Create a beautiful, heartfelt love poem in English.`;
  }

  /**
   * Build prompt for cinquain
   */
  private buildCinquainPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a poet specializing in cinquain poetry. Create a cinquain based on:

**Theme:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. Follow the traditional cinquain structure:
   - Line 1: 2 syllables (one word - the title/subject)
   - Line 2: 4 syllables (two words - describing the subject)
   - Line 3: 6 syllables (three words - action)
   - Line 4: 8 syllables (four words - feeling/emotion)
   - Line 5: 2 syllables (one word - synonym or reference to title)
2. Be concise and evocative
3. Create vivid imagery in few words

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Cinquain: [Subject]",
  "style": "cinquain",
  "mood": "${mood}",
  "sections": [
    {
      "type": "cinquain",
      "label": "Cinquain",
      "lines": [
        "Subject (2 syllables)",
        "Describing words (4 syllables)",
        "Action phrase (6 syllables)",
        "Feeling phrase (8 syllables)",
        "Synonym (2 syllables)"
      ]
    }
  ]
}

Create a beautiful, evocative cinquain in English.`;
  }

  /**
   * Build prompt for couplet
   */
  private buildCoupletPrompt(request: PoemGenerationRequest, mood: string): string {
    return `You are a poet specializing in rhyming couplets. Create a poem in couplets based on:

**Theme:** ${request.idea}
**Mood:** ${mood}

**Requirements:**
1. Write 4-6 rhyming couplets (pairs of lines that rhyme)
2. Each couplet should be self-contained but contribute to the overall theme
3. Use iambic pentameter or similar meter for rhythm
4. Make each couplet memorable and quotable
5. End with a powerful concluding couplet

**Output Format:**
Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "Couplet Poem Title",
  "style": "couplet",
  "mood": "${mood}",
  "sections": [
    {
      "type": "couplet",
      "label": "Couplet 1",
      "lines": ["First line ending with rhyme A", "Second line ending with rhyme A"]
    },
    {
      "type": "couplet",
      "label": "Couplet 2",
      "lines": ["First line ending with rhyme B", "Second line ending with rhyme B"]
    },
    {
      "type": "couplet",
      "label": "Couplet 3",
      "lines": ["First line ending with rhyme C", "Second line ending with rhyme C"]
    },
    {
      "type": "couplet",
      "label": "Couplet 4",
      "lines": ["First line ending with rhyme D", "Second line ending with rhyme D"]
    }
  ]
}

Create elegant, memorable couplets in English.`;
  }

  /**
   * Parse the AI response into structured poem
   */
  private parseResponse(content: string, request: PoemGenerationRequest): PoemGenerationResult {
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

      const sections: PoemSection[] = [];
      let fullPoem = '';

      if (Array.isArray(parsed.sections)) {
        for (const section of parsed.sections) {
          const lines = Array.isArray(section.lines) ? section.lines : [];
          sections.push({
            type: section.type || 'stanza',
            label: section.label || 'Stanza',
            lines: lines,
          });
          fullPoem += `[${section.label || 'Stanza'}]\n${lines.join('\n')}\n\n`;
        }
      }

      return {
        success: true,
        title: parsed.title || 'Untitled Poem',
        poem: fullPoem.trim(),
        sections: sections,
        style: parsed.style || request.style || 'free verse',
        mood: parsed.mood || request.mood || 'reflective',
      };

    } catch (error) {
      console.error('Failed to parse poem response:', error);
      return this.createFallbackResult(content, request);
    }
  }

  /**
   * Create fallback result when JSON parsing fails
   */
  private createFallbackResult(content: string, request: PoemGenerationRequest): PoemGenerationResult {
    const lines = content.split('\n').filter(line => line.trim());
    const sections: PoemSection[] = [];
    let currentSection: PoemSection | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const headerMatch = trimmed.match(/^\[([^\]]+)\]$|^(Stanza|Verse|Couplet|Quatrain|Haiku|Refrain)\s*\d*:?$/i);
      
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

    if (sections.length === 0) {
      sections.push({
        type: 'stanza',
        label: 'Poem',
        lines: lines.filter(l => l.trim() && !l.includes('{') && !l.includes('"')),
      });
    }

    let fullPoem = '';
    for (const section of sections) {
      fullPoem += `[${section.label}]\n${section.lines.join('\n')}\n\n`;
    }

    return {
      success: true,
      title: 'Generated Poem',
      poem: fullPoem.trim() || content,
      sections: sections,
      style: request.style || 'free verse',
      mood: request.mood || 'reflective',
    };
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
