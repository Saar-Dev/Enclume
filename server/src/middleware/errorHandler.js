export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${statusCode}] ${message}`)
  }

  res.status(statusCode).json({
    error: {
      status: statusCode,
      message,
    }
  })
}