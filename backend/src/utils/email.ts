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
