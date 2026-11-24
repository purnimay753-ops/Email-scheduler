import { apiBase } from '../api/client'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const params = new URLSearchParams(window.location.search)
  const failed = params.get('auth') === 'error'

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
      <section className="grid w-full items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Email scheduling</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.95] sm:text-7xl">
            Send a hundred emails without sending them all at once.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-mute">
            Upload a list, choose a start time, and let the queue pace delivery with a delay and an hourly cap.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-card p-8 shadow-card">
          <h2 className="font-serif text-4xl">Sign in</h2>
          <p className="mt-2 text-sm text-mute">Use the Google account that should own this mailbox queue.</p>
          {failed ? <p className="mt-4 text-sm text-red-800">Google sign-in failed. Try again.</p> : null}
          <Button className="mt-6 w-full" type="button" onClick={() => { window.location.href = `${apiBase}/auth/google` }}>
            Sign in with Google
          </Button>
        </div>
      </section>
    </main>
  )
}
