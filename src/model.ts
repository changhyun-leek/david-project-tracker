export type Kind = 'student' | 'teacher'
export type MediaKind = 'photo' | 'video' | 'text'
export type Participant = { id: string; kind: Kind; sourceId: string; name: string; active: boolean }
export type Alias = { room: string; alias: string; participantId: string }
export type Evidence = { fingerprint: string; room: string; sender: string; sentAt: string; assignedDate: string; mediaKind: MediaKind; excerpt: string; participantId: string | null }
export type DailyCheck = { participantId: string; date: string; qtDone: boolean; exerciseDone: boolean; confirmed?: boolean; selfQt?: boolean; selfExercise?: boolean; note: string; updatedAt?: string }
export type BoardRow = { rank: number; name: string; kind: Kind; qt: number; exercise: number; total: number; me: boolean }
export type MemberDay = { date: string; confirmed: boolean; qtDone: boolean; exerciseDone: boolean; selfQt: boolean; selfExercise: boolean }
export type MemberView = { name: string; kind: Kind; today: string; days: MemberDay[]; posts: { date: string; mediaKind: MediaKind }[]; board: BoardRow[] }
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
export function currentProjectDay(now = new Date()): string {
  const day = todayKst(now)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(now))
  if (hour >= 4) return day
  const previous = new Date(`${day}T12:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}
// 관리자가 확정하지 않은 기록은 저장된 체크 값이 아니라 아래 suggestion으로만 보여 준다.
export function isConfirmed(check: DailyCheck | undefined): boolean { return Boolean(check && check.confirmed !== false) }
export type Suggestion = { qt: boolean; exercise: boolean; qtFrom: '' | 'photo' | 'self'; exerciseFrom: '' | 'video' | 'self' }
export function suggestion(check: DailyCheck | undefined, kinds: MediaKind[]): Suggestion {
  const photo = kinds.includes('photo'), video = kinds.includes('video')
  const selfQt = Boolean(check?.selfQt), selfEx = Boolean(check?.selfExercise)
  return { qt: photo || selfQt, exercise: video || selfEx, qtFrom: photo ? 'photo' : selfQt ? 'self' : '', exerciseFrom: video ? 'video' : selfEx ? 'self' : '' }
}
export function status(check: DailyCheck | undefined, evidenceCount: number): 'complete' | 'partial' | 'review' | 'unposted' {
  if (isConfirmed(check)) {
    if (check!.qtDone && check!.exerciseDone) return 'complete'
    if (check!.qtDone || check!.exerciseDone) return 'partial'
  }
  return evidenceCount || check?.selfQt || check?.selfExercise ? 'review' : 'unposted'
}
export function statusLabel(state: ReturnType<typeof status>, day: string, today = currentProjectDay()): string {
  if (state !== 'unposted') return { complete: '완료', partial: '일부 완료', review: '확인 필요' }[state]
  return day > today ? '예정' : day === today ? '진행 중' : '미게시'
}
