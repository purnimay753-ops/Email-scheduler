import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

const variants: Record<NonNullable<Props['variant']>, string> = {
  primary: 'bg-accent text-white hover:bg-accentdark',
  secondary: 'border border-line bg-card text-ink hover:bg-paper',
  ghost: 'text-ink hover:bg-black/5',
  danger: 'border border-red-200 bg-white text-red-800 hover:bg-red-50',
}

export function Button({ variant = 'primary', loading, className, children, disabled, ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}
