import { useMemo, useState, type FormEvent } from 'react'
import { ApiError, scheduleCampaign } from '../api/client'
import { parseEmailList } from '../lib/format'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Modal } from './ui/Modal'
import { Textarea } from './ui/Textarea'

type Props = {
  open: boolean
  onClose: () => void
  onScheduled: (count: number) => void
}

function defaultStart(): string {
  const date = new Date(Date.now() + 60_000)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [startTime, setStartTime] = useState(defaultStart)
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000)
  const [hourlyLimit, setHourlyLimit] = useState(50)
  const [fileLabel, setFileLabel] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countLabel = useMemo(() => {
    if (!fileLabel) return 'No file uploaded yet'
    return `${recipients.length} email address${recipients.length === 1 ? '' : 'es'} detected`
  }, [fileLabel, recipients.length])

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    setRecipients(parseEmailList(text))
    setFileLabel(file.name)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await scheduleCampaign({
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayBetweenMs,
        hourlyLimit,
        recipients,
      })
      onScheduled(result.campaign.emailCount)
      setSubject('')
      setBody('')
      setRecipients([])
      setFileLabel('')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not schedule emails')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="Compose new email" onClose={onClose}>
      <form className="grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="space-y-4 md:col-span-2">
          <Input label="Subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
          <Textarea label="Message" name="body" value={body} onChange={(event) => setBody(event.target.value)} required />
        </div>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1.5 block font-medium">Recipients</span>
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="block w-full text-sm text-mute file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-paper"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <span className="mt-2 block text-mute">
            {fileLabel ? `${fileLabel} · ` : ''}
            {countLabel}
          </span>
        </label>
        <Input label="Start time" name="startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        <Input
          label="Delay between emails (ms)"
          name="delay"
          type="number"
          min={0}
          value={delayBetweenMs}
          onChange={(event) => setDelayBetweenMs(Number(event.target.value))}
          required
        />
        <Input
          label="Hourly limit"
          name="hourlyLimit"
          type="number"
          min={1}
          value={hourlyLimit}
          onChange={(event) => setHourlyLimit(Number(event.target.value))}
          required
        />
        {error ? <p className="text-sm text-red-800 md:col-span-2">{error}</p> : null}
        <div className="flex justify-end md:col-span-2">
          <Button type="submit" loading={submitting} disabled={recipients.length === 0}>
            Schedule
          </Button>
        </div>
      </form>
    </Modal>
  )
}
