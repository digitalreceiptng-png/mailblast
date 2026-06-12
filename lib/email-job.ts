export const BATCH_SIZE = 42
export const JOB_TTL    = 7 * 24 * 60 * 60  // 7 days in seconds

export interface EmailJob {
  id:             string
  status:         'pending' | 'running' | 'completed' | 'cancelled'
  recipients:     Array<Record<string, string>>
  currentIndex:   number
  totalCount:     number
  batchSize:      number
  subject:        string
  body:           string
  senderName:     string
  attachCard:     boolean
  cardNameField:  string
  cardIdField:    string
  createdAt:      string
  lastRunAt:      string | null
  completedAt:    string | null
  sentCount:      number
  failedCount:    number
  errors:         Array<{ email: string; error: string }>
}

export interface JobStatus extends Omit<EmailJob, 'recipients'> {
  recipientCount: number
}
