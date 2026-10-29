export type AiProvider = 'openai' | 'anthropic' | 'openai-compatible';
export interface AiConfig {
    provider: AiProvider;
    model: string;
    baseUrl?: string;
    secret: string;
    timeoutMs?: number;
}
/**
 * Determines whether an AI provider has been configured through the action
 * inputs. All of `aiProvider`, `aiModel` and `aiSecret` must be present for the
 * AI feature to be active. `aiBaseUrl` is optional and falls back to a built-in
 * default depending on the provider.
 */
export declare function readAiConfig(): AiConfig | undefined;
export declare function isAiConfigured(config: AiConfig | undefined): config is AiConfig;
/**
 * Analyzes a schema diff with the configured AI provider. Returns the model's
 * response as plain text. Throws if the request fails so the caller can decide
 * how to surface the problem.
 */
export declare function analyzeDiff(config: AiConfig, diff: string, schema: object): Promise<string>;
