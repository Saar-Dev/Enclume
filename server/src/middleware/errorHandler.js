export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'
  const who = req.user?.username ? ` [user:${req.user.username}]` : ''
  console.error(`[${statusCode}] ${req.method} ${req.path}${who} — ${message}`)
  if (statusCode === 500) console.error(err.stack)
  res.status(statusCode).json({
    error: { status: statusCode, message, ...(err.i18nKey && { i18nKey: err.i18nKey }) }
  })
}