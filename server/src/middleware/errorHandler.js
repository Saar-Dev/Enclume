export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'
  console.error(`[${statusCode}] ${req.method} ${req.path} — ${message}`)
  if (statusCode === 500) console.error(err.stack)
  res.status(statusCode).json({
    error: { status: statusCode, message }
  })
}