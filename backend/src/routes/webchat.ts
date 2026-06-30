import express from 'express';
import { processWebMessage, WebChatMessage } from '../ai/webConversation';

export const webchatRouter = express.Router();

webchatRouter.post('/message', async (req, res) => {
  try {
    const { message, history = [] } = req.body as { message: string; history: WebChatMessage[] };
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const result = await processWebMessage(message.trim(), history);
    res.json(result);
  } catch (err) {
    console.error('Web chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});
