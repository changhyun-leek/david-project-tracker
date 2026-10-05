import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildWorkbook } from './export'
import type { Dashboard } from './model'

describe('Excel export', () => {
  it('creates three readable worksheets with student and teacher progress', () => {
    const data: Dashboard = {
      participants: [{ id: '1', kind: 'student', sourceId: 'a', name: '학생가', active: true }, { id: '2', kind: 'teacher', sourceId: 'b', name: '교사가', active: true }],
      aliases: [],
      messages: [{ fingerprint: 'x', room: '남자방', sender: '?', sentAt: '2026-10-05T01:20:00+09:00', assignedDate: '2026-10-04', mediaKind: 'photo', excerpt: '사진', participantId: '1' }],
      checks: [{ participantId: '1', date: '2026-10-04', qtDone: true, exerciseDone: true, note: '확인' }], catalog: [],
    }
    const files = unzipSync(buildWorkbook(data))
    expect(Object.keys(files).filter(p => p.startsWith('xl/worksheets/sheet'))).toHaveLength(3)
    const summary = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(summary).toContain('학생가')
    expect(summary).toContain('교사가')
    expect(summary).toContain('<v>1</v>')
    const daily = strFromU8(files['xl/worksheets/sheet2.xml'])
    expect(daily).toContain('2026-10-04')
    expect(daily).toContain('완료')
  })
})
