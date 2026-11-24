import type { EmailStatus } from '../../types'
import { cn } from '../../lib/cn'

const tones: Record<EmailStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  sent: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-red-100 text-red-900',
}

export function Badge({ status }: { status: EmailStatus }) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', tones[status])}>{status}</span>
}
