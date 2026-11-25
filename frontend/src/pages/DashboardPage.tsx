
import { useEffect, useState } from 'react'
import { ApiError, getSenders, provisionSender, apiBase } from '../api/client'
import { ComposeModal } from '../components/ComposeModal'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, type Column } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { useEmails } from '../hooks/useEmails'
import { useAuth } from '../hooks/useAuth'
import { formatWhen } from '../lib/format'
import type { EmailRecord, Sender } from '../types'

export function DashboardPage() {
  const { push } = useToast()
  const { user, logout } = useAuth()

  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled')
  const [view, setView] = useState<'emails' | 'queue'>('emails')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [senders, setSenders] = useState<Sender[]>([])
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
  }, [])

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

  const columns: Column<EmailRecord>[] =
    tab === 'scheduled'
      ? [
          { key: 'email', header: 'EMAIL', render: (row) => row.toEmail },
          { key: 'subject', header: 'SUBJECT', render: (row) => row.subject },
          { key: 'when', header: 'SCHEDULED TIME', render: (row) => formatWhen(row.scheduledAt) },
          { key: 'status', header: 'STATUS', render: (row) => <Badge status={row.status} /> },
        ]
      : [
          { key: 'email', header: 'EMAIL', render: (row) => row.toEmail },
          { key: 'subject', header: 'SUBJECT', render: (row) => row.subject },
          { key: 'when', header: 'SENT TIME', render: (row) => formatWhen(row.sentAt) },
          {
            key: 'status',
            header: 'STATUS',
            render: (row) => (
              <span className="inline-flex items-center gap-2">
                <Badge status={row.status} />
                {row.previewUrl ? (
                  <a
                    className="text-xs font-semibold text-emerald-400 underline"
                    href={row.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview
                  </a>
                ) : null}
              </span>
            ),
          },
        ]

  const pages = Math.max(1, Math.ceil(emails.total / emails.limit))

  return (
    <div className="min-h-screen bg-[#111827] text-gray-100 lg:flex">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-700 bg-[#1f2937] px-5 py-6 lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-r">
        <a href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight text-emerald-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">
            P
          </span>
          Postline
        </a>

        <div className="mt-8 flex items-center gap-3 rounded-xl bg-slate-800 p-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
              {user?.name?.slice(0, 1).toUpperCase() || 'P'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-100">{user?.name}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => setComposeOpen(true)}
          className="mt-7 flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <span className="text-lg">+</span> Compose New Email
        </button>

        <p className="mb-2 mt-9 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          Core
        </p>

        <button
          onClick={() => {
            setView('emails')
            setTab('scheduled')
          }}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
            view === 'emails' && tab === 'scheduled'
              ? 'bg-emerald-900/50 text-emerald-300'
              : 'text-gray-300 hover:bg-slate-700'
          }`}
        >
          <span>◷</span> Scheduled
        </button>

        <button
          onClick={() => {
            setView('emails')
            setTab('sent')
          }}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
            view === 'emails' && tab === 'sent'
              ? 'bg-emerald-900/50 text-emerald-300'
              : 'text-gray-300 hover:bg-slate-700'
          }`}
        >
          <span>➤</span> Sent Emails
        </button>

        <p className="mb-2 mt-9 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          Senders
        </p>

        <div className="rounded-xl bg-slate-800 p-3">
          <p className="text-sm font-semibold text-gray-100">Ethereal Inbox</p>
          <p className="mt-1 break-all text-xs text-gray-400">
            {senders.length ? `${senders.length} sender(s) available` : 'No sender created yet'}
          </p>
          <button
            onClick={() => void addSender()}
            disabled={provisioning}
            className="mt-3 w-full rounded-lg border border-emerald-700 bg-[#1f2937] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {provisioning ? 'Creating...' : '+ Add Sender'}
          </button>
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={() => setView('queue')}
            className={`block w-full rounded-lg px-4 py-2 text-left text-sm ${
              view === 'queue'
                ? 'bg-slate-700 text-emerald-300'
                : 'text-gray-300 hover:bg-slate-700'
            }`}
          >
            Queue Monitor
          </button>

          <button
            onClick={() => void logout()}
            className="mt-2 w-full rounded-lg px-4 py-2 text-left text-sm font-semibold text-red-400 hover:bg-red-900/30"
          >
            ↪ Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10">
        {view === 'queue' ? (
          <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#1f2937]">
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Postline Workspace
                </p>
                <h1 className="mt-1 text-xl font-bold text-gray-100">
                  Queue Monitor
                </h1>
              </div>

              <button
                onClick={() => setView('emails')}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-slate-600"
              >
                Back to Emails
              </button>
            </div>

            <iframe
              src={`${apiBase}/admin/queues`}
              title="Bull Board Queue Monitor"
              className="h-[calc(100vh-180px)] min-h-[600px] w-full bg-[#181d25]"
            />
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Postline Workspace
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-100">
                  {tab === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
                </h1>
                <p className="mt-1 text-sm text-gray-400">
                  Manage and track your email campaigns.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => void emails.reload()}
                  className="rounded-xl border border-slate-700 bg-[#1f2937] px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-slate-700"
                >
                  ↻ Refresh
                </button>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  + Compose Email
                </button>
              </div>
            </div>

            {/* Email panel */}
            <section className="mt-8 overflow-hidden rounded-2xl border border-slate-700 bg-[#1f2937] shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 p-5">
                <div>
                  <h2 className="font-semibold text-gray-100">Your Campaigns</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    {emails.total} total message(s)
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search emails, recipients, subjects..."
                  className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-900"
                />
              </div>

              <div className="flex gap-2 border-b border-slate-700 px-5 pt-3">
                <button
                  onClick={() => setTab('scheduled')}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                    tab === 'scheduled'
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-transparent text-gray-400 hover:text-gray-100'
                  }`}
                >
                  Scheduled
                </button>
                <button
                  onClick={() => setTab('sent')}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                    tab === 'sent'
                      ? 'border-emerald-500 text-emerald-300'
                      : 'border-transparent text-gray-400 hover:text-gray-100'
                  }`}
                >
                  Sent
                </button>
              </div>

              {emails.error ? (
                <div className="m-5 flex items-center justify-between rounded-xl bg-red-900/30 px-4 py-3 text-sm text-red-300">
                  <span>{emails.error}</span>
                  <Button variant="ghost" onClick={() => void emails.reload()}>
                    Retry
                  </Button>
                </div>
              ) : null}

              <div className="min-h-[350px] overflow-x-auto">
                <Table
                  columns={columns}
                  rows={emails.data}
                  rowKey={(row) => row.id}
                  loading={emails.loading}
                  empty={
                    <EmptyState
                      title={tab === 'scheduled' ? 'No scheduled emails yet' : 'No emails sent yet'}
                      body={
                        tab === 'scheduled'
                          ? 'Schedule your first email campaign with custom delays and hourly rate limits.'
                          : 'Delivered and failed messages will show up here.'
                      }
                    />
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 px-5 py-4">
                <span className="text-sm text-gray-400">
                  Showing {emails.data.length} of {emails.total} messages
                </span>
                <div className="flex items-center gap-3">
                  <button
                    disabled={emails.page <= 1}
                    onClick={() => emails.setPage(emails.page - 1)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    {emails.page} / {pages}
                  </span>
                  <button
                    disabled={emails.page >= pages}
                    onClick={() => emails.setPage(emails.page + 1)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
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
