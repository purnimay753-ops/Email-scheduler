import { useCallback, useEffect, useState } from 'react'
import { ApiError, getEmails } from '../api/client'
import type { EmailRecord } from '../types'

export function useEmails(status: 'scheduled' | 'sent', search: string) {
  const [data, setData] = useState<EmailRecord[]>([])
  const [total, setTotal] = useState(0)
  const [tracked, setTracked] = useState({ status, search, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const limit = 20

  if (tracked.status !== status || tracked.search !== search) {
    setTracked({ status, search, page: 1 })
  }

  const page = tracked.page

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getEmails(status, page, search)
      setData(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load emails')
    } finally {
      setLoading(false)
    }
  }, [status, search, page])

  useEffect(() => {
    void load()
  }, [load])

  return {
    data,
    total,
    page,
    setPage: (next: number) => setTracked((current) => ({ ...current, page: next })),
    limit,
    loading,
    error,
    reload: load,
  }
}
