import type { Request, Response } from 'express'
import { parseEmailList } from '../utils/email'

export function parseCsv(req: Request, res: Response): void {
  if (!req.file) {
    res.status(400).json({ error: 'Upload a CSV or text file in the file field' })
    return
  }
  const recipients = parseEmailList(req.file.buffer.toString('utf8'))
  res.json({ count: recipients.length, recipients })
}
