import {
  GoogleGenerativeAI,
  type Content,
  type GenerativeModel,
  type GenerateContentResult,
  type Part,
} from '@google/generative-ai';
import { TOOL_DECLARATIONS } from '../tools/registry';
import { runTool, type ToolSource } from '../tools/runTool';
import type { SessionUser } from '../auth';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_TOOL_ROUNDS = 5;

/**
 * Use Google "latest" aliases — many versioned IDs (e.g. gemini-2.5-flash) return 404
 * even when they appear in ListModels.
 */
const MODEL_FALLBACKS = [
  process.env.GEMINI_MODEL,
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
].filter((m): m is string => Boolean(m?.trim()));

const PER_MODEL_RETRIES = 1;

let lastWorkingModel: string | null = null;

function getModelCandidates(): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  if (lastWorkingModel) ordered.push(lastWorkingModel);
  for (const m of MODEL_FALLBACKS) {
    const id = m.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Try the next model when this one cannot serve the request (retired, busy, or rate-limited). */
function shouldTryNextModel(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('no longer available') ||
    msg.includes('not found') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable')
  );
}

function isOverloadError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return msg.includes('503') || msg.includes('high demand') || msg.includes('overloaded');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  model: GenerativeModel,
  contents: Content[]
): Promise<GenerateContentResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= PER_MODEL_RETRIES; attempt++) {
    try {
      return await model.generateContent({ contents });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error) || attempt === PER_MODEL_RETRIES) throw error;
      await sleep(600 * (attempt + 1));
    }
  }
  throw lastError;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function buildSystemPrompt(user: SessionUser): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the ERP Assistant for Sohan ERP. Today is ${today}.
The user is ${user.full_name || user.username} (role: ${user.role_name || 'Employee'}).

Rules:
- Read-only: never claim you created, updated, or deleted data.
- Answer using tool results only. If tools return empty lists, say so clearly.
- Include counts and key identifiers (id, PI number, party name) when listing items.
- Suggest opening the relevant ERP page when a route is in tool results.
- For FMS pending questions, call query_fms_pending with the correct module id.
- Be concise and professional.`;
}

function toGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.slice(-6).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export async function runErpAssistant(
  user: SessionUser,
  messages: ChatMessage[]
): Promise<{ reply: string; sources: ToolSource[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ASSISTANT_NOT_CONFIGURED');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const history = toGeminiHistory(messages.slice(0, -1));
  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  const candidates = getModelCandidates();
  let lastError: unknown;

  for (const modelId of candidates) {
    try {
      const result = await runWithModel(genAI, modelId, user, history, lastUser.content);
      lastWorkingModel = modelId;
      return result;
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) throw error;
      console.warn(`[ERP Assistant] Model ${modelId} failed:`, errorMessage(error));
    }
  }

  if (lastError && isOverloadError(lastError)) {
    throw new Error('ASSISTANT_OVERLOADED');
  }
  throw lastError instanceof Error ? lastError : new Error('No Gemini model available');
}

async function runWithModel(
  genAI: GoogleGenerativeAI,
  modelId: string,
  user: SessionUser,
  history: Content[],
  userMessage: string
): Promise<{ reply: string; sources: ToolSource[] }> {
  const model = genAI.getGenerativeModel(
    {
      model: modelId,
      systemInstruction: buildSystemPrompt(user),
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.2,
      },
    },
    { timeout: 50_000 }
  );

  const sources: ToolSource[] = [];
  const contents: Content[] = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    const result = await generateWithRetry(model, contents);
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length === 0) {
      const text = result.response.text();
      return { reply: text || 'I could not generate a response.', sources };
    }

    contents.push({ role: 'model', parts });

    const toolResults = await Promise.all(
      functionCalls.map(async (part) => {
        const fc = part.functionCall!;
        const args = (fc.args || {}) as Record<string, unknown>;
        const out = await runTool(fc.name, args, user);
        return { fc, out };
      })
    );

    const functionResponseParts: Part[] = toolResults.map(({ fc, out }) => {
      if (out.sources) sources.push(...out.sources);
      const callId = (fc as { id?: string }).id;
      return {
        functionResponse: {
          name: fc.name,
          response: { result: out.result },
          ...(callId ? { id: callId } : {}),
        },
      };
    });

    // Gemini API v1beta: tool results must be a USER turn (not role "function").
    contents.push({ role: 'user', parts: functionResponseParts });
    rounds += 1;
  }

  return {
    reply: 'I need more steps to finish this query. Please try a more specific question.',
    sources,
  };
}
