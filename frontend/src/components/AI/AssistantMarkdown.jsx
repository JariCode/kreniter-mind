import ReactMarkdown from 'react-markdown'

// Only fully-qualified http(s) links are ever turned into clickable
// anchors. new URL() without a base throws for relative or scheme-less
// hrefs, so those are rejected along with javascript:, data:, mailto:, etc.
function isAllowedLinkHref(href) {
  if (typeof href !== 'string') {
    return false
  }

  try {
    const url = new URL(href)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function MarkdownLink({ href, children }) {
  if (!isAllowedLinkHref(href)) {
    return <span>{children}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

const markdownComponents = {
  a: MarkdownLink,
}

// Renders an assistant reply as markdown, without raw HTML (no rehype-raw),
// without images, and with links opening only on click in a new tab.
function AssistantMarkdown({ children }) {
  return (
    <ReactMarkdown
      components={markdownComponents}
      disallowedElements={['img']}
    >
      {children}
    </ReactMarkdown>
  )
}

export default AssistantMarkdown
