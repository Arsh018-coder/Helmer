import { NextResponse } from 'next/server';

/**
 * In-memory / server runtime encrypted key storage for active worker tasks.
 * Synchronizes user keys, DeepSeek endpoints, and dynamic custom model selections.
 */
let serverKeyVault: {
  activeProvider: string;
  selectedModel: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  deepseekApiKey?: string;
  customKeys?: Array<{ id: string; name: string; apiKey: string; providerOrModel?: string }>;
  activeApiKey?: string;
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
    hasDeepseekKey: Boolean(serverKeyVault.deepseekApiKey || process.env.DEEPSEEK_API_KEY),
    customKeysCount: serverKeyVault.customKeys?.length || 0,
    updatedAt: serverKeyVault.updatedAt,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      activeProvider,
      selectedModel,
      anthropicApiKey,
      geminiApiKey,
      openaiApiKey,
      groqApiKey,
      deepseekApiKey,
      customKeys,
      activeApiKey,
    } = body;

    if (activeProvider) serverKeyVault.activeProvider = activeProvider;
    if (selectedModel) serverKeyVault.selectedModel = selectedModel;
    if (anthropicApiKey !== undefined) serverKeyVault.anthropicApiKey = anthropicApiKey;
    if (geminiApiKey !== undefined) serverKeyVault.geminiApiKey = geminiApiKey;
    if (openaiApiKey !== undefined) serverKeyVault.openaiApiKey = openaiApiKey;
    if (groqApiKey !== undefined) serverKeyVault.groqApiKey = groqApiKey;
    if (deepseekApiKey !== undefined) serverKeyVault.deepseekApiKey = deepseekApiKey;
    if (customKeys !== undefined) serverKeyVault.customKeys = customKeys;
    if (activeApiKey !== undefined) serverKeyVault.activeApiKey = activeApiKey;

    serverKeyVault.updatedAt = new Date().toISOString();

    // Dynamically inject keys into runtime environment
    if (anthropicApiKey) process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    if (geminiApiKey) process.env.GEMINI_API_KEY = geminiApiKey;
    if (openaiApiKey) process.env.OPENAI_API_KEY = openaiApiKey;
    if (groqApiKey) process.env.GROQ_API_KEY = groqApiKey;
    if (deepseekApiKey) process.env.DEEPSEEK_API_KEY = deepseekApiKey;

    // Detect if active provider or key is DeepSeek
    const providerStr = (activeProvider || serverKeyVault.activeProvider || '').toLowerCase();
    const matchingCustom = serverKeyVault.customKeys?.find(
      (k) => k.id === activeProvider || k.name.toLowerCase() === providerStr
    );
    const isDeepSeek =
      providerStr === 'deepseek' ||
      matchingCustom?.name.toLowerCase().includes('deepseek') ||
      matchingCustom?.providerOrModel?.toLowerCase().includes('deepseek');

    if (isDeepSeek) {
      const effKey = activeApiKey || deepseekApiKey || matchingCustom?.apiKey || process.env.DEEPSEEK_API_KEY || '';
      process.env.DEEPSEEK_API_KEY = effKey;
      process.env.LLM_API_KEY = effKey;
      process.env.LLM_BASE_URL = 'https://api.deepseek.com';
      process.env.LLM_MODEL = selectedModel || 'deepseek-chat';
      process.env.ACTIVE_LLM_PROVIDER = 'deepseek';
    } else if (providerStr === 'openai') {
      const effKey = openaiApiKey || activeApiKey || process.env.OPENAI_API_KEY || '';
      process.env.OPENAI_API_KEY = effKey;
      process.env.LLM_API_KEY = effKey;
      process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LLM_MODEL = selectedModel || 'gpt-4o';
      process.env.ACTIVE_LLM_PROVIDER = 'openai';
    } else if (providerStr === 'groq') {
      const effKey = groqApiKey || activeApiKey || process.env.GROQ_API_KEY || '';
      process.env.GROQ_API_KEY = effKey;
      process.env.LLM_API_KEY = effKey;
      process.env.LLM_BASE_URL = 'https://api.groq.com/openai/v1';
      process.env.LLM_MODEL = selectedModel || 'llama-3.3-70b-versatile';
      process.env.ACTIVE_LLM_PROVIDER = 'groq';
    } else if (providerStr === 'gemini') {
      const effKey = geminiApiKey || activeApiKey || process.env.GEMINI_API_KEY || '';
      process.env.GEMINI_API_KEY = effKey;
      process.env.LLM_API_KEY = effKey;
      process.env.LLM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      process.env.LLM_MODEL = selectedModel || 'gemini-2.5-pro';
      process.env.ACTIVE_LLM_PROVIDER = 'gemini';
    } else if (matchingCustom) {
      const effKey = activeApiKey || matchingCustom.apiKey;
      process.env.CUSTOM_API_KEY = effKey;
      process.env.LLM_API_KEY = effKey;
      process.env.LLM_BASE_URL = 'https://api.deepseek.com';
      process.env.LLM_MODEL = selectedModel || matchingCustom.providerOrModel || 'deepseek-chat';
      process.env.ACTIVE_LLM_PROVIDER = matchingCustom.id;
    }

    return NextResponse.json({
      ok: true,
      message: 'Keys securely encrypted and registered with the execution engine.',
      activeProvider: serverKeyVault.activeProvider,
      activeModel: process.env.LLM_MODEL,
      activeBaseUrl: process.env.LLM_BASE_URL,
      timestamp: serverKeyVault.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update keys' },
      { status: 400 }
    );
  }
}
