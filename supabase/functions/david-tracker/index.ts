import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const url = Deno.env.get('SUPABASE_URL')!
const key = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const managerId = '20df9d65-c162-414a-b4a9-60baadcfac5a'
const allowedOrigins = new Set(['https://changhyun-leek.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'])
type Body = Record<string, unknown>

function headers(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://changhyun-leek.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  }
}
function send(req: Request, value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: headers(req.headers.get('origin')) }) }
function validDay(value: unknown): value is string { return typeof value === 'string' && /^2026-10-(0[4-9]|[12][0-9]|3[01])$/.test(value) }
function uuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) }
function exactString(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
async function authorized(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('로그인이 필요합니다.')
  const { data: user, error } = await admin.auth.getUser(token)
  if (error || !user.user) throw new Error('로그인이 만료되었습니다.')
  const { data: profile } = await admin.from('profiles').select('id,active').eq('auth_user_id', user.user.id).single()
  if (!profile?.active || profile.id !== managerId) throw new Error('이 프로젝트의 관리자 계정만 사용할 수 있습니다.')
}
async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data
}

async function dashboard() {
  const [people, aliases, messages, checks, students, teachers] = await Promise.all([
    checked(admin.from('david_participants').select('id,kind,source_id,display_name,active').order('display_name')),
    checked(admin.from('david_aliases').select('room,alias,participant_id')),
    checked(admin.from('david_messages').select('fingerprint,room,sender,sent_at,assigned_date,media_kind,excerpt,participant_id').order('sent_at')),
    checked(admin.from('david_checks').select('participant_id,day,qt_done,exercise_done,confirmed,self_qt,self_exercise,note,updated_at')),
    checked(admin.from('students').select('id,display_name').order('display_name')),
    checked(admin.from('profiles').select('id,display_name,active').eq('active', true).order('display_name')),
  ])
  return {
    participants: (people as any[]).map(p => ({ id: p.id, kind: p.kind, sourceId: p.source_id, name: p.display_name, active: p.active })),
    aliases: (aliases as any[]).map(a => ({ room: a.room, alias: a.alias, participantId: a.participant_id })),
    messages: (messages as any[]).map(m => ({ fingerprint: m.fingerprint.trim(), room: m.room, sender: m.sender, sentAt: m.sent_at, assignedDate: m.assigned_date, mediaKind: m.media_kind, excerpt: m.excerpt, participantId: m.participant_id })),
    checks: (checks as any[]).map(c => ({ participantId: c.participant_id, date: c.day, qtDone: c.qt_done, exerciseDone: c.exercise_done, confirmed: c.confirmed, selfQt: c.self_qt, selfExercise: c.self_exercise, note: c.note, updatedAt: c.updated_at })),
    catalog: [...(students as any[]).map(s => ({ id: s.id, name: s.display_name, kind: 'student' })), ...(teachers as any[]).map(t => ({ id: t.id, name: t.display_name, kind: 'teacher' }))],
  }
}
async function importMessages(body: Body) {
  if (!Array.isArray(body.messages) || body.messages.length > 500) throw new Error('한 번에 500건 이하만 가져올 수 있습니다.')
  const aliases = await checked(admin.from('david_aliases').select('room,alias,participant_id')) as any[]
  const map = new Map(aliases.map(a => [`${a.room}\u001f${a.alias}`, a.participant_id]))
  const rows = body.messages.map((m: any) => {
    if (!m || typeof m.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(m.fingerprint) || !validDay(m.assignedDate) || !exactString(m.room, 80) || !exactString(m.sender, 60) || !['photo', 'video', 'text'].includes(m.mediaKind) || typeof m.excerpt !== 'string' || m.excerpt.length > 180 || Number.isNaN(Date.parse(m.sentAt))) throw new Error('대화 파일 형식이 올바르지 않습니다.')
    return { fingerprint: m.fingerprint, room: m.room, sender: m.sender, sent_at: m.sentAt, assigned_date: m.assignedDate, media_kind: m.mediaKind, excerpt: m.excerpt, participant_id: map.get(`${m.room}\u001f${m.sender}`) ?? map.get(`*\u001f${m.sender}`) ?? null }
  })
  if (rows.length) await checked(admin.from('david_messages').upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: true }))
  return { received: rows.length }
}
async function saveCheck(body: Body) {
  if (!uuid(body.participantId) || !validDay(body.date) || typeof body.qtDone !== 'boolean' || typeof body.exerciseDone !== 'boolean' || typeof body.confirmed !== 'boolean' || typeof body.note !== 'string' || body.note.length > 300) throw new Error('확인 값이 올바르지 않습니다.')
  const { data: person } = await admin.from('david_participants').select('id').eq('id', body.participantId).single()
  if (!person) throw new Error('참가자를 찾을 수 없습니다.')
  await checked(admin.from('david_checks').upsert({ participant_id: body.participantId, day: body.date, qt_done: body.qtDone, exercise_done: body.exerciseDone, confirmed: body.confirmed, note: body.note, updated_by: managerId, updated_at: new Date().toISOString() }, { onConflict: 'participant_id,day' }))
  return { ok: true }
}
async function linkAlias(body: Body) {
  if (!exactString(body.alias, 60) || !exactString(body.room, 80) || !uuid(body.sourceId) || !['student', 'teacher'].includes(String(body.kind))) throw new Error('이름 연결 값이 올바르지 않습니다.')
  const table = body.kind === 'student' ? 'students' : 'profiles'
  const { data: source } = await admin.from(table).select('id,display_name').eq('id', body.sourceId).single()
  if (!source) throw new Error('기존 명단에서 해당 인원을 찾지 못했습니다.')
  const participant = await checked(admin.from('david_participants').upsert({ kind: body.kind, source_id: source.id, display_name: source.display_name }, { onConflict: 'kind,source_id' }).select('id').single()) as any
  await checked(admin.from('david_aliases').upsert({ room: body.room, alias: body.alias, participant_id: participant.id }, { onConflict: 'room,alias' }))
  await checked(admin.from('david_messages').update({ participant_id: participant.id }).eq('room', body.room).eq('sender', body.alias))
  return { ok: true }
}
async function moveMessage(body: Body) {
  if (typeof body.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(body.fingerprint) || !validDay(body.date)) throw new Error('인증 날짜가 올바르지 않습니다.')
  await checked(admin.from('david_messages').update({ assigned_date: body.date }).eq('fingerprint', body.fingerprint))
  return { ok: true }
}

