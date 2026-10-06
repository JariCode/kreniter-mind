// Rejects a request whose body carries a non-string value for a field that
// must be a string (e.g. the sanitize middleware stripping a "$gt" key out
// of { name: { $gt: '' } } leaves an empty object, not a string, which
// Mongoose would otherwise reject with an internals-revealing CastError).
// Fields that are absent or null are left alone for the model's own
// required/default handling.
function validateStringFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const value = req.body?.[field]

      if (
        value !== undefined &&
        value !== null &&
        typeof value !== 'string'
      ) {
        return res.status(400).json({
          error: 'Invalid input',
        })
      }
    }

    next()
  }
}

module.exports = validateStringFields
