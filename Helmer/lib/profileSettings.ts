/**
 * lib/profileSettings.ts — AI Engine Key Configuration & Profile Persistence
 * Manages custom user API keys (Anthropic Claude, Google Gemini, OpenAI, Groq),
 * model routing preferences, and engine diagnostic telemetry.
 */

export type AiProvider = 'claude' | 'gemini' | 'openai' | 'groq';

export interface ProviderMeta {
  id: AiProvider;
  name: string;
  envVar: string;
  defaultModel: string;
  availableModels: string[];
  placeholder: string;
  docUrl: string;
  color: string;
}

export const AI_PROVIDERS: Record<AiProvider, ProviderMeta> = {
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-7-sonnet-20250219',
    availableModels: [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
    placeholder: 'sk-ant-api03-...',
    docUrl: 'https://console.anthropic.com/settings/keys',
    color: '#D97706',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-pro',
    availableModels: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ],
    placeholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/app/apikey',
    color: '#2563EB',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    availableModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
    ],
    placeholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    color: '#10B981',
  },
  groq: {
    id: 'groq',
    name: 'Groq (LPU Inference)',
    envVar: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    availableModels: [
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
      'mixtral-8x7b-32768',
    ],
    placeholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    color: '#F97316',
  },
};

export interface CustomApiKey {
  id: string;
  name: string;
  providerOrModel: string;
  apiKey: string;
  createdAt: string;
}

export interface ProfileSettings {
  activeProvider: AiProvider;
  selectedModel: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  groqApiKey: string;
  customKeys?: CustomApiKey[];
  workerTag: string;
  workerPort: number;
  sessionToken: string;
  encryptionMode: string;
  lastUpdated?: string;
}

const STORAGE_KEY = 'helmer_profile_settings_v1';

export const DEFAULT_SETTINGS: ProfileSettings = {
  activeProvider: 'gemini',
  selectedModel: 'gemini-2.5-pro',
  anthropicApiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  groqApiKey: '',
  customKeys: [],
  workerTag: 'helmer-worker-alpha-01',
  workerPort: 3000,
  sessionToken: 'hlm_ses_9f4e2b819c',
  encryptionMode: 'AES-256-GCM Secure Enclave',
};

/** Get the current profile and API key settings from browser storage. */
export function getProfileSettings(): ProfileSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist updated profile and API keys. */
export function saveProfileSettings(updates: Partial<ProfileSettings>): ProfileSettings {
  const current = getProfileSettings();
  const next: ProfileSettings = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('helmer-settings-change', { detail: next }));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }

  return next;
}

/** Clear a specific API key */
export function clearApiKey(provider: AiProvider): ProfileSettings {
  const keyFieldMap: Record<AiProvider, keyof ProfileSettings> = {
    claude: 'anthropicApiKey',
    gemini: 'geminiApiKey',
    openai: 'openaiApiKey',
    groq: 'groqApiKey',
  };

  return saveProfileSettings({ [keyFieldMap[provider]]: '' });
}

/** Obfuscate API key for preview while retaining prefix and suffix. */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 7);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that an API key matches the expected format for a given provider.
 * Throws or returns an error message if a key belonging to another model/provider
 * or an invalid format is entered.
 */
export function validateApiKeyFormat(provider: AiProvider, rawKey: string): KeyValidationResult {
  const key = rawKey.trim();
  if (!key) return { valid: true };

  // Detect cross-provider mismatches
  if (provider === 'gemini') {
    if (key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Detected Anthropic Claude key! This field only accepts Google Gemini API keys (starting with AIzaSy... or AQ...).' };
    }
    if (key.startsWith('sk-') || key.startsWith('sk-proj-')) {
      return { valid: false, error: 'Detected OpenAI key! This field only accepts Google Gemini API keys (starting with AIzaSy... or AQ...).' };
    }
    if (key.startsWith('gsk_')) {
      return { valid: false, error: 'Detected Groq key! This field only accepts Google Gemini API keys (starting with AIzaSy... or AQ...).' };
    }
    if (!key.startsWith('AIzaSy') && !key.startsWith('AQ.') && key.length < 20) {
      return { valid: false, error: 'Invalid Google Gemini API key format. Standard keys start with "AIzaSy" or "AQ.".' };
    }
  } else if (provider === 'openai') {
    if (key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Detected Anthropic Claude key! This field only accepts OpenAI API keys (starting with sk- or sk-proj-).' };
    }
    if (key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
      return { valid: false, error: 'Detected Google Gemini key! This field only accepts OpenAI API keys (starting with sk- or sk-proj-).' };
    }
    if (key.startsWith('gsk_')) {
      return { valid: false, error: 'Detected Groq key! This field only accepts OpenAI API keys (starting with sk- or sk-proj-).' };
    }
    if (!key.startsWith('sk-')) {
      return { valid: false, error: 'Invalid OpenAI API key format. Keys must start with "sk-".' };
    }
    if (key.length < 25) {
      return { valid: false, error: 'OpenAI API key is too short. Please verify your complete key.' };
    }
  } else if (provider === 'claude') {
    if (key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
      return { valid: false, error: 'Detected Google Gemini key! This field only accepts Anthropic Claude keys (starting with sk-ant-).' };
    }
    if (key.startsWith('gsk_')) {
      return { valid: false, error: 'Detected Groq key! This field only accepts Anthropic Claude keys (starting with sk-ant-).' };
    }
    if (key.startsWith('sk-proj-') || (key.startsWith('sk-') && !key.startsWith('sk-ant-'))) {
      return { valid: false, error: 'Detected OpenAI key! This field only accepts Anthropic Claude keys (starting with sk-ant-).' };
    }
    if (!key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Invalid Anthropic Claude API key format. Keys must start with "sk-ant-".' };
    }
  } else if (provider === 'groq') {
    if (key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Detected Anthropic Claude key! This field only accepts Groq API keys (starting with gsk_).' };
    }
    if (key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
      return { valid: false, error: 'Detected Google Gemini key! This field only accepts Groq API keys (starting with gsk_).' };
    }
    if (key.startsWith('sk-proj-') || key.startsWith('sk-')) {
      return { valid: false, error: 'Detected OpenAI key! This field only accepts Groq API keys (starting with gsk_).' };
    }
    if (!key.startsWith('gsk_')) {
      return { valid: false, error: 'Invalid Groq API key format. Keys must start with "gsk_".' };
    }
    if (key.length < 20) {
      return { valid: false, error: 'Groq API key is too short. Please verify your complete key.' };
    }
  }

  return { valid: true };
}
