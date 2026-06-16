import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env'
import { HaikuSuggestionEnhancer } from './haiku-enhancer.service'
import { HaikuProfileQueryComposer } from './haiku-query-composer.service'
import type { IProfileQueryComposer } from './profile-query-composer.interface'
import type { ISuggestionEnhancer } from './suggestion-enhancer.interface'
import { TemplateSuggestionEnhancer } from './template-enhancer.service'
import { TemplateProfileQueryComposer } from './template-query-composer.service'

let instance: ISuggestionEnhancer | null = null

/**
 * Resolve o enhancer pela env (lazy). Com ANTHROPIC_API_KEY usa o Haiku; sem
 * ela, o template determinístico (degradação graciosa, NÃO erro — diferente do
 * Places). Chame dentro do service para o setSuggestionEnhancer dos testes vencer.
 */
export function getSuggestionEnhancer(): ISuggestionEnhancer {
  if (instance) return instance
  instance = env.ANTHROPIC_API_KEY
    ? new HaikuSuggestionEnhancer(
        new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      )
    : new TemplateSuggestionEnhancer()
  return instance
}

/** Permite injetar um enhancer customizado em testes. */
export function setSuggestionEnhancer(enhancer: ISuggestionEnhancer): void {
  instance = enhancer
}

let composerInstance: IProfileQueryComposer | null = null

/**
 * Resolve o composer de query pela env (lazy). Com ANTHROPIC_API_KEY usa o Haiku;
 * sem ela, o template determinístico (degradação graciosa). Chame dentro do
 * service para o setProfileQueryComposer dos testes vencer.
 */
export function getProfileQueryComposer(): IProfileQueryComposer {
  if (composerInstance) return composerInstance
  composerInstance = env.ANTHROPIC_API_KEY
    ? new HaikuProfileQueryComposer(
        new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      )
    : new TemplateProfileQueryComposer()
  return composerInstance
}

/** Permite injetar um composer customizado em testes. */
export function setProfileQueryComposer(composer: IProfileQueryComposer): void {
  composerInstance = composer
}

export * from './profile-query-composer.interface'
export * from './suggestion-enhancer.interface'
