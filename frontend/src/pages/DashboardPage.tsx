import { useEffect, useState } from 'react'
import { ApiError, disconnectSlack, getSenders, getSlackStatus, provisionSender } from '../api/client'
import { apiBase } from '../api/client'
import { ComposeModal } from '../components/ComposeModal'
import { Header } from '../components/Header'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, type Column } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/Toast'
import { useEmails } from '../hooks/useEmails'
import { formatWhen } from '../lib/format'
import type { EmailRecord, Sender, SlackStatus } from '../types'

export function DashboardPage() {
  const { push } = useToast()
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [senders, setSenders] = useState<Sender[]>([])
  const [slack, setSlack] = useState<SlackStatus>({ connected: false })
  const [provisioning, setProvisioning] = useState(false)
  const emails = useEmails(tab, debounced)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(search), 300)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    void getSenders()
      .then((result) => setSenders(result.data))
      .catch(() => setSenders([]))
    void getSlackStatus()
      .then(setSlack)
      .catch(() => setSlack({ connected: false }))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('slack') === 'connected') push('Slack connected')
    if (params.get('slack') === 'error') push('Slack connection failed', 'error')
    if (params.get('slack')) {
      window.history.replaceState({}, '', '/')
    }
  }, [push])

  async function addSender() {
    setProvisioning(true)
    try {
      const result = await provisionSender()
      setSenders((current) => [...current, ...result.data])
      push('Ethereal sender created')
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'Could not create a sender', 'error')
    } finally {
      setProvisioning(false)
    }
  }

  async function onDisconnect() {
    await disconnectSlack()
    setSlack({ connected: false })
    push('Slack disconnected')
  }

  const columns: Column<EmailRecord>[] =
    tab === 'scheduled'
      ? [
          { key: 'email', header: 'Email', render: (row) => row.toEmail },
          { key: 'subject', header: 'Subject', render: (row) => row.subject },
          { key: 'when', header: 'Scheduled time', render: (row) => formatWhen(row.scheduledAt) },
          { key: 'status', header: 'Status', render: (row) => <Badge status={row.status} /> },
        ]
      : [
          { key: 'email', header: 'Email', render: (row) => row.toEmail },
          { key: 'subject', header: 'Subject', render: (row) => row.subject },
          { key: 'when', header: 'Sent time', render: (row) => formatWhen(row.sentAt) },
          {
            key: 'status',
            header: 'Status',
            render: (row) => (
              <span className="inline-flex items-center gap-2">
                <Badge status={row.status} />
                {row.previewUrl ? (
                  <a className="text-xs font-semibold text-accent underline" href={row.previewUrl} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                ) : null}
              </span>
            ),
          },
        ]

  const pages = Math.max(1, Math.ceil(emails.total / emails.limit))

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Dashboard</p>
            <h1 className="mt-1 font-serif text-5xl">Mailbox queue</h1>
          </div>
          <Button onClick={() => setComposeOpen(true)}>Compose New Email</Button>
        </div>

        <section className="mt-6 grid gap-3 rounded-3xl border border-line bg-card p-4 shadow-card md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Senders</p>
            <p className="mt-1 text-sm text-mute">
              {senders.length === 0 ? 'Create an Ethereal inbox before scheduling.' : senders.map((sender) => sender.email).join(', ')}
            </p>
            <Button className="mt-3" variant="secondary" loading={provisioning} onClick={() => void addSender()}>
              Add Ethereal sender
            </Button>
          </div>
          <div>
            <p className="text-sm font-semibold">Slack</p>
            <p className="mt-1 text-sm text-mute">
              {slack.connected
                ? `Connected${slack.teamName ? ` to ${slack.teamName}` : ''}${slack.channelName ? ` · ${slack.channelName}` : ''}`
                : 'Not connected. Rate-limit alerts stay quiet until you connect.'}
            </p>
            {slack.connected ? (
              <Button className="mt-3" variant="danger" onClick={() => void onDisconnect()}>
                Disconnect Slack
              </Button>
            ) : (
              <Button className="mt-3" variant="secondary" type="button" onClick={() => { window.location.href = `${apiBase}/api/slack/connect` }}>
                Connect Slack
              </Button>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            tabs={[
              { id: 'scheduled', label: 'Scheduled Emails' },
              { id: 'sent', label: 'Sent Emails' },
            ]}
            value={tab}
            onChange={(id) => setTab(id as 'scheduled' | 'sent')}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject or recipient"
            className="w-full max-w-xs rounded-full border border-line bg-card px-4 py-2 text-sm outline-none ring-accent/30 focus:ring-4"
          />
        </div>

        {emails.error ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-900">
            <span>{emails.error}</span>
            <Button variant="ghost" onClick={() => void emails.reload()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="mt-4">
          <Table
            columns={columns}
            rows={emails.data}
            rowKey={(row) => row.id}
            loading={emails.loading}
            empty={
              <EmptyState
                title={tab === 'scheduled' ? 'Nothing queued' : 'Nothing sent yet'}
                body={
                  tab === 'scheduled'
                    ? 'Compose a campaign to put emails on the clock.'
                    : 'Delivered and failed messages will show up here.'
                }
              />
            }
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-mute">
          <span>
            {emails.total} message{emails.total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={emails.page <= 1} onClick={() => emails.setPage(emails.page - 1)}>
              Previous
            </Button>
            <span>
              {emails.page} / {pages}
            </span>
            <Button variant="secondary" disabled={emails.page >= pages} onClick={() => emails.setPage(emails.page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </main>
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={(count) => {
          push(`Scheduled ${count} email${count === 1 ? '' : 's'}`)
          void emails.reload()
        }}
      />
    </div>
  )
}
