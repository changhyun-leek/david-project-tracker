export type Kind = 'student' | 'teacher'
export type MediaKind = 'photo' | 'video' | 'text'
export type Participant = { id: string; kind: Kind; sourceId: string; name: string; active: boolean }
export type Alias = { alias: string; participantId: string }
export type Evidence = { fingerprint: string; room: string; sender: string; sentAt: string; assignedDate: string; mediaKind: MediaKind; excerpt: string; participantId: string | null }
export type DailyCheck = { participantId: string; date: string; qtDone: boolean; exerciseDone: boolean; note: string; updatedAt?: string }
export type CatalogPerson = { id: string; name: string; kind: Kind }
export type Dashboard = { participants: Participant[]; aliases: Alias[]; messages: Evidence[]; checks: DailyCheck[]; catalog: CatalogPerson[] }
export const START = '2026-10-04'
export const END = '2026-10-31'
export const dates = Array.from({ length: 28 }, (_, n) => {
  const d = new Date('2026-10-04T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
})
export function todayKst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function status(check: DailyCheck | undefined, evidenceCount: number): 'complete' | 'partial' | 'review' | 'unposted' {
  if (check?.qtDone && check.exerciseDone) return 'complete'
  if (check?.qtDone || check?.exerciseDone) return 'partial'
  return evidenceCount ? 'review' : 'unposted'
}
export function statusLabel(state: ReturnType<typeof status>, day: string, today = todayKst()): string {
  if (state !== 'unposted') return { complete: '완료', partial: '일부 완료', review: '확인 필요' }[state]
  return day > today ? '예정' : day === today ? '진행 중' : '미게시'
}
