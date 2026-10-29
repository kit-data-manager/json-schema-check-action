import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

jest.unstable_mockModule('@actions/core', () => core)

const { readAiConfig } = await import('../src/ai.js')

function setAiInputs(overrides: Record<string, string>): void {
  core.getInput.mockImplementation(
    (name: string) =>
      overrides[name] ??
      { aiProvider: '', aiModel: '', aiSecret: '', aiBaseUrl: '' }[name] ??
      ''
  )
}

describe('ai.ts readAiConfig', () => {
  beforeEach(() => {
    setAiInputs({
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiSecret: 'secret',
      aiBaseUrl: 'https://api.openai.com/v1'
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns undefined when nothing is configured', () => {
    setAiInputs({})
    expect(readAiConfig()).toBeUndefined()
  })

  it('returns undefined when only the provider is set', () => {
    setAiInputs({ aiProvider: 'openai' })
    expect(readAiConfig()).toBeUndefined()
  })

  it('returns undefined when the secret is missing', () => {
    setAiInputs({ aiProvider: 'openai', aiModel: 'gpt-4o-mini' })
    expect(readAiConfig()).toBeUndefined()
  })

  it('returns a config with the resolved base URL for openai', () => {
    const config = readAiConfig()
    expect(config?.provider).toBe('openai')
    expect(config?.model).toBe('gpt-4o-mini')
    expect(config?.secret).toBe('secret')
    expect(config?.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('falls back to the built-in base URL when none is provided', () => {
    setAiInputs({ aiProvider: 'anthropic', aiModel: 'claude', aiSecret: 's' })
    // baseUrl not set -> fallback handled at request time
    expect(readAiConfig()?.baseUrl).toBeUndefined()
  })

  it('normalizes an unknown provider to openai-compatible', () => {
    setAiInputs({ aiProvider: 'github-models', aiModel: 'm', aiSecret: 's' })
    expect(readAiConfig()?.provider).toBe('openai-compatible')
  })
})
