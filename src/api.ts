import { createClient, FunctionsHttpError } from '@supabase/supabase-js'
import type { Dashboard, DailyCheck, Evidence, Kind } from './model'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://zzavmguguvuqgdblmkcj.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_VY0sNxSFQgHMSItmR5q5pw_4tpdrxWb'
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
const MANAGER_ID = '20df9d65-c162-414a-b4a9-60baadcfac5a'

async function invoke<T>(fn: string, action: string, rest: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: { action, ...rest } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.error ?? error.message)
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export const api = {
  async login(pin: string): Promise<void> {
    const result = await invoke<{ accessToken: string; refreshToken: string }>('crew-api', 'teacher-login', { teacherId: MANAGER_ID, pin })
    const { error } = await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken })
    if (error) throw error
  },
  async hasSession(): Promise<boolean> { return Boolean((await supabase.auth.getSession()).data.session) },
  async logout(): Promise<void> { await supabase.auth.signOut() },
  dashboard(): Promise<Dashboard> { return invoke('david-tracker', 'dashboard') },
  import(messages: Evidence[]): Promise<{ received: number }> { return invoke('david-tracker', 'import', { messages }) },
  saveCheck(check: DailyCheck): Promise<{ ok: true }> { return invoke('david-tracker', 'save-check', check) },
  linkAlias(alias: string, room: string, kind: Kind, sourceId: string): Promise<{ ok: true }> { return invoke('david-tracker', 'link-alias', { alias, room, kind, sourceId }) },
  moveMessage(fingerprint: string, date: string): Promise<{ ok: true }> { return invoke('david-tracker', 'move-message', { fingerprint, date }) },
}
