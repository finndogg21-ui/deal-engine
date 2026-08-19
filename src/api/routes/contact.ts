/**
 * Contact form. Public, so it needs a spam story: a honeypot field plus a
 * rate limit. Messages land in the database first and email second, because
 * an email provider outage should not lose someone's message.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { rateLimit, route } from '../middleware.js';
import { send } from '../../vendors/mailer.js';

export const contact = Router();

const SUPPORT = process.env.SUPPORT_EMAIL ?? 'support@localhost';
const emailOk = (e: unknown): e is string =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 255;

const TOPICS = ['question', 'bad-alert', 'store', 'billing', 'account', 'other'];

contact.post('/contact', rateLimit({ key: 'contact', max: 3, windowMs: 60 * 60_000 }), route(async (req, res) => {
  const { name, email, topic, message, hp } = req.body ?? {};

  // Honeypot. Real people never fill this in; bots fill in everything.
  if (typeof hp === 'string' && hp.trim() !== '') {
    return res.status(201).json({ ok: true });
  }

  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const body = String(message ?? '').trim();
  if (body.length < 10) return res.status(400).json({ error: 'Tell us a bit more than that.' });
  if (body.length > 5000) return res.status(400).json({ error: 'That message is too long.' });

  const db = await getDb();
  await db.query(
    `INSERT INTO messages (name, email, topic, body, ip) VALUES ($1,$2,$3,$4,$5)`,
    [
      String(name ?? '').slice(0, 120) || null,
      email.trim().toLowerCase(),
      TOPICS.includes(String(topic)) ? String(topic) : 'other',
      body,
      req.ip ?? null,
    ],
  );

  // Best effort. The message is already saved.
  try {
    await send({
      to: SUPPORT,
      subject: `[${topic ?? 'other'}] message from ${email}`,
      text: `${name ?? 'Someone'} <${email}>\n\n${body}`,
    });
  } catch (err) {
    console.error('contact email failed, message is stored', err);
  }

  res.status(201).json({ ok: true });
}));
