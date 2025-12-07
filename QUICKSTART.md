# 🚀 Quick Start Guide

## Installation

```bash
cd "a:\Compnies Task\Cloudify"
npm install
```

## Run Server

```bash
npm start
```

Server will start on **http://localhost:3000**

## Test Endpoints

### Health Check
```bash
curl http://localhost:3000/
```

Expected: `{"ok":true}`

### OCR Test
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"captcha":"data:image/png;base64,YOUR_BASE64_HERE"}'
```

Expected: `{"solution":"ATLK"}`

## Run Tests

```bash
node test.js
```

## Deploy with ngrok

```bash
# Terminal 1: Keep server running
npm start

# Terminal 2: Start ngrok
ngrok http 3000
```

Use the https URL provided by ngrok to access publicly.

---

For complete documentation, see [README.md](file:///a:/Compnies%20Task/Cloudify/README.md)
