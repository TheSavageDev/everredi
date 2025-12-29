import { Injectable, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { UsersService } from '../users/users.service';
import { FIRESTORE } from '../config/firebase.provider';

export interface AiRecommendationRequest {
  prompt: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface AiRecommendation {
  id: string;
  userId: string;
  prompt: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel?: string;
  recommendedItems: Array<{
    supplyId: string;
    supplyName: string;
    quantity: number;
    reason?: string;
  }>;
  confidenceScore: number;
  wasUsed: boolean;
  createdAt: Timestamp;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly apiKey: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn(
        '⚠️  Gemini AI API key not configured. AI recommendations will not work.\n' +
          '   Please set GEMINI_API_KEY in your .env file.\n' +
          '   Get your API key from: https://makersuite.google.com/app/apikey',
      );
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.logger.log('✅ Gemini AI initialized successfully');
    }
  }

  async checkUsageLimit(
    userId: string,
  ): Promise<{ allowed: boolean; used: number; limit: number | null }> {
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (
      user.subscriptionTier === 'premium' &&
      user.subscriptionStatus === 'active'
    ) {
      return { allowed: true, used: 0, limit: null }; // Unlimited
    }

    // Get usage for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthTimestamp = Timestamp.fromDate(startOfMonth);

    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('aiRecommendations')
      .where('createdAt', '>=', startOfMonthTimestamp)
      .get();

    const used = snapshot.size;
    const limit = 5; // Free tier limit

    return { allowed: used < limit, used, limit };
  }

  async generateRecommendation(
    userId: string,
    request: AiRecommendationRequest,
  ): Promise<AiRecommendation> {
    // Check if API key is configured
    if (!this.genAI || !this.apiKey) {
      throw new Error(
        'Gemini AI API key is not configured. Please set GEMINI_API_KEY in your environment variables.\n' +
          'Get your API key from: https://makersuite.google.com/app/apikey',
      );
    }

    // Check usage limit
    const usage = await this.checkUsageLimit(userId);
    if (!usage.allowed) {
      throw new ForbiddenException(
        `Monthly limit reached. You've used ${usage.used} of ${usage.limit} recommendations. Upgrade to premium for unlimited.`,
      );
    }

    // Try gemini-1.0-pro which should work with v1beta API
    // Can be overridden via GEMINI_MODEL environment variable
    const modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are an expert in first aid kit preparation. Based on the following requirements, recommend a comprehensive first aid kit.

Purpose: ${request.purpose}
Group Size: ${request.groupSize} people
Environment: ${request.environment || 'general'}
Skill Level: ${request.skillLevel || 'beginner'}
Additional Details: ${request.prompt}

Please provide a JSON array of recommended items with the following structure:
[
  {
    "supplyName": "Item name",
    "quantity": number,
    "reason": "Why this item is needed"
  }
]

Return ONLY the JSON array, no other text.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const recommendedItems: unknown = JSON.parse(jsonMatch[0]);

      // Save recommendation
      const now = Timestamp.now();
      const docRef = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('aiRecommendations')
        .add({
          userId,
          prompt: request.prompt,
          purpose: request.purpose,
          groupSize: request.groupSize,
          environment: request.environment,
          skillLevel: request.skillLevel,
          recommendedItems,
          confidenceScore: 0.8, // TODO: Calculate actual confidence
          wasUsed: false,
          createdAt: now,
        });

      const doc = await docRef.get();
      return { id: doc.id, ...doc.data() } as AiRecommendation;
    } catch (error: unknown) {
      this.logger.error(
        'AI recommendation error:',
        error instanceof Error ? error.stack : String(error),
      );

      interface GeminiError {
        errorDetails?: Array<{ reason?: string }>;
        status?: number;
        message?: string;
      }

      const geminiError = error as GeminiError;

      // Provide more specific error messages
      if (
        geminiError.errorDetails?.some(
          (detail) => detail.reason === 'API_KEY_INVALID',
        )
      ) {
        throw new Error(
          'Invalid Gemini AI API key. Please check your GEMINI_API_KEY environment variable.\n' +
            'Get a valid API key from: https://makersuite.google.com/app/apikey',
        );
      }

      if (geminiError.status === 400) {
        throw new Error(
          `Gemini API error: ${geminiError.message || 'Bad request. Please check your API key and request format.'}`,
        );
      }

      if (geminiError.status === 404) {
        const modelName =
          this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.0-pro';
        throw new Error(
          `Gemini model "${modelName}" not found for API version v1beta.\n` +
            `Error: ${geminiError.message || 'Model not available'}\n` +
            `Try setting GEMINI_MODEL environment variable to a supported model.\n` +
            `Common models: gemini-1.0-pro, gemini-1.0-flash\n` +
            `List available models: https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY`,
        );
      }

      throw new Error(
        `Failed to generate AI recommendation: ${geminiError.message || 'Unknown error'}`,
      );
    }
  }

  async getRecommendations(userId: string): Promise<AiRecommendation[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('aiRecommendations')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AiRecommendation[];
  }

  /**
   * List available Gemini models for debugging
   * Useful when model names change or are deprecated
   */
  async listAvailableModels(): Promise<string[]> {
    if (!this.genAI || !this.apiKey) {
      throw new Error('Gemini AI API key is not configured');
    }

    try {
      // Make a direct API call to list available models
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
      );
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };

      if (data.models) {
        return data.models.map((model) => model.name.replace('models/', ''));
      }
      return [];
    } catch (error) {
      this.logger.error(
        'Failed to list available models:',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }
}
