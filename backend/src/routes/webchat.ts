import express from 'express';
import { processWebMessage, WebChatMessage, PrefilledParams } from '../ai/webConversation';

export const webchatRouter = express.Router();

webchatRouter.post('/message', async (req, res) => {
  try {
    const { message, history = [], prefilled, leadInfo } = req.body as {
      message: string;
      history: WebChatMessage[];
      prefilled?: PrefilledParams;
      leadInfo?: { name?: string; phone?: string; email?: string };
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await processWebMessage(message.trim(), history, prefilled, leadInfo);
    res.json(result);
  } catch (err) {
    console.error('Web chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});
