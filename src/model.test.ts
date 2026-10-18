import { describe, expect, it } from 'vitest'
import { isConfirmed, status, suggestion } from './model'

describe('auto marks and confirmation', () => {
  const base = { participantId: 'p', date: '2026-10-05', qtDone: false, exerciseDone: false, note: '' }
  it('suggests 말씀 from photos and 운동 from videos', () => {
    expect(suggestion(undefined, ['photo', 'video'])).toMatchObject({ qt: true, exercise: true, qtFrom: 'photo', exerciseFrom: 'video' })
    expect(suggestion(undefined, ['video', 'text'])).toMatchObject({ qt: false, exercise: true })
  })
  it('falls back to self checks when there is no media', () => {
    expect(suggestion({ ...base, confirmed: false, selfQt: true }, [])).toMatchObject({ qt: true, qtFrom: 'self', exercise: false })
  })
  it('counts only confirmed records as complete', () => {
    expect(isConfirmed({ ...base, qtDone: true, exerciseDone: true })).toBe(true)
    expect(status({ ...base, confirmed: false, selfQt: true, selfExercise: true }, 0)).toBe('review')
    expect(status({ ...base, confirmed: true, qtDone: true, exerciseDone: true }, 0)).toBe('complete')
    expect(status({ ...base, confirmed: false, note: '메모' }, 0)).toBe('unposted')
  })
})
