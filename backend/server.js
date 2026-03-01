import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Rate limit API calls
app.use('/api/', rateLimit({ windowMs: 60_000, max: 30 }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/analyze', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const { docs } = req.body || {};
    if (!Array.isArray(docs) || docs.length < 2) {
      return res.status(400).json({ error: 'Need at least two documents.' });
    }

    const systemPrompt =
      "You are a 'Smart Doc Checker' agent. Analyze multiple documents, identify contradictions and significant overlaps, and suggest clear resolutions. Output valid JSON per schema. If no issues, return empty arrays.";

    const userQuery = docs
      .map((d, i) =>
        `Document ${i + 1} Name: ${d.name}\n---\n${d.content}\n---`
      )
      .join('\n\n');

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [{ text: userQuery }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            contradictions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  topic: { type: "STRING" },
                  details: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        docName: { type: "STRING" },
                        statement: { type: "STRING" }
                      },
                      required: ["docName", "statement"]
                    }
                  },
                  explanation: { type: "STRING" },
                  suggestion: { type: "STRING" }
                },
                required: ["topic", "details", "explanation", "suggestion"]
              }
            },
            overlaps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  topic: { type: "STRING" },
                  details: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        docName: { type: "STRING" },
                        statement: { type: "STRING" }
                      },
                      required: ["docName", "statement"]
                    }
                  },
                  explanation: { type: "STRING" }
                },
                required: ["topic", "details", "explanation"]
              }
            }
          }
        }
      }
    };

    // ✅ Correct model for your key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const message = body?.error?.message || `Upstream ${upstream.status}`;
      return res.status(502).json({ error: message });
    }

    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(502).json({ error: 'Unexpected model output.' });
    }

    return res.json(JSON.parse(text));

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Server on http://localhost:${port}`));
