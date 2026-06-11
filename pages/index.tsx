import { useState, useCallback, useRef, Fragment } from 'react'
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

const STEPS = ['Upload', 'Compose', 'Preview', 'Send'] as const

export default function Home() {
  const [step, setStep] = useState<Step>(0)
  const [rows, setRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [subject, setSubject] = useState('Registration Confirmation 2013 National Compendium Launch')
  const [body, setBody] = useState('Dear **{{name}}**,\n\nThank you for your successful registration: **The Launch of National Compendium: "Nigeria: Documenting the Economic and Tourism Profiles of 36 States and FCT"**\n\n**Category:** {{category}}\n**Organisation:** {{organisation}}\n\nRegards,\n08037041001 and 08033497750')
  const [senderName, setSenderName] = useState('')
  const [secret, setSecret] = useState('')
  const [attachCard, setAttachCard] = useState(false)
  const [cardNameField, setCardNameField] = useState('name')
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
      const payload: SendPayload = { to, row, subject, body, senderName, secret, attachCard, cardNameField }
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

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-brand">
            <div className="logo-pill">
              <Image
                src="/gotref-logo.png"
                alt="Gotref Technologies"
                width={100}
                height={32}
                style={{ objectFit: 'contain', display: 'block' }}
                priority
              />
            </div>
            <div className="header-divider" />
            <span className="product-name">MailDispatch</span>
            <span className="smtp-badge">Zoho SMTP</span>
          </div>
          <p className="header-tagline">CSV · personalise · send</p>
        </div>
      </header>

      {/* ─── Body ───────────────────────────────────────────────────────── */}
      <div className="app-body">

        {/* Sidebar logo */}
        <aside className="app-sidebar" aria-hidden="true">
          <Image
            src="/maildispatch.png"
            alt="MailDispatch"
            width={240}
            height={300}
            style={{ width: '100%', maxWidth: 240, height: 'auto', objectFit: 'contain' }}
          />
        </aside>

        {/* Main content */}
        <main className="page">

        {/* Step navigator */}
        <nav className="step-nav" aria-label="Workflow steps">
          {STEPS.map((s, i) => (
            <Fragment key={s}>
              <button
                onClick={() => setStep(i as Step)}
                className={`step-item${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="step-circle">
                  {i < step ? (
                    <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden>
                      <path d="M1 5l3.5 3.5L12 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : i + 1}
                </span>
                <span className="step-label">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`step-connector${i < step ? ' filled' : ''}`} />
              )}
            </Fragment>
          ))}
        </nav>

        {/* ── Step 0: Upload ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div
              {...getRootProps()}
              className={`dropzone${isDragActive ? ' drag-active' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="dropzone-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="dropzone-title">
                {isDragActive ? 'Drop to import' : 'Drop your CSV or click to browse'}
              </p>
              <p className="dropzone-hint">
                Required column: <code>email</code> &nbsp;·&nbsp; Any other column becomes a merge tag
              </p>
            </div>

            <button onClick={() => loadCSV(SAMPLE_CSV)} className="btn btn-sm">
              Load sample data
            </button>

            {rows.length > 0 && (
              <div style={{ marginTop: '1.75rem' }}>
                <div className="upload-meta">
                  <span className="chip chip-accent">{rows.length} contacts</span>
                  <span className="upload-meta-cols">{headers.join(', ')}</span>
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {headers.map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 4).map((r, i) => (
                        <tr key={i}>
                          {headers.map(h => <td key={h}>{r[h] || ''}</td>)}
                        </tr>
                      ))}
                      {rows.length > 4 && (
                        <tr>
                          <td colSpan={headers.length} className="table-more">
                            and {rows.length - 4} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="step-footer">
                  <span />
                  <button onClick={() => setStep(1)} className="btn btn-primary">
                    Compose
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Compose ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="section-stack">
            <div className="card">
              <label className="field-label">Sender display name</label>
              <input
                type="text"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                placeholder="Mike Atolagbe"
              />
              <p className="field-hint">
                Zoho address is set in <code>.env</code> as{' '}
                <code className="hl">ZOHO_USER</code>
              </p>
            </div>

            <div className="card">
              <p className="field-label">Merge tags — click to insert</p>
              <div className="tag-list" style={{ marginBottom: '1.25rem' }}>
                {headers.map(h => (
                  <button
                    key={h}
                    onClick={() => insertAtCursor(bodyRef, `{{${h}}}`, body, setBody)}
                    className="merge-tag"
                  >
                    {`{{${h}}}`}
                  </button>
                ))}
              </div>

              <div className="field-gap">
                <label className="field-label">Subject line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Hi {{name}}, something for you"
                />
              </div>

              <div>
                <label className="field-label">Email body</label>
                <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} />
              </div>
            </div>

            <div className="card">
              <p className="card-title">Invitation Card</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={attachCard}
                  onChange={e => setAttachCard(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span className="field-label" style={{ margin: 0 }}>
                  Attach personalised invitation card to each email
                </span>
              </label>

              {attachCard && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="field-label">Column to print on card</label>
                    <select value={cardNameField} onChange={e => setCardNameField(e.target.value)}>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <p className="field-hint">
                      The value from this column is printed onto the card for each recipient.
                    </p>
                  </div>
                  <p className="field-hint" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.8rem' }}>
                    Place your card image at <code>/public/invitation-card.png</code> in the project folder.
                    The name is overlaid at the centre of the card — adjust coordinates in{' '}
                    <code>lib/card-generator.ts</code> if needed.
                  </p>
                </div>
              )}
            </div>

            <div className="step-footer">
              <button onClick={() => setStep(0)} className="btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Upload
              </button>
              <button onClick={() => { setPi(0); setStep(2) }} className="btn btn-primary">
                Preview
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ────────────────────────────────────────────── */}
        {step === 2 && rows.length > 0 && (
          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="preview-nav">
                <button
                  onClick={() => setPi(p => Math.max(0, p - 1))}
                  disabled={pi === 0}
                  className="btn btn-sm"
                  aria-label="Previous contact"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className="preview-counter">{pi + 1} / {rows.length}</span>
                <button
                  onClick={() => setPi(p => Math.min(rows.length - 1, p + 1))}
                  disabled={pi === rows.length - 1}
                  className="btn btn-sm"
                  aria-label="Next contact"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <span style={{ flex: 1 }} />
                <span className="chip chip-accent">{rows.length} emails ready</span>
              </div>

              <div className="email-preview">
                <div className="email-meta">
                  <div className="email-meta-row">
                    <span className="email-meta-key">To</span>
                    <span className="email-meta-val">{rows[pi].email || rows[pi].Email || '(no email)'}</span>
                  </div>
                </div>
                <div className="email-subject-line">
                  {merge(subject, rows[pi])}
                </div>
                <div className="email-body">
                  {merge(body, rows[pi])}
                </div>
              </div>
            </div>

            {attachCard && rows[pi] && (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <p className="field-label" style={{ margin: 0 }}>Card preview</p>
                  <span className="chip chip-accent">
                    {rows[pi][cardNameField] || rows[pi].name || 'Guest'}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`card-${pi}-${cardNameField}`}
                  src={`/api/generate-card?name=${encodeURIComponent(rows[pi][cardNameField] || rows[pi].name || 'Guest')}`}
                  alt="Personalised invitation card preview"
                  style={{ maxWidth: '100%', display: 'block', borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </div>
            )}

            <div className="step-footer">
              <button onClick={() => setStep(1)} className="btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Edit
              </button>
              <button onClick={() => setStep(3)} className="btn btn-primary">
                Send {rows.length} emails
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Send ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="section-stack">

            {/* SMTP */}
            <div className="card">
              <p className="card-title">Connection</p>
              <div className="smtp-row">
                <span>Zoho SMTP</span>
                <span style={{ flex: 1 }} />
                {smtpStatus === 'ok' && <span className="chip chip-accent">Connected</span>}
                {smtpStatus === 'fail' && <span className="chip chip-danger">Failed</span>}
                <button onClick={verifySmtp} className="btn btn-sm">Test</button>
              </div>
            </div>

            {/* Secret */}
            <div className="card">
              <label className="field-label">App secret</label>
              <input
                type="password"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Leave blank if APP_SECRET is not set"
              />
            </div>

            {/* Delay */}
            <div className="card">
              <label className="field-label">Send rate</label>
              <select
                value={delay}
                onChange={e => setDelay(Number(e.target.value))}
              >
                <option value={2000}>2 seconds between emails — small lists (under 30)</option>
                <option value={3000}>3 seconds between emails — medium lists (30–80)</option>
                <option value={5000}>5 seconds between emails — large lists (80–150)</option>
                <option value={8000}>8 seconds between emails — very large lists (150+)</option>
              </select>
              <p className="field-hint">Slower = fewer failures. 200 emails at 5s takes ~17 minutes.</p>
            </div>

            {/* Stats */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{rows.length}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: ok > 0 ? 'var(--accent)' : undefined }}>{ok}</div>
                <div className="stat-label">Sent</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: err > 0 ? 'var(--danger)' : undefined }}>{err}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>

            {/* Progress */}
            {log.length > 0 && (
              <div className="progress-wrap">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="progress-label">{pct}% &mdash; {log.length} of {rows.length}</p>
              </div>
            )}

            {/* Log */}
            {log.length > 0 && (
              <div className="log-scroll">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...log].reverse().map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.to}</td>
                        <td style={{ color: 'var(--ink-muted)' }}>{l.name || '—'}</td>
                        <td>
                          <span className={`chip ${l.ok ? 'chip-accent' : 'chip-danger'}`}>
                            {l.ok ? 'Sent' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="step-footer">
              <button onClick={() => setStep(2)} className="btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Preview
              </button>
              <div className="step-footer-end">
                {log.length > 0 && (
                  <button onClick={exportLog} className="btn btn-sm">
                    Export log
                  </button>
                )}
                {ok > 0 && !sending && (
                  <button onClick={resetLog} className="btn btn-sm btn-danger">
                    Start fresh
                  </button>
                )}
                {sending && (
                  <button onClick={cancelSend} className="btn btn-sm btn-danger">
                    Cancel
                  </button>
                )}
                <button
                  onClick={sendAll}
                  disabled={sending || !rows.length}
                  className="btn btn-primary"
                >
                  {sending
                    ? 'Sending…'
                    : ok > 0
                    ? `Resume (${rows.length - ok} remaining)`
                    : `Send ${rows.length} emails`}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>
    </>
  )
}
