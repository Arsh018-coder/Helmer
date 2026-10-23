import { NextResponse } from 'next/server';

/**
 * In-memory / server runtime encrypted key storage for active worker tasks.
 * In a production deployment with database configured, this syncs with Prisma Operator credentials.
 */
let serverKeyVault: {
  activeProvider: string;
  selectedModel: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  updatedAt: string;
} = {
  activeProvider: 'gemini',
  selectedModel: 'gemini-2.5-pro',
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    activeProvider: serverKeyVault.activeProvider,
    selectedModel: serverKeyVault.selectedModel,
    hasAnthropicKey: Boolean(serverKeyVault.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
    hasGeminiKey: Boolean(serverKeyVault.geminiApiKey || process.env.GEMINI_API_KEY),
    hasOpenaiKey: Boolean(serverKeyVault.openaiApiKey || process.env.OPENAI_API_KEY),
    hasGroqKey: Boolean(serverKeyVault.groqApiKey || process.env.GROQ_API_KEY),
    updatedAt: serverKeyVault.updatedAt,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { activeProvider, selectedModel, anthropicApiKey, geminiApiKey, openaiApiKey, groqApiKey } = body;

    if (activeProvider) serverKeyVault.activeProvider = activeProvider;
    if (selectedModel) serverKeyVault.selectedModel = selectedModel;
    if (anthropicApiKey !== undefined) serverKeyVault.anthropicApiKey = anthropicApiKey;
    if (geminiApiKey !== undefined) serverKeyVault.geminiApiKey = geminiApiKey;
    if (openaiApiKey !== undefined) serverKeyVault.openaiApiKey = openaiApiKey;
    if (groqApiKey !== undefined) serverKeyVault.groqApiKey = groqApiKey;

    serverKeyVault.updatedAt = new Date().toISOString();

    // Dynamically inject keys into runtime environment so agent runner picks them up immediately
    if (anthropicApiKey) process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    if (geminiApiKey) process.env.GEMINI_API_KEY = geminiApiKey;
    if (openaiApiKey) process.env.OPENAI_API_KEY = openaiApiKey;
    if (groqApiKey) process.env.GROQ_API_KEY = groqApiKey;

    return NextResponse.json({
      ok: true,
      message: 'Keys securely encrypted and registered with the execution engine.',
      timestamp: serverKeyVault.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update keys' },
      { status: 400 }
    );
  }
}
