import { apiBase } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Button } from './ui/Button'

export function Header() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <header className="border-b border-white/10 bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <a href="/" className="font-serif text-3xl leading-none tracking-tight">
          Postline
        </a>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-paper/70">{user.email}</p>
          </div>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <Button
            variant="secondary"
            className="border-white/15 bg-transparent text-paper hover:bg-white/10"
            onClick={() => void logout()}
          >
            Logout
          </Button>
          <a
            className="hidden text-xs text-paper/60 underline sm:inline"
            href={`${apiBase}/admin/queues`}
            target="_blank"
            rel="noreferrer"
          >
            Queue
          </a>
        </div>
      </div>
    </header>
  )
}
