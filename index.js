const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const { preprocessImage, preprocessImageAggressive } = require('./ocr/process');
const { recognizeText } = require('./ocr/recognize');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Enable CORS for all origins
app.use(cors());

// Request logging
app.use(morgan('combined'));

// JSON body parser with 20MB limit for base64 images
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ============================================
// ROUTES
// ============================================

/**
 * Health Check Endpoint
 * GET /
 * 
 * Returns: { "ok": true }
 */
app.get('/', (req, res) => {
    res.json({ ok: true });
});

/**
 * OCR CAPTCHA Solving Endpoint
 * POST /
 * 
 * Request Body:
 * {
 *   "captcha": "base64_image_string"
 * }
 * 
 * Response:
 * {
 *   "solution": "DECODED_TEXT"
 * }
 */
app.post('/', async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
        // Validate request body
        const { captcha } = req.body;

        if (!captcha) {
            return res.status(400).json({
                error: 'Missing required field: captcha'
            });
        }

        if (typeof captcha !== 'string') {
            return res.status(400).json({
                error: 'Invalid captcha format: must be a base64 string'
            });
        }

        console.log('\n========================================');
        console.log(`🆔 Request ID: ${requestId}`);
        console.log('New OCR Request Received');
        console.log('========================================');
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log(`Captcha length: ${captcha.length} characters`);
        console.log(`First 50 chars: ${captcha.substring(0, 50)}...`);
        console.log(`Last 50 chars: ...${captcha.substring(captcha.length - 50)}`);

        // Step 1: Preprocess the image
        console.log('\n[1/3] Preprocessing image...');
        const processedImage = await preprocessImage(captcha);
        console.log(`✓ Image preprocessed (${processedImage.length} bytes)`);

        // Save debug image
        const debugPath = `debug-${requestId}.png`;
        fs.writeFileSync(debugPath, processedImage);
        console.log(`💾 Debug image saved: ${debugPath}`);

        // Step 2: Perform OCR
        console.log('\n[2/3] Performing OCR recognition...');
        let ocrResult = await recognizeText(processedImage);
        let solution = ocrResult.solution;
        let alternatives = ocrResult.alternatives || [];

        console.log(`✓ OCR completed: "${solution}"`);
        if (alternatives.length > 0) {
            console.log(`📋 Alternative interpretations: ${alternatives.join(', ')}`);
        }

        // Step 3: Validate and return
        console.log('\n[3/3] Validating result...');

        if (!solution || solution.length < 4) {
            console.log('⚠ Primary OCR yielded insufficient result, trying aggressive preprocessing...');

            // Fallback: try aggressive preprocessing
            const processedImageAggressive = await preprocessImageAggressive(captcha);
            const debugPathAggressive = `debug-${requestId}-aggressive.png`;
            fs.writeFileSync(debugPathAggressive, processedImageAggressive);
            console.log(`💾 Aggressive debug image saved: ${debugPathAggressive}`);

            ocrResult = await recognizeText(processedImageAggressive);
            solution = ocrResult.solution;
            alternatives = ocrResult.alternatives || [];

            console.log(`✓ Aggressive OCR result: "${solution}"`);
            if (alternatives.length > 0) {
                console.log(`📋 Aggressive alternatives: ${alternatives.join(', ')}`);
            }
        }

        // Smart correction: Prefer V over W in 4-letter words
        if (solution.includes('W') && solution.length === 4) {
            const versionWithV = solution.replace(/W/g, 'V');
            if (alternatives.includes(versionWithV)) {
                console.log(`🔄 Smart correction: "${solution}" -> "${versionWithV}" (V is more common than W)`);
                solution = versionWithV;
            }
        }

        const processingTime = Date.now() - startTime;
        console.log(`\n✅ Request ${requestId} completed`);
        console.log(`📊 Total processing time: ${processingTime}ms`);
        console.log(`🎯 Final solution: "${solution}"`);
        console.log('========================================\n');

        // Return clean response (only solution field)
        res.json({
            solution: solution
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('\n========================================');
        console.error(`❌ Request ${requestId} failed`);
        console.error('OCR Processing Error');
        console.error('========================================');
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        console.error(`Processing time: ${processingTime}ms`);
        console.error('========================================\n');

        res.status(500).json({
            error: 'OCR processing failed',
            message: error.message,
            requestId: requestId
        });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);

    res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 OCR CAPTCHA Solver Server Started');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/`);
    console.log(`OCR Endpoint: POST http://localhost:${PORT}/`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('✨ V/W correction enabled');
    console.log('========================================\n');
});

module.exports = app;
