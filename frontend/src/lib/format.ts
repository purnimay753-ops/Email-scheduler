const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function parseEmailList(input: string): string[] {
  const matches = input.match(EMAIL_PATTERN) ?? []
  const seen = new Set<string>()
  const emails: string[] = []
  for (const match of matches) {
    const email = match.toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

export function formatWhen(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
