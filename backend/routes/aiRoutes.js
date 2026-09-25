const express = require('express')
const mongoose = require('mongoose')
const AIConversation = require('../models/AIConversation')
const AIMessage = require('../models/AIMessage')

const router = express.Router()

const openAIUrl =
  'https://api.openai.com/v1/responses'

const systemInstructions = `
You are Kreniter, the built-in AI assistant of Kreniter Mind.

Help the user work with their projects, tasks, notes, time tracking and other information in Kreniter Mind.

Be clear, practical and concise.
Answer in the same language as the user.
Do not invent information about the user's projects or data.
`

// Get all conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const conversations =
      await AIConversation.find({
        userId: req.user._id,
      }).sort({
        updatedAt: -1,
      })

    res.json(conversations)
  } catch (error) {
    next(error)
  }
})

// Create a new conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const projectId =
      req.body.projectId || null

    if (
      projectId &&
      !mongoose.Types.ObjectId.isValid(projectId)
    ) {
      return res.status(400).json({
        error: 'Invalid project ID',
      })
    }

    const conversation =
      await AIConversation.create({
        userId: req.user._id,
        projectId,
        title: 'New conversation',
      })

    res.status(201).json(conversation)
  } catch (error) {
    next(error)
  }
})

// Get one conversation with its messages
router.get(
  '/conversations/:conversationId',
  async (req, res, next) => {
    try {
      const { conversationId } = req.params

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          error: 'Invalid conversation ID',
        })
      }

      const conversation =
        await AIConversation.findOne({
          _id: conversationId,
          userId: req.user._id,
        })

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
        })
      }

      const messages = await AIMessage.find({
        conversationId: conversation._id,
      }).sort({
        createdAt: 1,
      })

      res.json({
        conversation,
        messages,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Send a message
router.post(
  '/conversations/:conversationId/messages',
  async (req, res, next) => {
    try {
      const { conversationId } = req.params
      const { content } = req.body

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          error: 'Invalid conversation ID',
        })
      }

      if (
        typeof content !== 'string' ||
        !content.trim()
      ) {
        return res.status(400).json({
          error: 'Message content is required',
        })
      }

      const conversation =
        await AIConversation.findOne({
          _id: conversationId,
          userId: req.user._id,
        })

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
        })
      }

      const userMessage =
        await AIMessage.create({
          conversationId: conversation._id,
          role: 'user',
          content: content.trim(),
        })

      const messages = await AIMessage.find({
        conversationId: conversation._id,
      }).sort({
        createdAt: 1,
      })

      const input = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }))

      const openAIResponse = await fetch(
        openAIUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model:
              process.env.OPENAI_MODEL ||
              'gpt-5.6-terra',
            instructions: systemInstructions,
            input,
          }),
        }
      )

      if (!openAIResponse.ok) {
        const errorData =
          await openAIResponse.text()

        console.error(
          'OpenAI API error:',
          errorData
        )

        return res.status(502).json({
          error: 'AI service error',
        })
      }

      const openAIData =
        await openAIResponse.json()

      const assistantContent =
        openAIData.output
          ?.flatMap(
            (item) => item.content || []
          )
          .filter(
            (item) =>
              item.type === 'output_text'
          )
          .map(
            (item) => item.text
          )
          .join('') || ''

      if (!assistantContent) {
        return res.status(502).json({
          error: 'AI returned an empty response',
        })
      }

      const assistantMessage =
        await AIMessage.create({
          conversationId: conversation._id,
          role: 'assistant',
          content: assistantContent,
        })

      conversation.updatedAt = new Date()

      if (
        conversation.title ===
        'New conversation'
      ) {
        conversation.title =
          content.trim().slice(0, 60)
      }

      await conversation.save()

      res.json({
        userMessage,
        assistantMessage,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Delete a conversation
router.delete(
  '/conversations/:conversationId',
  async (req, res, next) => {
    try {
      const { conversationId } = req.params

      if (
        !mongoose.Types.ObjectId.isValid(
          conversationId
        )
      ) {
        return res.status(400).json({
          error: 'Invalid conversation ID',
        })
      }

      const conversation =
        await AIConversation.findOneAndDelete({
          _id: conversationId,
          userId: req.user._id,
        })

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
        })
      }

      await AIMessage.deleteMany({
        conversationId: conversation._id,
      })

      res.json({
        message: 'Conversation deleted',
      })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router