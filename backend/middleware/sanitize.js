// Blocks NoSQL injection payloads that rely on Mongo operator keys ($gt, $where, ...)
// or dotted keys used to reach into nested documents.
//
// express-mongo-sanitize is not used here because it assigns to req.query, which is a
// read-only getter in Express 5 and throws.

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

// Matches a $ anywhere in the key (not just at the start) so bracket-notation
// query strings such as "a[$ne]=1" are caught too: Express 5's default "simple"
// query parser keeps that as the literal flat key "a[$ne]" instead of nesting it.
function isUnsafeKey(key) {
  return key.includes('$') || key.includes('.')
}

// Recursively strips unsafe keys from objects/arrays in place and returns the cleaned value.
function stripUnsafeKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripUnsafeKeys(item))
  }

  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (isUnsafeKey(key)) {
        delete value[key]
        continue
      }

      value[key] = stripUnsafeKeys(value[key])
    }

    return value
  }

  return value
}

// Recursively checks for unsafe keys without modifying anything.
function containsUnsafeKey(value) {
  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafeKey(item))
  }

  if (isPlainObject(value)) {
    return Object.keys(value).some(
      (key) => isUnsafeKey(key) || containsUnsafeKey(value[key])
    )
  }

  return false
}

function sanitize(req, res, next) {
  if (req.body) {
    stripUnsafeKeys(req.body)
  }

  if (req.params) {
    stripUnsafeKeys(req.params)
  }

  if (req.query && containsUnsafeKey(req.query)) {
    return res.status(400).json({
      error: 'Invalid request',
    })
  }

  next()
}

module.exports = sanitize
