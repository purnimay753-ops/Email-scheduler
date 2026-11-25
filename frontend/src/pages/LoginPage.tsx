
import { useState } from 'react'
import { apiBase, api } from '../api/client'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const params = new URLSearchParams(window.location.search)
  const failed = params.get('auth') === 'error'

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const result = await api('/auth/email/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }) as { message?: string }

      setOtpSent(true)
      setMessage(
        result.message || 'OTP sent. Please check your email.',
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api('/auth/email/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, password, code }),
      })

      window.location.href = '/'
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111827] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#1f2937] p-8 text-white shadow-lg sm:p-10">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Login
        </h1>

        <p className="mb-7 text-center text-sm text-white">
          Welcome
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.href = `${apiBase}/auth/google`
          }}
          className="w-full rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white transition hover:bg-gray-500"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-600" />
          <span className="text-sm text-gray-300">OR</span>
          <div className="h-px flex-1 bg-gray-600" />
        </div>

        <form
          onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              disabled={otpSent}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full rounded-lg border border-gray-600 bg-[#374151] px-4 py-3 text-white placeholder:text-gray-300 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-70"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              disabled={otpSent}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (minimum 8 characters)"
              className="w-full rounded-lg border border-gray-600 bg-[#374151] px-4 py-3 text-white placeholder:text-gray-300 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30 disabled:opacity-70"
            />
          </div>

          {otpSent && (
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                OTP Verification Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="w-full rounded-lg border border-gray-600 bg-[#374151] px-4 py-3 text-white placeholder:text-gray-300 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
              />
            </div>
          )}

          {failed && (
            <p className="text-sm text-red-300">
              Google sign-in failed. Try again.
            </p>
          )}

          {message && (
            <p className="text-sm text-green-300">
              {message}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Please wait...'
              : otpSent
                ? 'Verify OTP & Login'
                : 'Send OTP'}
          </button>

          {otpSent && (
            <button
              type="button"
              onClick={() => {
                setOtpSent(false)
                setCode('')
                setMessage('')
                setError('')
              }}
              className="w-full rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white transition hover:bg-gray-500"
            >
              Change Email or Password
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
