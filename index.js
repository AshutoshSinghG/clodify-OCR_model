const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const { preprocessImage, preprocessImageAggressive, preprocessImageLight } = require('./ocr/process');
const { recognizeText } = require('./ocr/recognize');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ===============================
// HEALTH CHECK
// ===============================
app.get('/', (req, res) => {
    res.json({ ok: true });
});

// ===============================
// MAIN OCR ROUTE
// ===============================
app.post('/', async (req, res) => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    try {
        let { captcha } = req.body || {};

        // 🔥 Cloudify sometimes does NOT send JSON with Content-Type header
        if (!captcha) {
            const raw = req.body || req;
            const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
            const match = str.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
            if (match) captcha = match[0];
        }

        // ❗ If still no captcha found → MUST return valid JSON (not 400)
        if (!captcha) {
            return res.json({ solution: "" });
        }

        console.log(`\n=== New Request (${requestId}) ===`);
        console.log(`Captcha length: ${captcha.length}`);

        // =========== MULTI-STRATEGY OCR ==============
        const strategies = [
            { name: "Balanced", fn: () => preprocessImage(captcha) },
            { name: "Aggressive", fn: () => preprocessImageAggressive(captcha) },
            { name: "Light", fn: () => preprocessImageLight(captcha) },
        ];

        let best = { solution: "", confidence: 0 };

        for (const strategy of strategies) {
            try {
                const img = await strategy.fn();
                const ocr = await recognizeText(img);

                console.log(`→ ${strategy.name} = "${ocr.solution}" (${ocr.confidence}%)`);

                if (ocr.confidence > best.confidence) {
                    best = ocr;
                }
            } catch (err) {
                console.log(`⚠ ${strategy.name} failed: ${err.message}`);
            }
        }

        // =============== RESULT CLEANUP ===============
        let solution = (best.solution || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

        if (!solution) {
            // ❗ MUST RETURN valid JSON even if OCR fails
            return res.json({ solution: "" });
        }

        // Force solution into 3-6 characters range
        if (solution.length > 6) solution = solution.slice(0, 6);

        console.log(`🎯 Final Solution = "${solution}"`);
        console.log(`⏱ Time = ${Date.now() - startTime}ms`);
        console.log("============================================");

        return res.json({ solution });

    } catch (err) {
        console.log(`❌ ERROR (requestId ${requestId}): ${err.message}`);

        // 🔥 CRITICAL: Cloudify fails if 4xx/5xx returned → ALWAYS send JSON
        return res.json({ solution: "" });
    }
});

// ===============================
// 404 HANDLER (MUST NOT BREAK CHALLENGE)
// ===============================
app.use((req, res) => {
    return res.json({ solution: "" });
});

// ===============================
// GLOBAL FAIL-SAFE ERROR HANDLER
// ===============================
app.use((error, req, res, next) => {
    console.error("GLOBAL ERROR:", error);
    return res.json({ solution: "" });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
    console.log("\n========================================");
    console.log("🚀 OCR CAPTCHA Solver Server Started");
    console.log("========================================");
    console.log(`Port: ${PORT}`);
    console.log(`Health Check: GET  http://localhost:${PORT}/`);
    console.log(`OCR Endpoint: POST http://localhost:${PORT}/`);
    console.log("========================================\n");
});

module.exports = app;
