import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string }

export function Input({ label, id, ...props }: Props) {
  const inputId = id || props.name
  return (
    <label className="block text-sm" htmlFor={inputId}>
      <span className="mb-1.5 block font-medium text-ink">{label}</span>
      <input
        id={inputId}
        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 placeholder:text-mute/70 focus:ring-4"
        {...props}
      />
    </label>
  )
}
