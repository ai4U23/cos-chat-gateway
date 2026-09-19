# ai4U CoS Unified Chat Gateway

Lightweight, high-performance Vercel serverless gateway for the **ai4U Chief of Staff** cloud relay.

## Routes
- `GET /api/whatsapp`: Meta webhook challenge verification handshake (`hub.challenge`).
- `POST /api/whatsapp`: Meta WhatsApp Cloud API webhooks (returns 200 OK in ~20ms, forwards to Google Apps Script).
- `POST /api/telegram`: Telegram Bot webhooks.
- `POST /api/zalo`: Zalo Bot webhooks.
- `GET /health`: Health probe.
