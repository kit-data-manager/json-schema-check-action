import * as core from '@actions/core'
import fetch from 'node-fetch'

export type AiProvider = 'openai' | 'anthropic' | 'openai-compatible'

export interface AiConfig {
  provider: AiProvider
  model: string
  baseUrl?: string
  secret: string
  timeoutMs?: number
}

const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  'openai-compatible': ''
}

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Determines whether an AI provider has been configured through the action
 * inputs. All of `aiProvider`, `aiModel` and `aiSecret` must be present for the
 * AI feature to be active. `aiBaseUrl` is optional and falls back to a built-in
 * default depending on the provider.
 */
export function readAiConfig(): AiConfig | undefined {
  const provider = core.getInput('aiProvider').trim()
  const model = core.getInput('aiModel').trim()
  const secret = core.getInput('aiSecret').trim()

  if (!provider && !model && !secret) {
    return undefined
  }

  const baseUrl = core.getInput('aiBaseUrl').trim()

  let normalizedProvider: AiProvider
  if (
    provider === 'openai' ||
    provider === 'anthropic' ||
    provider === 'openai-compatible'
  ) {
    normalizedProvider = provider
  } else {
    // Treat any other value as an OpenAI-compatible endpoint, e.g. a bare
    // host name or a custom OpenAI-compatible server.
    core.warning(
      `Unknown AI provider '${provider}'. Falling back to 'openai-compatible'.`
    )
    normalizedProvider = 'openai-compatible'
  }

  if (!model) {
    core.warning(
      'AI is partially configured (missing aiModel). Falling back to static hints.'
    )
    return undefined
  }
  if (!secret) {
    core.warning(
      'AI is partially configured (missing aiSecret). Falling back to static hints.'
    )
    return undefined
  }

  return {
    provider: normalizedProvider,
    model,
    baseUrl: baseUrl || undefined,
    secret
  }
}

export function isAiConfigured(
  config: AiConfig | undefined
): config is AiConfig {
  return config !== undefined
}

/**
 * Analyzes a schema diff with the configured AI provider. Returns the model's
 * response as plain text. Throws if the request fails so the caller can decide
 * how to surface the problem.
 */
export async function analyzeDiff(
  config: AiConfig,
  diff: string,
  schema: object
): Promise<string> {
  const prompt = buildPrompt(diff, schema)
  const content = await requestCompletion(config, prompt)
  if (!content) {
    throw new Error('Received empty response from the AI provider.')
  }
  return content.trim()
}

function formatSchema(schema: object): string {
  try {
    return JSON.stringify(schema, null, 2)
  } catch {
    return Object.prototype.toString.call(schema)
  }
}

function buildPrompt(diff: string, schema: object): string {
  return [
    'I have two JSON schemas that differ as shown in the diff below.',
    'The current (new) bundled schema is provided below for context so you can',
    'also assess its consistency and remarkable issues.',
    '',
    'Please answer the following two questions:',
    '',
    '1. Backwards compatibility: Are the two schemas compatible? Explain the',
    '   changed attributes and, for each, state whether the change breaks',
    '   backwards compatibility and why.',
    '2. Are there some other remarkable issues in the new schema, e.g., required',
    '   attributes that are not defined in the schema, or other inconsistencies?',
    '3. Next version: Assuming the current schema is at version 1.0.0, which',
    '   semantic version number should the next release use based on the',
    '   changes? Apply semantic versioning principles.',
    '',
    'Render the result as a table with columns: Property, Attribute Changed,',
    'Backward Compatible?, Comments. Then add other observations and the',
    'suggested next version number on its own line stating that you assume the',
    'current version number 1.0.0 and which kind of update it is, i.e., bugfix,',
    'minor, or major.',
    '',
    'Diff:',
    '```diff',
    diff,
    '```',
    '',
    'Current (new) schema:',
    '```json',
    formatSchema(schema),
    '```'
  ].join('\n')
}

async function requestCompletion(
  config: AiConfig,
  prompt: string
): Promise<string> {
  const baseUrl = resolveBaseUrl(config)
  if (config.provider === 'anthropic') {
    return requestAnthropic(config, baseUrl, prompt)
  }
  return requestOpenAiCompatible(config, baseUrl, prompt)
}

function resolveBaseUrl(config: AiConfig): string {
  if (config.baseUrl) return config.baseUrl
  const fallback = DEFAULT_BASE_URLS[config.provider]
  if (!fallback) {
    throw new Error(
      `No base URL configured and no default available for AI provider '${config.provider}'.`
    )
  }
  return fallback
}

async function requestOpenAiCompatible(
  config: AiConfig,
  baseUrl: string,
  prompt: string
): Promise<string> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.secret}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  })

  if (!response.ok) {
    const body = await safeBody(response)
    throw new Error(
      `AI request to ${endpoint} failed with status ${response.status}: ${body}`
    )
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI response did not contain a message content.')
  }
  return content
}

async function requestAnthropic(
  config: AiConfig,
  baseUrl: string,
  prompt: string
): Promise<string> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/messages`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.secret,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system:
        'You are an expert in JSON schema evolution and semantic versioning.',
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  })

  if (!response.ok) {
    const body = await safeBody(response)
    throw new Error(
      `AI request to ${endpoint} failed with status ${response.status}: ${body}`
    )
  }

  const payload = (await response.json()) as {
    content?: Array<{ text?: string }>
  }
  const content = payload.content?.map((block) => block.text ?? '').join('\n')
  if (!content) {
    throw new Error('AI response did not contain message content.')
  }
  return content
}

async function safeBody(response: {
  text(): Promise<string>
}): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return '<unreadable body>'
  }
}
