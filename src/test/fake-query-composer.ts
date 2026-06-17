import type {
  IProfileQueryComposer,
  SuggestionProfile,
} from '../lib/suggestion-ai'

/**
 * Composer fake para testes: determinístico e verificável. Registra o último
 * perfil recebido (`lastProfile`) e conta chamadas (`calls`). Por padrão deriva
 * as frases dos próprios rótulos do perfil; roteirize `nextQueries` para fixar a
 * saída num cenário. Injetado via setProfileQueryComposer no setup.ts.
 */
export class FakeProfileQueryComposer implements IProfileQueryComposer {
  calls = 0
  lastProfile: SuggestionProfile | null = null
  /** Sobrescreva para fixar as frases retornadas num cenário. */
  nextQueries: string[] | null = null

  async composeProfileQueries(profile: SuggestionProfile): Promise<string[]> {
    this.calls++
    this.lastProfile = profile
    if (this.nextQueries) return this.nextQueries
    // Default: interesses finos antes, depois categorias; dedup e teto de 2.
    return [...new Set([...profile.interests, ...profile.categories])].slice(
      0,
      2,
    )
  }

  reset(): void {
    this.calls = 0
    this.lastProfile = null
    this.nextQueries = null
  }
}

export const fakeQueryComposer = new FakeProfileQueryComposer()
