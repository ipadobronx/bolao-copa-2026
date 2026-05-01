import { describe, expect, it } from 'vitest'
import { avatarColor, avatarInitials } from '../avatar-color'

describe('avatarColor', () => {
  it('retorna uma string não-vazia', () => {
    expect(avatarColor('abc-123')).toBeTruthy()
  })

  it('é determinístico — mesmo userId → mesmo resultado', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(avatarColor(id)).toBe(avatarColor(id))
  })

  it('userIds diferentes podem retornar valores diferentes', () => {
    const results = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(avatarColor)
    )
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('avatarInitials', () => {
  it('extrai até 2 iniciais de um nome completo', () => {
    expect(avatarInitials('Marco Cardoso')).toBe('MC')
  })

  it('nome com uma palavra → 1 inicial', () => {
    expect(avatarInitials('Jonatas')).toBe('J')
  })

  it('string vazia → string vazia', () => {
    expect(avatarInitials('')).toBe('')
  })

  it('espaços extras não geram iniciais fantasma', () => {
    expect(avatarInitials('  Ana  Beatriz  ')).toBe('AB')
  })
})
