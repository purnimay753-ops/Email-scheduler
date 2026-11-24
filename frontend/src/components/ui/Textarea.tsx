import type { TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }

export function Textarea({ label, id, ...props }: Props) {
  const inputId = id || props.name
  return (
    <label className="block text-sm" htmlFor={inputId}>
      <span className="mb-1.5 block font-medium text-ink">{label}</span>
      <textarea
        id={inputId}
        className="min-h-36 w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 placeholder:text-mute/70 focus:ring-4"
        {...props}
      />
    </label>
  )
}
