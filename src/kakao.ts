import type { Evidence, MediaKind } from './model'

export type ParsedMessage = Omit<Evidence, 'fingerprint' | 'participantId'> & { fingerprint?: string }

function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function parseKakao(content: string): ParsedMessage[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const room = (lines[0] ?? '').replace(/ 님과 카카오톡 대화$/, '').trim().slice(0, 80) || '카카오톡 대화'
  const result: ParsedMessage[] = []
  let currentDate = ''
  for (const line of lines) {
    const dateLine = line.match(/^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일[^-]*-+$/)
    if (dateLine) {
      currentDate = `${dateLine[1]}-${dateLine[2].padStart(2, '0')}-${dateLine[3].padStart(2, '0')}`
      continue
    }
    const msg = line.match(/^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.*)$/)
    if (msg && currentDate) {
      const hour = Number(msg[3]) % 12 + (msg[2] === '오후' ? 12 : 0)
      const minute = Number(msg[4])
      const sentAt = `${currentDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`
      result.push({ room, sender: msg[1].trim(), sentAt, assignedDate: hour < 4 ? previousDate(currentDate) : currentDate, mediaKind: 'text', excerpt: msg[5] })
    } else if (result.length && currentDate && line && !line.startsWith('저장한 날짜') && !/님이 .*(초대했습니다|되었어요|되었습니다|나갔습니다)/.test(line)) {
      const last = result[result.length - 1]
      if (!line.startsWith('-')) last.excerpt += `\n${line}`
    }
  }
  return result.map(item => {
    const text = item.excerpt.trim()
    const mediaKind: MediaKind = /^사진(?: \d+장)?$/.test(text) ? 'photo' : /^동영상(?: \d+개)?$/.test(text) ? 'video' : 'text'
    return { ...item, mediaKind, excerpt: text }
  })
}

export async function fingerprintMessages(messages: ParsedMessage[]): Promise<Evidence[]> {
  const repetitions = new Map<string, number>()
  const encoder = new TextEncoder()
  return Promise.all(messages.map(async message => {
    const base = `${message.room}\u001f${message.sender}\u001f${message.sentAt}\u001f${message.mediaKind}\u001f${message.excerpt}`
    const occurrence = repetitions.get(base) ?? 0
    repetitions.set(base, occurrence + 1)
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(`${base}\u001f${occurrence}`))
    const fingerprint = Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, '0')).join('')
    return { ...message, excerpt: message.excerpt.slice(0, 180), fingerprint, participantId: null }
  }))
}
