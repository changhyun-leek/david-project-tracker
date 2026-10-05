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
    checked(admin.from('david_aliases').select('alias,participant_id')),
    checked(admin.from('david_messages').select('fingerprint,room,sender,sent_at,assigned_date,media_kind,excerpt,participant_id').order('sent_at')),
    checked(admin.from('david_checks').select('participant_id,day,qt_done,exercise_done,note,updated_at')),
    checked(admin.from('students').select('id,display_name').order('display_name')),
    checked(admin.from('profiles').select('id,display_name,active').eq('active', true).order('display_name')),
  ])
  return {
    participants: (people as any[]).map(p => ({ id: p.id, kind: p.kind, sourceId: p.source_id, name: p.display_name, active: p.active })),
    aliases: (aliases as any[]).map(a => ({ alias: a.alias, participantId: a.participant_id })),
    messages: (messages as any[]).map(m => ({ fingerprint: m.fingerprint.trim(), room: m.room, sender: m.sender, sentAt: m.sent_at, assignedDate: m.assigned_date, mediaKind: m.media_kind, excerpt: m.excerpt, participantId: m.participant_id })),
    checks: (checks as any[]).map(c => ({ participantId: c.participant_id, date: c.day, qtDone: c.qt_done, exerciseDone: c.exercise_done, note: c.note, updatedAt: c.updated_at })),
    catalog: [...(students as any[]).map(s => ({ id: s.id, name: s.display_name, kind: 'student' })), ...(teachers as any[]).map(t => ({ id: t.id, name: t.display_name, kind: 'teacher' }))],
  }
}
async function importMessages(body: Body) {
  if (!Array.isArray(body.messages) || body.messages.length > 500) throw new Error('한 번에 500건 이하만 가져올 수 있습니다.')
  const aliases = await checked(admin.from('david_aliases').select('alias,participant_id')) as any[]
  const map = new Map(aliases.map(a => [a.alias, a.participant_id]))
  const rows = body.messages.map((m: any) => {
    if (!m || typeof m.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(m.fingerprint) || !validDay(m.assignedDate) || !exactString(m.room, 80) || !exactString(m.sender, 60) || !['photo', 'video', 'text'].includes(m.mediaKind) || typeof m.excerpt !== 'string' || m.excerpt.length > 180 || Number.isNaN(Date.parse(m.sentAt))) throw new Error('대화 파일 형식이 올바르지 않습니다.')
    return { fingerprint: m.fingerprint, room: m.room, sender: m.sender, sent_at: m.sentAt, assigned_date: m.assignedDate, media_kind: m.mediaKind, excerpt: m.excerpt, participant_id: map.get(m.sender) ?? null }
  })
  if (rows.length) await checked(admin.from('david_messages').upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: true }))
  return { received: rows.length }
}
async function saveCheck(body: Body) {
  if (!uuid(body.participantId) || !validDay(body.date) || typeof body.qtDone !== 'boolean' || typeof body.exerciseDone !== 'boolean' || typeof body.note !== 'string' || body.note.length > 300) throw new Error('확인 값이 올바르지 않습니다.')
  const { data: person } = await admin.from('david_participants').select('id').eq('id', body.participantId).single()
  if (!person) throw new Error('참가자를 찾을 수 없습니다.')
  await checked(admin.from('david_checks').upsert({ participant_id: body.participantId, day: body.date, qt_done: body.qtDone, exercise_done: body.exerciseDone, note: body.note, updated_by: managerId, updated_at: new Date().toISOString() }, { onConflict: 'participant_id,day' }))
  return { ok: true }
}
async function linkAlias(body: Body) {
  if (!exactString(body.alias, 60) || !uuid(body.sourceId) || !['student', 'teacher'].includes(String(body.kind))) throw new Error('이름 연결 값이 올바르지 않습니다.')
  const table = body.kind === 'student' ? 'students' : 'profiles'
  const { data: source } = await admin.from(table).select('id,display_name').eq('id', body.sourceId).single()
  if (!source) throw new Error('기존 명단에서 해당 인원을 찾지 못했습니다.')
  const participant = await checked(admin.from('david_participants').upsert({ kind: body.kind, source_id: source.id, display_name: source.display_name }, { onConflict: 'kind,source_id' }).select('id').single()) as any
  await checked(admin.from('david_aliases').upsert({ alias: body.alias, participant_id: participant.id }, { onConflict: 'alias' }))
  await checked(admin.from('david_messages').update({ participant_id: participant.id }).eq('sender', body.alias))
  return { ok: true }
}
async function moveMessage(body: Body) {
  if (typeof body.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(body.fingerprint) || !validDay(body.date)) throw new Error('인증 날짜가 올바르지 않습니다.')
  await checked(admin.from('david_messages').update({ assigned_date: body.date }).eq('fingerprint', body.fingerprint))
  return { ok: true }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req.headers.get('origin')) })
  if (req.method !== 'POST') return send(req, { error: 'POST 요청만 허용됩니다.' }, 405)
  try {
    await authorized(req)
    const body = await req.json() as Body
    const action = String(body.action ?? '')
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
