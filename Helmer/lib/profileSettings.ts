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

export interface ProfileSettings {
  activeProvider: AiProvider;
  selectedModel: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  groqApiKey: string;
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
