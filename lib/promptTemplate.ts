// These imports are only used server-side
// import { readFileSync } from 'fs';
// import { join } from 'path';

export interface PromptVariables {
  Wisdom_Source_Name: string;
  Wisdom_Snippet: string;
  User_Primer: string;
  User_Goal: string;
  User_Feelings_List: string;
  Max_Word_Count: number;
}

// Import constants from separate file to avoid bundling server-side code in client
export {
  WISDOM_SOURCES,
  FEELING_OPTIONS,
  GOAL_OPTIONS,
  type WisdomSource,
  type FeelingOption,
  type GoalOption
} from './promptConstants';

export class PromptTemplateManager {
  private templateCache: string | null = null;

  /**
   * Load the master prompt template from the markdown file (server-side only)
   */
  private async loadTemplate(): Promise<string> {
    if (this.templateCache) {
      return this.templateCache;
    }

    try {
      // Dynamic import for server-side modules
      const { readFileSync } = await import('fs');
      const { join } = await import('path');

      const templatePath = join(process.cwd(), 'MediSync_MasterPrompt_250914.md');
      const template = readFileSync(templatePath, 'utf-8');

      // Extract the prompt content between **[START OF PROMPT]** and **[END OF PROMPT]**
      const startMarker = '**[START OF PROMPT]**';
      const endMarker = '**[END OF PROMPT]**';

      const startIndex = template.indexOf(startMarker);
      const endIndex = template.indexOf(endMarker);

      if (startIndex === -1 || endIndex === -1) {
        throw new Error('Could not find prompt markers in template file');
      }

      const promptContent = template.substring(startIndex + startMarker.length, endIndex).trim();
      this.templateCache = promptContent;
      return promptContent;
    } catch (error) {
      console.error('Failed to load prompt template:', error);
      // Return a fallback template
      return this.getFallbackTemplate();
    }
  }

  /**
   * Get wisdom snippet for a given source
   */
  getWisdomSnippet(wisdomSourceName: string): string {
    const { WISDOM_SOURCES } = require('./promptConstants');
    const source = WISDOM_SOURCES.find((s: any) => s.internalKeyword === wisdomSourceName);
    return source?.conceptSnippet || WISDOM_SOURCES[0].conceptSnippet; // Default to Universal
  }

  /**
   * Generate the final prompt by replacing variables in the template
   */
  async generatePrompt(variables: PromptVariables): Promise<string> {
    const template = await this.loadTemplate();

    let prompt = template;

    // Replace all template variables
    prompt = prompt.replace(/\{\{Wisdom_Source_Name\}\}/g, variables.Wisdom_Source_Name);
    prompt = prompt.replace(/\{\{Wisdom_Snippet\}\}/g, variables.Wisdom_Snippet);
    prompt = prompt.replace(/\{\{User_Primer\}\}/g, variables.User_Primer || 'No specific primer provided');
    prompt = prompt.replace(/\{\{User_Goal\}\}/g, variables.User_Goal);
    prompt = prompt.replace(/\{\{User_Feelings_List\}\}/g, variables.User_Feelings_List || 'None specified');
    prompt = prompt.replace(/\{\{Max_Word_Count\}\}/g, variables.Max_Word_Count.toString());

    return prompt;
  }

  /**
   * Calculate word count based on duration accounting for SSML pauses and meditation pace
   *
   * IMPORTANT: This calculation is for SLOW MEDITATION PACE, not normal speech!
   * - ElevenLabs voices configured for meditation speak ~70-80 WPM
   * - SSML pauses (1.5s per sentence, 0.8s per comma) EXTEND duration significantly
   * - We want natural, unhurried speech that matches meditation intent
   */
  calculateMaxWordCount(durationMinutes: number): number {
    // Account for 10-second music intro before voice starts
    const voiceStartDelay = 10 / 60; // 10 seconds in minutes

    // Available time for voice narration (leaving room for music outro)
    const availableMinutes = durationMinutes - voiceStartDelay - 0.17; // 0.17 min = ~10s outro

    // MEDITATION PACE: Based on actual ElevenLabs voice profile testing
    // Initial measurements (before pause adjustments):
    // - Kelli-2: 120.5 WPM - TOO FAST for meditation
    // - Shelia-1: 117.3 WPM - TOO FAST for meditation
    // - Bernard-1: 120.2 WPM - TOO FAST for meditation
    //
    // ADJUSTED: Increased SSML pauses to slow down to meditation pace
    // - Period: 1.5s → 2.5s
    // - Comma: 0.8s → 1.2s
    //
    // Target: 70-80 WPM effective rate for proper meditation pacing
    // Using 75 WPM with longer pauses = ~60 WPM final delivery
    const baseWordsPerMinute = 75;

    // SSML pauses ADD time on top of speaking time:
    // - Each period (.) adds 1.5s pause
    // - Each comma (,) adds 0.8s pause
    // - Average sentence: ~15 words, 2-3 commas, 1 period = ~4s of pauses per sentence
    // - This means 15 words takes ~12s speaking + 4s pauses = 16s total
    // - Effective rate: 15 words / 16s * 60s = ~56 WPM with pauses
    //
    // Using 75 WPM base accounts for this pause time
    const wordsPerMinute = baseWordsPerMinute;

    // Calculate word count (no buffer - let meditation breathe naturally)
    const wordCount = Math.floor(availableMinutes * wordsPerMinute);

    console.log(`📊 Meditation Script Calculation:`);
    console.log(`   Requested Duration: ${durationMinutes} min`);
    console.log(`   Voice Available Time: ${availableMinutes.toFixed(2)} min (minus music fades)`);
    console.log(`   Meditation Pace: ${wordsPerMinute} WPM (slow, with SSML pauses)`);
    console.log(`   Target Word Count: ${wordCount} words`);
    console.log(`   Expected Voice Duration: ~${(wordCount / wordsPerMinute).toFixed(1)} min`);

    return Math.max(50, wordCount);
  }

  /**
   * Fallback template if file loading fails
   */
  private getFallbackTemplate(): string {
    return `
You are a master spiritual guide and meditation scriptwriter. Create a beautiful, flowing guided meditation script based on the following inputs:

**Wisdom Source:** {{Wisdom_Source_Name}}
**Core Concept:** {{Wisdom_Snippet}}
**User's Primer:** {{User_Primer}}
**Primary Goal:** {{User_Goal}}
**Feelings to Transform:** {{User_Feelings_List}}

**Requirements:**
- Maximum {{Max_Word_Count}} words
- 100% positive and empowering language
- Present tense, second person ("You are...")
- Include simple audio cues like [Pause] sparingly
- Structure: 15% induction, 60% core message, 25% integration
- Start with a beautiful title for the meditation

Create the complete meditation script now.
    `;
  }

  /**
   * Validate that the template file exists and is readable
   */
  async validateTemplate(): Promise<{ isValid: boolean; error?: string }> {
    try {
      await this.loadTemplate();
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const promptTemplateManager = new PromptTemplateManager();