function kstProjectDay(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000 - 4 * 3600_000)
  return kst.toISOString().slice(0, 10)
}
function previousDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
// 참가자 화면은 로그인 없이 이름만으로 들어온다. 이름은 명단 이름이나 카카오톡 표시명과 정확히 같아야 한다.
async function findParticipant(body: Body) {
  const strip = (v: string) => v.replace(/\s+/g, '').replace(/\(.*?\)/g, '')
  const name = typeof body.name === 'string' ? strip(body.name).slice(0, 30) : ''
  if (name.length < 2) throw new Error('이름을 두 글자 이상 입력해 주세요.')
  const [people, aliases] = await Promise.all([
    checked(admin.from('david_participants').select('id,kind,display_name,active').eq('active', true)),
    checked(admin.from('david_aliases').select('alias,participant_id')),
  ]) as [any[], any[]]
  const ids = new Set<string>()
  for (const p of people) if (strip(p.display_name) === name) ids.add(p.id)
  if (!ids.size) for (const a of aliases) if (strip(a.alias) === name && people.some(p => p.id === a.participant_id)) ids.add(a.participant_id)
  if (ids.size !== 1) throw new Error(ids.size ? '같은 이름이 여러 명이에요. 성까지 붙여서 입력해 주세요.' : '명단에서 이름을 찾지 못했어요. 성까지 붙여서 입력해 보세요.')
  const id = [...ids][0]
  return { person: people.find(p => p.id === id), people }
}
async function memberView(body: Body) {
  const { person, people } = await findParticipant(body)
  const [checks, messages] = await Promise.all([
    checked(admin.from('david_checks').select('participant_id,day,qt_done,exercise_done,confirmed,self_qt,self_exercise')),
    checked(admin.from('david_messages').select('participant_id,assigned_date,media_kind').eq('participant_id', person.id)),
  ]) as [any[], any[]]
  // 순위에는 관리자가 확정한 말씀·운동만 센다.
  const board = people.map(p => {
    const mine = checks.filter(c => c.participant_id === p.id && c.confirmed)
    const qt = mine.filter(c => c.qt_done).length, exercise = mine.filter(c => c.exercise_done).length
    return { name: p.display_name, kind: p.kind, qt, exercise, total: qt + exercise, me: p.id === person.id }
  }).sort((a, b) => b.total - a.total || b.exercise - a.exercise || a.name.localeCompare(b.name, 'ko'))
  board.forEach((row: any, i) => { row.rank = i && board[i - 1].total === row.total ? (board[i - 1] as any).rank : i + 1 })
  const days = checks.filter(c => c.participant_id === person.id).map(c => ({ date: c.day, confirmed: c.confirmed, qtDone: c.qt_done, exerciseDone: c.exercise_done, selfQt: c.self_qt, selfExercise: c.self_exercise }))
  const posts = messages.map(m => ({ date: m.assigned_date, mediaKind: m.media_kind }))
  return { name: person.display_name, kind: person.kind, today: kstProjectDay(), days, posts, board }
}
async function memberCheck(body: Body) {
  const { person } = await findParticipant(body)
  const today = kstProjectDay()
  if (!validDay(body.date) || (body.date !== today && body.date !== previousDay(today))) throw new Error('오늘과 어제 기록만 직접 체크할 수 있어요.')
  if (typeof body.selfQt !== 'boolean' || typeof body.selfExercise !== 'boolean') throw new Error('체크 값이 올바르지 않습니다.')
  const { data: existing } = await admin.from('david_checks').select('confirmed').eq('participant_id', person.id).eq('day', body.date).maybeSingle()
  if (existing?.confirmed) throw new Error('이미 선생님이 확인한 날이에요.')
  const patch = { self_qt: body.selfQt, self_exercise: body.selfExercise, self_at: new Date().toISOString() }
  if (existing) await checked(admin.from('david_checks').update(patch).eq('participant_id', person.id).eq('day', body.date))
  else await checked(admin.from('david_checks').insert({ participant_id: person.id, day: body.date, confirmed: false, updated_by: managerId, ...patch }))
  return { ok: true }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req.headers.get('origin')) })
  if (req.method !== 'POST') return send(req, { error: 'POST 요청만 허용됩니다.' }, 405)
  try {
    const body = await req.json() as Body
    const action = String(body.action ?? '')
    if (action === 'member-view') return send(req, await memberView(body))
    if (action === 'member-check') return send(req, await memberCheck(body))
    await authorized(req)
    const result = action === 'dashboard' ? await dashboard()
      : action === 'import' ? await importMessages(body)
      : action === 'save-check' ? await saveCheck(body)
      : action === 'link-alias' ? await linkAlias(body)
      : action === 'move-message' ? await moveMessage(body)
      : null
    if (!result) return send(req, { error: '지원하지 않는 작업입니다.' }, 400)
    return send(req, result)
  } catch (error) {
    return send(req, { error: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.' }, 400)
  }
})
