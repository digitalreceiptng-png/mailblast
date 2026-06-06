import { useState, useCallback, useRef } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Papa from 'papaparse'
import { useDropzone } from 'react-dropzone'
import type { SendPayload, SendResult } from './api/send'

type Row = Record<string, string>
type LogEntry = SendResult & { name?: string }
type Step = 0 | 1 | 2 | 3

const SAMPLE_CSV = `name,email,category,organisation
Michael Egboh,michael@example.com,Investor,Capital Science Academy
Adaeze Obi,adaeze@example.com,Speaker,TechLagos
Emeka Nwosu,emeka@example.com,Exhibitor,Finreach
Blessing Adekunle,blessing@example.com,Delegate,GrowthCo`

function merge(t: string, r: Row) {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => r[k] ?? `{{${k}}}`)
}

function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement>,
  tag: string,
  val: string,
  setVal: (v: string) => void
) {
  const el = ref.current
  if (!el) return
  const s = el.selectionStart, e = el.selectionEnd
  const next = val.slice(0, s) + tag + val.slice(e)
  setVal(next)
  setTimeout(() => { el.selectionStart = el.selectionEnd = s + tag.length; el.focus() }, 0)
}

export default function Home() {
  const [step, setStep] = useState<Step>(0)
  const [rows, setRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [subject, setSubject] = useState('Registration Confirmation 2013 National Compendium Launch')
  const [body, setBody] = useState('Dear **{{name}}**,\n\nThank you for your successful registration: **The Launch of National Compendium: "Nigeria: Documenting the Economic and Tourism Profiles of 36 States and FCT"**\n\n**Category:** {{category}}\n**Organisation:** {{organisation}}\n\nRegards,\n08037041001 and 08033497750')
  const [senderName, setSenderName] = useState('')
  const [secret, setSecret] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [sending, setSending] = useState(false)
  const [pi, setPi] = useState(0)
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [delay, setDelay] = useState(3000)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const cancelRef = useRef(false)

  const loadCSV = (text: string) => {
    Papa.parse<Row>(text, {
      header: true,
      skipEmptyLines: true,
      complete(r) {
        setRows(r.data)
        setHeaders(r.meta.fields ?? [])
      },
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    onDrop: useCallback((files: File[]) => {
      const f = files[0]
      if (!f) return
      const reader = new FileReader()
      reader.onload = (e) => loadCSV(e.target?.result as string)
      reader.readAsText(f)
    }, []),
  })

  const verifySmtp = async () => {
    setSmtpStatus('idle')
    const r = await fetch('/api/verify')
    setSmtpStatus(r.ok ? 'ok' : 'fail')
  }

  const cancelSend = () => { cancelRef.current = true }

  const resetLog = () => setLog([])

  const sendAll = async () => {
    if (sending || !rows.length) return
    cancelRef.current = false
    setSending(true)

    // Build set of already-successfully-sent emails from current log
    const alreadySent = new Set(log.filter(l => l.ok).map(l => l.to))
    const remaining = rows.filter(r => {
      const to = r.email || r.Email || r.EMAIL || ''
      return to && !alreadySent.has(to)
    })

    let sent = 0
    for (const row of remaining) {
      if (cancelRef.current) break
      const to = row.email || row.Email || row.EMAIL || ''
      if (!to) {
        setLog(l => [...l, { ok: false, to: '(missing email)', name: row.name || '' }])
        continue
      }
      const payload: SendPayload = { to, row, subject, body, senderName, secret }
      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data: SendResult = await res.json()
        setLog(l => [...l, { ...data, name: row.name || '' }])
      } catch {
        setLog(l => [...l, { ok: false, to, name: row.name || '', error: 'Network error' }])
      }
      sent++
      if (cancelRef.current) break
      await new Promise(r => setTimeout(r, delay))
      // Extra 15 second pause every 10 emails to avoid Zoho rate limiting
      if (sent % 10 === 0 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 15000))
      }
    }
    setSending(false)
  }

  const exportLog = () => {
    const csv = [
      ['email', 'name', 'status', 'error'],
      ...log.map(l => [l.to, l.name || '', l.ok ? 'sent' : 'failed', l.error || '']),
    ].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'send_log.csv'
    a.click()
  }

  const ok = log.filter(l => l.ok).length
  const err = log.filter(l => !l.ok).length
  const pct = rows.length ? Math.round((log.length / rows.length) * 100) : 0

  return (
    <>
      <Head>
        <title>MailDispatch</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 1.25rem 4rem' }}>

        {/* Banner */}
        <div style={{ margin: '0 -1.25rem 2rem', position: 'relative', width: 'calc(100% + 2.5rem)' }}>
          <Image
            src="/banner.png"
            alt="MailDispatch banner"
            width={1500}
            height={600}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            priority
          />
        </div>

        {/* Logo + name */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Image src="/gotref-logo.png" alt="Gotref Technologies" width={120} height={40} style={{ objectFit: 'contain' }} />
            <div style={{ width: 1, height: 28, background: 'var(--border2)' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>MailDispatch</span>
                <span style={{ fontSize: 11, padding: '3px 8px', background: '#1a1a1a', color: '#FFC800', border: '1px solid rgba(255,200,0,0.3)', borderRadius: 20, fontFamily: 'var(--mono)' }}>zoho smtp</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>Upload a CSV · personalise each email · send via Zoho Mail</p>
            </div>
          </div>
        </div>

        {/* Step nav */}
        <div style={{ display: 'flex', gap: 0, marginBottom: '2rem', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {(['Upload', 'Compose', 'Preview', 'Send'] as const).map((s, i) => (
            <button key={s} onClick={() => setStep(i as Step)} style={{
              flex: 1, padding: '10px 4px', fontSize: 13, fontFamily: 'var(--sans)',
              background: i === step ? 'var(--surface2)' : 'var(--surface)',
              color: i === step ? 'var(--text)' : i < step ? 'var(--accent)' : 'var(--muted)',
              border: 'none', borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer', fontWeight: i === step ? 500 : 400,
            }}>
              {i < step ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>

        {/* Step 0 — Upload */}
        {step === 0 && (
          <div>
            <div {...getRootProps()} style={{
              border: `1.5px dashed ${isDragActive ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 'var(--radius-lg)', padding: '2.5rem 1rem', textAlign: 'center',
              cursor: 'pointer', background: isDragActive ? 'var(--accent-dim)' : 'var(--surface)',
              transition: 'all 0.15s', marginBottom: '1.25rem',
            }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
              <p style={{ fontSize: 14, marginBottom: 6 }}>Drop your CSV or click to browse</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Required column: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>email</code> · Any other column becomes a merge tag</p>
            </div>

            <button onClick={() => loadCSV(SAMPLE_CSV)} style={btnStyle}>Load sample data</button>

            {rows.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                  <Chip color="accent">{rows.length} contacts</Chip>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{headers.join(', ')}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>{headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 4).map((r, i) => (
                        <tr key={i}>{headers.map(h => <td key={h} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{r[h] || ''}</td>)}</tr>
                      ))}
                      {rows.length > 4 && <tr><td colSpan={headers.length} style={{ padding: '7px 10px', color: 'var(--muted)', fontStyle: 'italic' }}>…and {rows.length - 4} more rows</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                  <button onClick={() => setStep(1)} style={btnPrimaryStyle}>Next: Compose →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Compose */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Card>
              <Label>Sender display name</Label>
              <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Mike Atolagbe" />
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Zoho email address is set in your <code style={{ fontFamily: 'var(--mono)' }}>.env</code> file as <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>ZOHO_USER</code></p>
            </Card>

            <Card>
              <Label>Merge tags — click to insert into body</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '1.25rem' }}>
                {headers.map(h => (
                  <button key={h} onClick={() => insertAtCursor(bodyRef, `{{${h}}}`, body, setBody)}
                    style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', borderRadius: 20, cursor: 'pointer' }}>
                    {`{{${h}}}`}
                  </button>
                ))}
              </div>
              <Label>Subject line</Label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Hi {{name}}, something for you" style={{ marginBottom: '1rem' }} />
              <Label>Email body</Label>
              <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} />
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(0)} style={btnStyle}>← Back</button>
              <button onClick={() => { setPi(0); setStep(2) }} style={btnPrimaryStyle}>Preview →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Preview */}
        {step === 2 && rows.length > 0 && (
          <div>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                <button onClick={() => setPi(p => Math.max(0, p - 1))} disabled={pi === 0} style={btnStyle}>←</button>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{pi + 1} / {rows.length}</span>
                <button onClick={() => setPi(p => Math.min(rows.length - 1, p + 1))} disabled={pi === rows.length - 1} style={btnStyle}>→</button>
                <span style={{ flex: 1 }} />
                <Chip color="accent">{rows.length} emails ready</Chip>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  To: <strong style={{ color: 'var(--text)' }}>{rows[pi].email || rows[pi].Email || '(no email)'}</strong>
                </div>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>
                  Subject: {merge(subject, rows[pi])}
                </div>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 10 }} />
                <pre style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {merge(body, rows[pi])}
                </pre>
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(1)} style={btnStyle}>← Edit</button>
              <button onClick={() => setStep(3)} style={btnPrimaryStyle}>Send all {rows.length} →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Send */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* SMTP verify */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Zoho SMTP connection</span>
                <span style={{ flex: 1 }} />
                {smtpStatus === 'ok' && <Chip color="accent">Connected ✓</Chip>}
                {smtpStatus === 'fail' && <Chip color="danger">Failed ✗</Chip>}
                <button onClick={verifySmtp} style={btnStyle}>Test connection</button>
              </div>
            </Card>

            {/* Optional secret */}
            <Card>
              <Label>App secret (if you set APP_SECRET in .env)</Label>
              <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Leave blank if not set" />
            </Card>

            {/* Send delay */}
            <Card>
              <Label>Delay between emails (to avoid Zoho rate limiting)</Label>
              <select value={delay} onChange={e => setDelay(Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', fontSize: '14px', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', background: 'var(--surface2)', color: 'var(--text)' }}>
                <option value={2000}>2 seconds — small lists (under 30)</option>
                <option value={3000}>3 seconds — medium lists (30–80)</option>
                <option value={5000}>5 seconds — large lists (80–150)</option>
                <option value={8000}>8 seconds — very large lists (150+)</option>
              </select>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Slower = fewer failures. A batch of 200 at 5s takes ~17 minutes.</p>
            </Card>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <StatCard label="Total" value={rows.length} />
              <StatCard label="Sent" value={ok} color="var(--accent)" />
              <StatCard label="Failed" value={err} color="var(--danger)" />
            </div>

            {/* Progress */}
            {log.length > 0 && (
              <div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>{pct}% — {log.length} of {rows.length}</p>
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Email', 'Name', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: 'var(--muted)', borderBottom: '1px solid var(--border)', fontWeight: 500, position: 'sticky', top: 0, background: 'var(--surface)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...log].reverse().map((l, i) => (
                      <tr key={i}>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{l.to}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>{l.name || '—'}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
                          <Chip color={l.ok ? 'accent' : 'danger'}>{l.ok ? 'Sent' : 'Failed'}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep(2)} style={btnStyle}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {log.length > 0 && <button onClick={exportLog} style={btnStyle}>↓ Export log</button>}
                {ok > 0 && !sending && (
                  <button onClick={resetLog} style={{ ...btnStyle, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    Start fresh
                  </button>
                )}
                {sending && (
                  <button onClick={cancelSend} style={{ ...btnStyle, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    Cancel
                  </button>
                )}
                <button onClick={sendAll} disabled={sending || !rows.length} style={btnPrimaryStyle}>
                  {sending ? 'Sending…' : ok > 0 ? `Resume (${rows.length - ok} remaining)` : `Send ${rows.length} emails`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Tiny Components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontFamily: 'var(--mono)' }}>{children}</p>
}

function Chip({ children, color }: { children: React.ReactNode; color: 'accent' | 'danger' }) {
  const c = color === 'accent'
    ? { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent-border)' }
    : { bg: 'var(--danger-dim)', text: 'var(--danger)', border: 'rgba(255,92,92,0.3)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 12, fontFamily: 'var(--mono)', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {children}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Button styles ──────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', fontSize: 13, fontFamily: 'var(--sans)',
  background: 'var(--surface)', border: '1px solid var(--border2)',
  borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer',
}

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: '#1a1a1a', border: '1px solid #1a1a1a',
  color: '#FFC800', fontWeight: 600,
}
