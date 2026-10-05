import { describe, expect, it } from 'vitest'
import { parseKakao } from './kakao'
import { currentProjectDay, status, statusLabel } from './model'

describe('Kakao export', () => {
  const sample = `예시방 님과 카카오톡 대화\n--------------- 2026년 10월 5일 월요일 ---------------\n[?] [오전 1:20] 사진\n[?] [오전 1:20] 동영상\n[학생가] [오전 8:19] 동영상\n[교사가] [오후 2:34] 첫 줄\n둘째 줄`
  it('assigns before 04:00 to the previous day and keeps later posts on today', () => {
    const parsed = parseKakao(sample)
    expect(parsed.map(p => p.assignedDate)).toEqual(['2026-10-04', '2026-10-04', '2026-10-05', '2026-10-05'])
    expect(parsed.map(p => p.mediaKind)).toEqual(['photo', 'video', 'video', 'text'])
    expect(parsed[3].excerpt).toBe('첫 줄\n둘째 줄')
  })
  it('does not infer completion from media labels', () => {
    expect(status(undefined, 2)).toBe('review')
    expect(status({ participantId: 'p', date: '2026-10-04', qtDone: true, exerciseDone: false, note: '' }, 2)).toBe('partial')
  })
  it('keeps the previous day open until 04:00 Korea time', () => {
    expect(currentProjectDay(new Date('2026-10-04T18:59:00Z'))).toBe('2026-10-04')
    expect(currentProjectDay(new Date('2026-10-04T19:00:00Z'))).toBe('2026-10-05')
    expect(statusLabel('unposted', '2026-10-04', currentProjectDay(new Date('2026-10-04T18:59:00Z')))).toBe('진행 중')
  })
})
