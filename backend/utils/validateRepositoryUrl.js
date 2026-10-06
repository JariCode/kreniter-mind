const MAX_REPOSITORY_URL_LENGTH = 2048

// Validates a project's repositoryUrl. An empty value means "no link" and
// is accepted as-is. Only fully-qualified http/https URLs are accepted --
// parsed with the URL constructor and checked by protocol, not by string
// prefix comparison, so a payload like "javascript:alert(1)" is rejected
// even though it would still render as a clickable link if stored as-is.
// Returns { error, status } when invalid, otherwise { repositoryUrl }.
function validateRepositoryUrl(rawRepositoryUrl) {
  const repositoryUrl =
    typeof rawRepositoryUrl === 'string'
      ? rawRepositoryUrl.trim()
      : ''

  if (!repositoryUrl) {
    return { repositoryUrl: '' }
  }

  if (repositoryUrl.length > MAX_REPOSITORY_URL_LENGTH) {
    return { error: 'Invalid repository URL', status: 400 }
  }

  let parsed

  try {
    parsed = new URL(repositoryUrl)
  } catch {
    return { error: 'Invalid repository URL', status: 400 }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Invalid repository URL', status: 400 }
  }

  return { repositoryUrl }
}

module.exports = {
  MAX_REPOSITORY_URL_LENGTH,
  validateRepositoryUrl,
}
