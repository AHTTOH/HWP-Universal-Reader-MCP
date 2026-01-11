type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const resolveLevel = (): LogLevel => {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }
  return 'info'
}

const CURRENT_LEVEL = resolveLevel()

const shouldLog = (level: LogLevel): boolean => {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL]
}

const emit = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
  if (!shouldLog(level)) {
    return
  }
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    pid: process.pid,
    ...(data ? { data } : {}),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => emit('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => emit('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => emit('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => emit('error', message, data),
}
