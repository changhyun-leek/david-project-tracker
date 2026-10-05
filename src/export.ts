import { zipSync, strToU8 } from 'fflate'
import type { Dashboard } from './model'
import { dates, status, statusLabel } from './model'

type Cell = string | number
type Sheet = { name: string; rows: Cell[][] }
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
function column(index: number): string { let result = ''; for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result; return result }
function sheetXml(rows: Cell[][]): string {
  const body = rows.map((row, y) => `<row r="${y + 1}">${row.map((value, x) => {
    const address = `${column(x + 1)}${y + 1}`
    return typeof value === 'number' ? `<c r="${address}"><v>${value}</v></c>` : `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`
  }).join('')}</row>`).join('')
  const last = `${column(Math.max(1, rows[0]?.length ?? 1))}${Math.max(1, rows.length)}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
}
export function workbookBytes(sheets: Sheet[]): Uint8Array {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes), '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook), 'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
  }
  sheets.forEach((sheet, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet.rows)) })
  return zipSync(files, { level: 6 })
}

export function buildWorkbook(data: Dashboard): Uint8Array {
  const summary: Cell[][] = [['이름', '구분', '완료일', '말씀 확인일', '운동 확인일', '게시일', '완료율(%)']]
  const daily: Cell[][] = [['날짜', '이름', '구분', '상태', '말씀 확인', '운동 확인', '게시물 수', '관리자 메모', '마지막 수정']]
  const evidence: Cell[][] = [['적용 날짜', '게시 시각', '이름', '톡방', '종류', '표시 내용', '연결 상태']]
  for (const p of data.participants.filter(p => p.active)) {
    let completed = 0, qt = 0, exercise = 0, posted = 0
    for (const date of dates) {
      const check = data.checks.find(c => c.participantId === p.id && c.date === date)
      const count = data.messages.filter(m => m.participantId === p.id && m.assignedDate === date).length
      if (check?.qtDone && check.exerciseDone) completed++
      if (check?.qtDone) qt++
      if (check?.exerciseDone) exercise++
      if (count) posted++
      const state = status(check, count)
      daily.push([date, p.name, p.kind === 'student' ? '학생' : '교사', statusLabel(state, date), check?.qtDone ? '예' : '아니요', check?.exerciseDone ? '예' : '아니요', count, check?.note ?? '', check?.updatedAt ?? ''])
    }
    summary.push([p.name, p.kind === 'student' ? '학생' : '교사', completed, qt, exercise, posted, Math.round(completed / 28 * 1000) / 10])
  }
  for (const m of data.messages) {
    const person = data.participants.find(p => p.id === m.participantId)
    evidence.push([m.assignedDate, m.sentAt, person?.name ?? m.sender, m.room, { photo: '사진 표시', video: '동영상 표시', text: '텍스트' }[m.mediaKind], m.excerpt, person ? '연결됨' : '이름 확인 필요'])
  }
  return workbookBytes([{ name: '참가자 요약', rows: summary }, { name: '28일 기록', rows: daily }, { name: '게시물 확인 내역', rows: evidence }])
}

export async function downloadExcel(data: Dashboard): Promise<void> {
  const bytes = buildWorkbook(data)
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '다윗프로젝트_28일_진행현황.xlsx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
}
