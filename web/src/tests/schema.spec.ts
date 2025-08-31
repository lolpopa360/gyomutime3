import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category: z.enum(['기타','이미지','문서','데이터','코드'])
})

describe('폼 스키마', () => {
  it('유효성 체크', () => {
    const ok = Schema.safeParse({ title: 't', category: '기타' })
    expect(ok.success).toBe(true)
    const bad = Schema.safeParse({ title: '', category: '기타' })
    expect(bad.success).toBe(false)
  })
})

