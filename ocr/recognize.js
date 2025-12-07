const Tesseract = require('tesseract.js');

/**
 * OCR Engine Configuration
 * 
 * This module provides a modular interface for OCR engines.
 * Currently uses Tesseract.js but can be easily swapped with other engines.
 */

/**
 * Recognizes text using a specific PSM mode
 * 
 * @param {Buffer} imageBuffer - Preprocessed image buffer
 * @param {number} psmMode - Page Segmentation Mode
 * @param {string} whitelist - Character whitelist
 * @returns {Promise<Object>} - {text, confidence}
 */
async function recognizeWithConfig(imageBuffer, psmMode, whitelist = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                console.log(`  OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        }
    });

    try {
        // Configure Tesseract
        await worker.setParameters({
            tessedit_char_whitelist: whitelist,
            tessedit_pageseg_mode: psmMode,
        });

        // Perform OCR
        const { data: { text, confidence } } = await worker.recognize(imageBuffer);

        return { text, confidence };
    } finally {
        await worker.terminate();
    }
}

/**
 * Recognizes text using multiple PSM strategies
 * 
 * @param {Buffer} imageBuffer - Preprocessed image buffer
 * @returns {Promise<string>} - Recognized and cleaned text
 */
async function recognizeWithTesseract(imageBuffer) {
    try {
        const strategies = [
            { mode: Tesseract.PSM.SINGLE_BLOCK, name: 'SINGLE_BLOCK (PSM 6)' },
            { mode: Tesseract.PSM.SINGLE_LINE, name: 'SINGLE_LINE (PSM 7)' },
            { mode: Tesseract.PSM.SINGLE_WORD, name: 'SINGLE_WORD (PSM 8)' },
            { mode: Tesseract.PSM.RAW_LINE, name: 'RAW_LINE (PSM 13)' },
        ];

        let bestResult = '';
        let bestLength = 0;
        let bestRawText = '';

        // Try multiple PSM modes to find the best result
        for (const strategy of strategies) {
            try {
                console.log(`  Trying ${strategy.name}...`);
                const { text, confidence } = await recognizeWithConfig(imageBuffer, strategy.mode);
                const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

                console.log(`  Raw text: "${text}"`);
                console.log(`  Cleaned: "${cleaned}" (confidence: ${confidence?.toFixed(2)}%)`);

                // Keep the result with the most characters (likely more accurate)
                if (cleaned.length > bestLength) {
                    bestLength = cleaned.length;
                    bestResult = cleaned;
                    bestRawText = text;
                }

                // If we got a good result (4-6 chars), we can stop
                if (cleaned.length >= 4 && cleaned.length <= 6) {
                    console.log(`  ✓ Found valid result: "${cleaned}"`);
                    return cleaned;
                }
            } catch (err) {
                console.log(`  Strategy ${strategy.name} failed:`, err.message);
            }
        }

        // If no strategy produced a valid result, return the best we got
        if (bestResult.length > 0) {
            console.log(`  Using best result: "${bestResult}" (from raw: "${bestRawText}")`);
            return bestResult;
        }

        throw new Error('OCR returned empty text from all strategies');
    } catch (error) {
        console.error('Tesseract OCR error:', error.message);
        throw new Error(`OCR recognition failed: ${error.message}`);
    }
}

/**
 * Cleans OCR output according to CAPTCHA requirements
 * 
 * @param {string} rawText - Raw text from OCR engine
 * @returns {string} - Cleaned text
 */
function cleanOCROutput(rawText) {
    if (!rawText) {
        throw new Error('OCR returned empty text');
    }

    // Convert to uppercase and remove all non-alphanumeric characters
    let cleaned = rawText
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    return cleaned;
}

/**
 * Main OCR function with retry logic
 * 
 * @param {Buffer} imageBuffer - Preprocessed image buffer
 * @returns {Promise<string>} - Recognized text
 */
async function recognizeText(imageBuffer) {
    try {
        // Primary attempt with Tesseract (tries multiple PSM modes)
        const result = await recognizeWithTesseract(imageBuffer);

        if (result && result.length >= 1) {
            return result;
        }

        throw new Error('OCR returned insufficient text');
    } catch (error) {
        console.error('OCR recognition error:', error.message);
        throw error;
    }
}

module.exports = {
    recognizeText,
    recognizeWithTesseract,
    cleanOCROutput
};
