import { useEffect, useRef, useState } from 'react'
import AI from '../../components/AI/AI'
import {
  getConversations,
  getConversation,
  createConversation,
  sendMessage,
  transcribeAudio,
  generateSpeech,
  generateImage,
  deleteConversation,
} from '../../api/ai'
import './Assistant.css'

function Assistant() {
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playingMessageId, setPlayingMessageId] = useState(null)
  const [speechLoadingMessageId, setSpeechLoadingMessageId] = useState(null)
  const [imageGenerating, setImageGenerating] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    async function loadConversations() {
      try {
        const data = await getConversations()

        setConversations(data)

        if (data.length > 0) {
          await loadConversation(data[0]._id)
        }
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, sending])

  async function loadConversation(conversationId) {
    try {
      setMessagesLoading(true)
      setError('')

      const data = await getConversation(
        conversationId
      )

      setActiveConversation(data.conversation)
      setMessages(data.messages)
    } catch (error) {
      setError(error.message)
    } finally {
      setMessagesLoading(false)
    }
  }

  async function handleNewConversation() {
    try {
      setError('')

      const conversation =
        await createConversation()

      setConversations((current) => [
        conversation,
        ...current,
      ])

      setActiveConversation(conversation)
      setMessages([])
    } catch (error) {
      setError(error.message)
    }
  }

  async function handleDeleteConversation(
    conversationId
  ) {
    try {
      setError('')

      await deleteConversation(conversationId)

      const remaining =
        conversations.filter(
          (conversation) =>
            conversation._id !== conversationId
        )

      setConversations(remaining)

      if (
        activeConversation?._id ===
        conversationId
      ) {
        if (remaining.length > 0) {
          await loadConversation(
            remaining[0]._id
          )
        } else {
          setActiveConversation(null)
          setMessages([])
        }
      }
    } catch (error) {
      setError(error.message)
    }
  }

  function isImageRequest(content) {
    return /(?:\b(?:generate|create|make|draw|show)\b.{0,40}\b(?:image|picture|photo)\b|\b(?:image|picture|photo)\b.{0,40}\b(?:generate|create|make|draw)\b|\b(?:generoi|luo|tee|piirrä)\b.{0,40}\b(?:kuva|kuvan)\b|\b(?:kuva|kuvan)\b.{0,40}\b(?:generoi|luo|tee|piirrä)\b)/i.test(
      content
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const content = input.trim()

    if (!content || sending) {
      return
    }

    try {
      setError('')

      let conversation =
        activeConversation

      if (!conversation) {
        conversation =
          await createConversation()

        setConversations((current) => [
          conversation,
          ...current,
        ])

        setActiveConversation(conversation)
      }

      setInput('')
      setSending(true)

      const userMessage = {
        _id: `temp-user-${Date.now()}`,
        role: 'user',
        content,
      }

      setMessages((current) => [
        ...current,
        userMessage,
      ])

      const data = await sendMessage(
        conversation._id,
        content
      )

      let assistantMessage =
        data.assistantMessage

      if (isImageRequest(content)) {
        try {
          setImageGenerating(true)

          const imageData =
            await generateImage(content)

          assistantMessage = {
            ...assistantMessage,
            image: imageData.image,
          }
        } catch (error) {
          setError(error.message)
        } finally {
          setImageGenerating(false)
        }
      }

      setMessages((current) => [
        ...current.filter(
          (message) =>
            message._id !== userMessage._id
        ),
        data.userMessage,
        assistantMessage,
      ])

      setConversations((current) =>
        current.map((item) =>
          item._id === conversation._id
            ? {
                ...item,
                title:
                  conversation.title ===
                    'New conversation'
                    ? content.slice(0, 60)
                    : item.title,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      )
    } catch (error) {
      setError(error.message)
    } finally {
      setSending(false)
    }
  }

  async function handleStartRecording() {
    if (
      recording ||
      sending ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return
    }

    try {
      setError('')

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

      const mediaRecorder =
        new MediaRecorder(stream)

      mediaRecorderRef.current =
        mediaRecorder

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (
        event
      ) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(
            event.data
          )
        }
      }

      mediaRecorder.onstop = async () => {
        try {
          setSending(true)

          const audioBlob =
            new Blob(
              audioChunksRef.current,
              {
                type:
                  mediaRecorder.mimeType ||
                  'audio/webm',
              }
            )

          const reader =
            new FileReader()

          reader.onloadend = async () => {
            try {
              const result =
                await transcribeAudio(
                  reader.result
                )

              if (result.text) {
                setInput((current) =>
                  current
                    ? `${current} ${result.text}`
                    : result.text
                )
              }
            } catch (error) {
              setError(error.message)
            } finally {
              setSending(false)
            }
          }

          reader.readAsDataURL(audioBlob)
        } catch (error) {
          setError(error.message)
          setSending(false)
        } finally {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            )
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (error) {
      setError(
        'Microphone access was denied or unavailable.'
      )
    }
  }

  function handleStopRecording() {
    if (
      !mediaRecorderRef.current ||
      !recording
    ) {
      return
    }

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  async function handlePlayMessage(message) {
    if (speechLoadingMessageId === message._id) {
      return
    }

    if (playingMessageId === message._id) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingMessageId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }

    try {
      setError('')
      setSpeechLoadingMessageId(message._id)

      const audioBlob = await generateSpeech(message.content)
      const audioUrl = URL.createObjectURL(audioBlob)
      audioUrlRef.current = audioUrl

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setPlayingMessageId(null)
        audioRef.current = null

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }
      }

      audio.onerror = () => {
        setPlayingMessageId(null)
        audioRef.current = null

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }

        setError('Speech playback failed.')
      }

      setPlayingMessageId(message._id)
      await audio.play()
    } catch (error) {
      setError(error.message)
      setPlayingMessageId(null)
    } finally {
      setSpeechLoadingMessageId(null)
    }
  }

  function handleKeyDown(event) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <main className="assistant-page">
      <div className="assistant-header">
        <div>
          <div className="assistant-kicker">
            WORKSPACE
          </div>

          <h1 className="assistant-title">
            AI Assistant
          </h1>

          <p className="assistant-description">
            Work with Kreniter across your
            projects, tasks and notes.
          </p>
        </div>

        <button
          type="button"
          className="assistant-new-button"
          onClick={handleNewConversation}
        >
          <span>+</span>
          New conversation
        </button>
      </div>

      <section className="assistant-workspace">
        <aside className="assistant-conversations">
          <div className="assistant-sidebar-header">
            <span>CONVERSATIONS</span>
          </div>

          <div className="assistant-conversation-list">
            {loading ? (
              <div className="assistant-sidebar-empty">
                Loading...
              </div>
            ) : conversations.length === 0 ? (
              <div className="assistant-sidebar-empty">
                No conversations yet.
              </div>
            ) : (
              conversations.map(
                (conversation) => (
                  <div
                    key={conversation._id}
                    className={`assistant-conversation ${
                      activeConversation?._id ===
                      conversation._id
                        ? 'is-active'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="assistant-conversation-button"
                      onClick={() =>
                        loadConversation(
                          conversation._id
                        )
                      }
                    >
                      <span className="assistant-conversation-title">
                        {conversation.title ||
                          'New conversation'}
                      </span>

                      <span className="assistant-conversation-date">
                        {new Date(
                          conversation.updatedAt
                        ).toLocaleDateString(
                          'fi-FI'
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="assistant-delete-button"
                      onClick={() =>
                        handleDeleteConversation(
                          conversation._id
                        )
                      }
                      aria-label="Delete conversation"
                    >
                      ×
                    </button>
                  </div>
                )
              )
            )}
          </div>
        </aside>

        <section className="assistant-chat">
          <div className="assistant-chat-center">
            <AI />
          </div>

          <div className="assistant-messages">
            {messagesLoading ? (
              <div className="assistant-loading">
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="assistant-empty">
                <div className="assistant-empty-entity">
                  <AI />
                </div>

                <h2>
                  What are you working on today?
                </h2>

                <p>
                  Ask Kreniter about your
                  projects, tasks or ideas.
                </p>
              </div>
            ) : (
              <div className="assistant-message-list">
                {messages.map((message) => (
                  <div
                    key={message._id}
                    className={`assistant-message assistant-message-${message.role}`}
                  >
                    {message.role ===
                      'assistant' && (
                      <div className="assistant-message-icon">
                        <AI />
                      </div>
                    )}

                    {message.role ===
                      'assistant' ? (
                      <div className="assistant-message-body">
                        <div className="assistant-message-content">
                          {message.content}
                        </div>

                        {message.image && (
                          <div className="assistant-image">
                            <img
                              src={message.image}
                              alt="Generated by Kreniter"
                            />

                            <a
                              className="assistant-download-button"
                              href={message.image}
                              download="kreniter-image.png"
                            >
                              Download image
                            </a>
                          </div>
                        )}

                        <button
                          type="button"
                          className="assistant-play-button"
                          onClick={() =>
                            handlePlayMessage(message)
                          }
                          disabled={
                            speechLoadingMessageId ===
                            message._id
                          }
                          aria-label={
                            playingMessageId ===
                            message._id
                              ? 'Stop playback'
                              : 'Play message'
                          }
                        >
                          {speechLoadingMessageId ===
                          message._id
                            ? '···'
                            : playingMessageId ===
                                message._id
                              ? '⏸'
                              : '▶'}
                        </button>
                      </div>
                    ) : (
                      <div className="assistant-message-content">
                        {message.content}
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div className="assistant-message assistant-message-assistant">
                    <div className="assistant-message-icon">
                      <AI />
                    </div>

                    <div className="assistant-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="assistant-error">
              {error}
            </div>
          )}

          <form
            className="assistant-input-area"
            onSubmit={handleSubmit}
          >
            <div className="assistant-input-wrapper">
              <button
                type="button"
                className="assistant-file-button"
                aria-label="Attach file"
              >
                📎
              </button>

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Ask Kreniter anything..."
                rows={1}
                disabled={
                  sending || recording
                }
              />

              <button
                type="button"
                className={`assistant-mic-button ${
                  recording
                    ? 'is-recording'
                    : ''
                }`}
                onClick={
                  recording
                    ? handleStopRecording
                    : handleStartRecording
                }
                disabled={sending}
                aria-label={
                  recording
                    ? 'Stop recording'
                    : 'Start voice input'
                }
              >
                {recording ? '■' : '🎤'}
              </button>

              <button
                type="submit"
                className="assistant-send-button"
                disabled={
                  sending ||
                  recording ||
                  !input.trim()
                }
                aria-label="Send message"
              >
                →
              </button>
            </div>

            <div className="assistant-input-hint">
              Enter to send · Shift + Enter
              for a new line
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}

export default Assistant