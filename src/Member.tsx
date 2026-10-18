import { useEffect, useState } from 'react'
import { BookOpen, Check, Dumbbell, ExternalLink, LogOut, RefreshCw, Trophy } from 'lucide-react'
import { api } from './api'
import { dates, pushupGoal, type MemberDay, type MemberView } from './model'

const KEY = 'david-member-name'
const QT_URL = 'https://www.duranno.com/sena/qt.asp'
export function rememberedMember(): string | null { try { return localStorage.getItem(KEY) } catch { return null } }
export function rememberMember(name: string) { try { localStorage.setItem(KEY, name) } catch { /* 저장이 막혀도 이번 접속은 그대로 쓴다 */ } }
export function forgetMember() { try { localStorage.removeItem(KEY) } catch { /* 무시 */ } }

function dateLabel(date: string) { return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일` }
function previousDay(day: string) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }
function dayState(day: MemberDay | undefined, posted: boolean): 'complete' | 'partial' | 'review' | 'unposted' {
  if (day?.confirmed && day.qtDone && day.exerciseDone) return 'complete'
  if (day?.confirmed && (day.qtDone || day.exerciseDone)) return 'partial'
  return posted || day?.selfQt || day?.selfExercise ? 'review' : 'unposted'
}
const stateText = { complete: '확인 완료', partial: '일부 확인', review: '확인 대기', unposted: '기록 없음' }

export function Member({ name, onLeave }: { name: string; onLeave: () => void }) {
  const [view, setView] = useState<MemberView | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<string | null>(null)

  async function load() {
    try { setView(await api.memberView(name)) } catch (e) { setMessage(e instanceof Error ? e.message : '불러오지 못했습니다.') }
  }
  useEffect(() => { void load() }, [name])

  if (!view) return <main className="loading">{message ? <div className="member-error"><p>{message}</p><button className="outline" onClick={onLeave}>이름 다시 입력</button></div> : '기록을 불러오는 중입니다.'}</main>

  const today = view.today
  const yesterday = previousDay(today)
  const day = target ?? today
  const record = view.days.find(d => d.date === day)
  const locked = Boolean(record?.confirmed)
  const qt = locked ? record!.qtDone : Boolean(record?.selfQt)
  const ex = locked ? record!.exerciseDone : Boolean(record?.selfExercise)
  const me = view.board.find(r => r.me)
  const inProject = dates.includes(day)

  async function toggle(next: { qt: boolean; ex: boolean }) {
    setBusy(true); setMessage('')
    try { await api.memberCheck(name, day, next.qt, next.ex); await load() } catch (e) { setMessage(e instanceof Error ? e.message : '저장하지 못했습니다.') } finally { setBusy(false) }
  }

  return <main className="member-shell">
    <header className="member-head">
      <div className="logo-mark small">D</div>
      <div><span>다윗 프로젝트 시즌 2</span><strong>{view.name}님, 오늘도 화이팅!</strong></div>
      <button aria-label="나가기" onClick={onLeave}><LogOut size={18} /></button>
    </header>

    <a className="qt-link" href={QT_URL} target="_blank" rel="noopener noreferrer"><BookOpen size={20} /><span><strong>오늘의 새나 큐티 열기</strong><small>두란노 새나 큐티 페이지로 이동</small></span><ExternalLink size={16} /></a>

    {message && <div className="notice error" role="status">{message}</div>}

    <section className="member-card">
      <div className="member-day-tabs">
        <button className={day === today ? 'active' : ''} onClick={() => setTarget(null)}>오늘 · {dateLabel(today)}</button>
        <button className={day === yesterday ? 'active' : ''} onClick={() => setTarget(yesterday)}>어제 · {dateLabel(yesterday)}</button>
      </div>
      {inProject ? <>
        <div className="goal"><Dumbbell size={18} /><span>{day === today ? '오늘' : '어제'}의 운동</span><strong>푸시업 {pushupGoal(day)}개</strong></div>
        <div className="member-checks">
          <button className={qt ? 'checked' : ''} disabled={busy || locked} onClick={() => void toggle({ qt: !qt, ex })}><BookOpen size={22} /><span>말씀</span><b>{qt ? <><Check size={14} /> 했어요</> : '아직'}</b></button>
          <button className={ex ? 'checked' : ''} disabled={busy || locked} onClick={() => void toggle({ qt, ex: !ex })}><Dumbbell size={22} /><span>운동</span><b>{ex ? <><Check size={14} /> 했어요</> : '아직'}</b></button>
        </div>
        <p className="member-hint">{locked ? '선생님이 확인을 마친 날이에요.' : '체크하고 카톡방에 말씀 사진과 운동 영상도 올려 주세요. 선생님이 확인하면 순위에 들어가요.'}</p>
      </> : <p className="member-hint">프로젝트 기간(10월 4일~31일)이 아니에요.</p>}
    </section>

    <section className="member-card">
      <h2>내 기록</h2>
      <div className="member-stats"><div><span>말씀</span><strong>{me?.qt ?? 0}</strong></div><div><span>운동</span><strong>{me?.exercise ?? 0}</strong></div><div><span>합계</span><strong>{me?.total ?? 0}</strong></div><div><span>순위</span><strong>{me?.rank ?? '-'}위</strong></div></div>
      <div className="day-dots member-dots">{dates.map((d, i) => { const s = dayState(view.days.find(x => x.date === d), view.posts.some(p => p.date === d)); return <span key={d} title={`${dateLabel(d)} · ${stateText[s]}`} className={d > today ? 'future' : s}>{i + 1}</span> })}</div>
      <p className="member-legend"><i className="complete" /> 확인 완료 <i className="partial" /> 일부 <i className="review" /> 확인 대기</p>
    </section>

    <section className="member-card">
      <div className="board-head"><h2><Trophy size={18} /> 누적 순위</h2><button className="outline" disabled={busy} onClick={() => void load()}><RefreshCw size={14} /> 새로고침</button></div>
      <p className="member-hint">말씀 1회, 운동 1회를 각각 1점으로 셉니다. 선생님이 확인한 기록만 들어가요.</p>
      <ol className="board">{view.board.map(r => <li key={r.name} className={r.me ? 'me' : ''}><b>{r.rank}</b><span>{r.name}{r.kind === 'teacher' && <small>선생님</small>}</span><em>말씀 {r.qt} · 운동 {r.exercise}</em><strong>{r.total}</strong></li>)}</ol>
    </section>
    <footer>새벽이슬 청소년부 · 다윗 프로젝트 시즌 2</footer>
  </main>
}
