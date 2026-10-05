import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Download, FileUp, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { api } from './api'
import { downloadExcel } from './export'
import { fingerprintMessages, parseKakao } from './kakao'
import { dates, status, statusLabel, todayKst, type CatalogPerson, type DailyCheck, type Dashboard, type Participant } from './model'

const mediaLabels = { photo: '사진', video: '동영상', text: '글' }
function dateLabel(date: string) { return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일` }
function displayTime(iso: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) }
function findCheck(data: Dashboard, personId: string, date: string) { return data.checks.find(c => c.participantId === personId && c.date === date) }
function countFor(data: Dashboard, personId: string, date: string) { return data.messages.filter(m => m.participantId === personId && m.assignedDate === date).length }

export function App() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [pin, setPin] = useState('')
  const [day, setDay] = useState(() => dates.includes(todayKst()) ? todayKst() : todayKst() > dates[27] ? dates[27] : dates[0])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'student' | 'teacher'>('all')
  const [query, setQuery] = useState('')
  const [aliasChoice, setAliasChoice] = useState<Record<string, string>>({})
  const [view, setView] = useState<'today' | 'people' | 'evidence'>('today')

  async function load() { setData(await api.dashboard()) }
  useEffect(() => {
    api.hasSession().then(async has => { if (has) { await load(); setSignedIn(true) } }).catch(e => setMessage(e.message))
  }, [])
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await task() } catch (e) { setMessage(e instanceof Error ? e.message : '작업에 실패했습니다.') } finally { setBusy(false) }
  }
  async function login() {
    await run(async () => { await api.login(pin); await load(); setSignedIn(true); setPin('') })
  }
  async function importFile(file?: File) {
    if (!file) return
    await run(async () => {
      const parsed = parseKakao(await file.text())
      const messages = (await fingerprintMessages(parsed)).filter(m => dates.includes(m.assignedDate))
      if (!messages.length) throw new Error('프로젝트 기간의 카카오톡 메시지를 찾지 못했습니다.')
      const oldCount = data?.messages.length ?? 0
      for (let i = 0; i < messages.length; i += 500) await api.import(messages.slice(i, i + 500))
      const refreshed = await api.dashboard()
      setData(refreshed)
      setMessage(`${file.name}: ${messages.length}건 확인, 새 메시지 ${refreshed.messages.length - oldCount}건 반영`)
    })
  }
  async function updateCheck(person: Participant, patch: Partial<DailyCheck>) {
    if (!data) return
    const old = findCheck(data, person.id, day)
    const next: DailyCheck = { participantId: person.id, date: day, qtDone: old?.qtDone ?? false, exerciseDone: old?.exerciseDone ?? false, note: old?.note ?? '', ...patch }
    await run(async () => { await api.saveCheck(next); await load() })
  }
  async function link(alias: string, room: string) {
    const choice = aliasChoice[`${room}\u001f${alias}`]
    if (!choice) return
    const [kind, sourceId] = choice.split(':') as [CatalogPerson['kind'], string]
    await run(async () => { await api.linkAlias(alias, room, kind, sourceId); await load(); setMessage(`${alias} 이름을 연결했습니다.`) })
  }
  const people = useMemo(() => data?.participants.filter(p => p.active && (filter === 'all' || p.kind === filter) && p.name.includes(query)).sort((a, b) => a.name.localeCompare(b.name, 'ko')) ?? [], [data, filter, query])
  const unresolved = useMemo(() => [...new Map(data?.messages.filter(m => !m.participantId).map(m => [`${m.room}\u001f${m.sender}`, { room: m.room, sender: m.sender }]) ?? []).values()], [data])
  const totals = useMemo(() => {
    if (!data) return { complete: 0, partial: 0, review: 0, unposted: 0 }
    return data.participants.filter(p => p.active).reduce((acc, p) => { acc[status(findCheck(data, p.id, day), countFor(data, p.id, day))]++; return acc }, { complete: 0, partial: 0, review: 0, unposted: 0 })
  }, [data, day])
  const dayIndex = dates.indexOf(day)

  if (!signedIn) return <main className="login-shell"><section className="login-card"><div className="logo-mark">D</div><p className="eyebrow">새벽이슬 청소년부</p><h1>다윗 프로젝트<br />진행관리</h1><p className="muted">28일의 작은 실천을 한눈에 확인합니다.</p><form onSubmit={e => { e.preventDefault(); void login() }}><label htmlFor="pin">기존 출석 앱 PIN</label><input id="pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN 입력" required /><button className="primary" disabled={busy}>관리자 로그인</button></form>{message && <p className="notice error">{message}</p>}<p className="privacy"><ShieldCheck size={16} /> 지정된 관리자 계정만 접속할 수 있습니다.</p></section></main>

  if (!data) return <main className="loading">진행 현황을 불러오는 중입니다.</main>

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="logo-mark small">D</div><div><strong>다윗 프로젝트</strong><span>시즌 2 · 진행관리</span></div></div><nav><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}><CalendarDays size={18} /> 일별 확인</button><button className={view === 'people' ? 'active' : ''} onClick={() => setView('people')}><Check size={18} /> 전체 현황</button><button className={view === 'evidence' ? 'active' : ''} onClick={() => setView('evidence')}><FileUp size={18} /> 게시물 내역</button><button className="mobile-logout" aria-label="로그아웃" onClick={() => void run(async () => { await api.logout(); setSignedIn(false); setData(null) })}><LogOut size={18} /> 로그아웃</button></nav><div className="side-bottom"><span>2026.10.04 — 10.31</span><button onClick={() => void run(async () => { await api.logout(); setSignedIn(false); setData(null) })}><LogOut size={17} /> 로그아웃</button></div></aside>
    <main className="main"><header className="topbar"><div><p className="eyebrow">PROJECT DASHBOARD</p><h1>{view === 'today' ? '일별 인증 확인' : view === 'people' ? '참가자 전체 현황' : '게시물 확인 내역'}</h1></div><div className="top-actions"><label className="upload-button"><FileUp size={17} /> 대화 파일 가져오기<input type="file" accept=".txt,text/plain" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }} disabled={busy} /></label><button className="outline" onClick={() => void run(async () => { await downloadExcel(data); setMessage('엑셀 파일을 저장했습니다.') })} disabled={busy}><Download size={17} /> 엑셀 내보내기</button></div></header>
    {message && <div className="notice" role="status">{message}<button onClick={() => setMessage('')}>닫기</button></div>}
    <section className="intro"><div><span className="intro-label">28 DAYS OF GROWTH</span><h2>하루하루, 다시 시작하는 힘</h2><p>말씀과 운동을 각각 확인하세요. 오전 4시 전 게시물은 전날로 묶이며, 날짜는 언제든 바꿀 수 있습니다.</p></div><div className="intro-number"><strong>{data.participants.filter(p => p.active).length}</strong><span>함께하는 사람</span></div></section>
    {unresolved.length > 0 && <section className="unresolved"><h3>이름 확인 필요 <b>{unresolved.length}</b></h3><p>기존 학생·교사 명단에서 사람을 선택하면 같은 톡방의 이전 게시물도 함께 연결됩니다.</p>{unresolved.map(({ room, sender }) => { const id = `${room}\u001f${sender}`; return <div className="alias-row" key={id}><strong>{sender}<small>{room}</small></strong><select value={aliasChoice[id] ?? ''} onChange={e => setAliasChoice({ ...aliasChoice, [id]: e.target.value })}><option value="">명단에서 선택</option>{data.catalog.map(p => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name} · {p.kind === 'student' ? '학생' : '교사'}</option>)}</select><button onClick={() => void link(sender, room)} disabled={!aliasChoice[id] || busy}>연결</button></div> })}</section>}
    {view === 'today' && <><section className="date-panel"><button aria-label="이전 날짜" disabled={dayIndex === 0} onClick={() => setDay(dates[dayIndex - 1])}><ChevronLeft /></button><div><span>DAY {dayIndex + 1} / 28</span><strong>{dateLabel(day)}</strong></div><button aria-label="다음 날짜" disabled={dayIndex === 27} onClick={() => setDay(dates[dayIndex + 1])}><ChevronRight /></button><input aria-label="날짜 선택" type="date" min={dates[0]} max={dates[27]} value={day} onChange={e => { if (dates.includes(e.target.value)) setDay(e.target.value) }} /></section><section className="stat-grid"><div className="stat complete"><span>완료</span><strong>{totals.complete}</strong></div><div className="stat partial"><span>일부 완료</span><strong>{totals.partial}</strong></div><div className="stat review"><span>확인 필요</span><strong>{totals.review}</strong></div><div className="stat unposted"><span>{statusLabel('unposted', day)}</span><strong>{totals.unposted}</strong></div></section><div className="section-head"><div><h2>참가자 체크</h2><p>사진·동영상 표시만으로 완료 처리하지 않습니다.</p></div><div className="filters"><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">전체</option><option value="student">학생</option><option value="teacher">교사</option></select><input placeholder="이름 검색" value={query} onChange={e => setQuery(e.target.value)} /></div></div><section className="people-grid">{people.map(p => { const c = findCheck(data, p.id, day); const count = countFor(data, p.id, day); const state = status(c, count); return <article className="person-card" key={p.id}><div className="person-top"><div className="avatar">{p.name[0]}</div><div><h3>{p.name}</h3><span>{p.kind === 'student' ? '학생' : '교사'} · 게시물 {count}건</span></div><b className={`badge ${state}`}>{statusLabel(state, day)}</b></div><div className="check-row"><button className={c?.qtDone ? 'checked' : ''} disabled={busy} onClick={() => void updateCheck(p, { qtDone: !c?.qtDone })}><Check size={16} /> 말씀 {c?.qtDone ? '완료' : '확인'}</button><button className={c?.exerciseDone ? 'checked' : ''} disabled={busy} onClick={() => void updateCheck(p, { exerciseDone: !c?.exerciseDone })}><Check size={16} /> 운동 {c?.exerciseDone ? '완료' : '확인'}</button></div><input className="note" key={`${p.id}:${day}:${c?.updatedAt ?? ''}`} defaultValue={c?.note ?? ''} placeholder="관리자 메모 (입력 후 포커스 이동으로 저장)" onBlur={e => { if (e.target.value !== (c?.note ?? '')) void updateCheck(p, { note: e.target.value }) }} /></article> })}</section></>}
    {view === 'people' && <><div className="section-head"><div><h2>28일 전체 현황</h2><p>이름을 눌러 날짜별 상태를 확인하고 수정할 수 있습니다.</p></div><div className="filters"><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">전체</option><option value="student">학생만</option><option value="teacher">교사만</option></select><input placeholder="이름 검색" value={query} onChange={e => setQuery(e.target.value)} /></div></div><section className="progress-list">{people.map(p => { const completed = dates.filter(d => { const c = findCheck(data, p.id, d); return c?.qtDone && c.exerciseDone }).length; return <article key={p.id}><div className="progress-person"><strong>{p.name}</strong><small>{p.kind === 'student' ? '학생' : '교사'}</small><b>{completed} / 28일</b></div><div className="progress-track"><div style={{ width: `${completed / 28 * 100}%` }} /></div><div className="day-dots">{dates.map((d, i) => <button key={d} title={`${dateLabel(d)} · ${statusLabel(status(findCheck(data, p.id, d), countFor(data, p.id, d)), d)}`} className={status(findCheck(data, p.id, d), countFor(data, p.id, d))} onClick={() => { setDay(d); setView('today') }}>{i + 1}</button>)}</div></article> })}</section></>}
    {view === 'evidence' && <>
      <div className="section-head"><div><h2>가져온 게시물</h2><p>이름 연결과 적용 날짜를 직접 수정할 수 있습니다.</p></div><button className="outline" onClick={() => void run(load)}><RefreshCw size={16} /> 새로고침</button></div>
      <section className="evidence-list">{[...data.messages].reverse().map(m => {
        const linked = data.participants.find(p => p.id === m.participantId)
        return <article key={m.fingerprint}>
          <div className="evidence-icon">{mediaLabels[m.mediaKind]}</div>
          <div className="evidence-main"><strong>{linked?.name ?? m.sender}</strong><span>{displayTime(m.sentAt)} · {m.room} · 원래 표시명 {m.sender}</span><p>{m.excerpt}</p></div>
          <select aria-label={`${m.sender} 이름 연결`} value={linked ? `${linked.kind}:${linked.sourceId}` : ''} disabled={busy} onChange={e => { const [kind, sourceId] = e.target.value.split(':') as [CatalogPerson['kind'], string]; void run(async () => { await api.linkAlias(m.sender, m.room, kind, sourceId); await load() }) }}><option value="">이름 확인 필요</option>{data.catalog.map(p => <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.name} · {p.kind === 'student' ? '학생' : '교사'}</option>)}</select>
          <select aria-label={`${m.sender} 게시물 적용 날짜`} value={m.assignedDate} disabled={busy} onChange={e => void run(async () => { await api.moveMessage(m.fingerprint, e.target.value); await load() })}>{dates.map(d => <option key={d} value={d}>{dateLabel(d)}</option>)}</select>
        </article>
      })}</section>
    </>}
    <footer>새벽이슬 청소년부 · 다윗 프로젝트 시즌 2 <span>카카오톡 첨부 파일의 실제 내용은 이 앱으로 전송되지 않습니다.</span></footer></main></div>
}

