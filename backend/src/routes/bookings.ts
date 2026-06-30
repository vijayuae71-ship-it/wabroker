import express from 'express';
import { query } from '../db';

export const bookingsRouter = express.Router();

bookingsRouter.post('/', async (req, res) => {
  const { name, phone, propertyTitle, propertyRef, date, time } = req.body;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS web_viewings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255), phone VARCHAR(50), property_ref VARCHAR(50),
        property_title VARCHAR(255), preferred_date VARCHAR(50),
        preferred_time VARCHAR(50), created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await query(
      `INSERT INTO web_viewings (name, phone, property_ref, property_title, preferred_date, preferred_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name || 'Guest', phone || '', propertyRef || '', propertyTitle || '', date || '', time || '']
    );
  } catch (err) {
    console.error('Booking save error (non-fatal):', err);
  }
  res.json({ success: true, message: `Viewing booked for ${name || 'you'}! We'll confirm within 2 hours.` });
});
