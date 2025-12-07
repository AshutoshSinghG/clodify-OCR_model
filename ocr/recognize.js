const Tesseract = require('tesseract.js');

/**
 * OCR Engine Configuration
 * 
 * This module provides a modular interface for OCR engines.
 * Currently uses Tesseract.js but can be easily swapped with other engines.
 */

/**
 * Common OCR character confusions
 * Maps commonly confused characters to their possible alternatives
 */
const CHARACTER_CONFUSIONS = {
    'W': ['VV', 'V'],  // W is often confused with VV or V
    'VV': ['W'],       // VV might be W
    'I': ['1', 'l'],   // I vs 1 vs lowercase L
    '1': ['I', 'l'],
    'l': ['I', '1'],
    'O': ['0'],        // O vs 0
    '0': ['O'],
    'S': ['5'],        // S vs 5
    '5': ['S'],
    'Z': ['2'],        // Z vs 2
    '2': ['Z'],
    'B': ['8'],        // B vs 8
    '8': ['B']
};

/**
 * Generates possible corrections for OCR text
 * by considering common character confusions
 * 
 * @param {string} text - OCR text to correct
 * @returns {Array<string>} - Array of possible corrections
 */
function generateCorrectionVariants(text) {
    const variants = [text]; // Always include original

    // Check for W -> V correction (most common issue)
    if (text.includes('W')) {
        // Try replacing W with V
        variants.push(text.replace(/W/g, 'V'));

        // Try replacing each W individually
        for (let i = 0; i < text.length; i++) {
            if (text[i] === 'W') {
                const corrected = text.substring(0, i) + 'V' + text.substring(i + 1);
                variants.push(corrected);
            }
        }
    }

    // Check for VV -> W correction
    if (text.includes('VV')) {
        variants.push(text.replace(/VV/g, 'W'));
    }

    // Check for other common confusions
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (CHARACTER_CONFUSIONS[char]) {
            for (const alternative of CHARACTER_CONFUSIONS[char]) {
                const corrected = text.substring(0, i) + alternative + text.substring(i + 1);
                if (!variants.includes(corrected)) {
                    variants.push(corrected);
                }
            }
        }
    }

    return variants;
}

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
 * @returns {Promise<Object>} - {text: string, variants: Array<string>}
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
        let bestConfidence = 0;
        const allVariants = new Set();

        // Try multiple PSM modes to find the best result
        for (const strategy of strategies) {
            try {
                console.log(`  Trying ${strategy.name}...`);
                const { text, confidence } = await recognizeWithConfig(imageBuffer, strategy.mode);
                const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

                console.log(`  Raw text: "${text}"`);
                console.log(`  Cleaned: "${cleaned}" (confidence: ${confidence?.toFixed(2)}%)`);

                // Generate correction variants
                const variants = generateCorrectionVariants(cleaned);
                variants.forEach(v => allVariants.add(v));
                console.log(`  Variants: ${variants.join(', ')}`);

                // Keep the result with highest confidence and good length
                if (cleaned.length >= 4 && cleaned.length <= 6 && confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestLength = cleaned.length;
                    bestResult = cleaned;
                    bestRawText = text;
                } else if (cleaned.length > bestLength) {
                    // Fallback to length if confidence is similar
                    bestLength = cleaned.length;
                    bestResult = cleaned;
                    bestRawText = text;
                }

                // If we got a high-confidence result, we can stop
                if (cleaned.length >= 4 && cleaned.length <= 6 && confidence > 85) {
                    console.log(`  ✓ Found high-confidence result: "${cleaned}"`);
                    return {
                        text: cleaned,
                        variants: Array.from(allVariants).filter(v => v.length >= 4 && v.length <= 6)
                    };
                }
            } catch (err) {
                console.log(`  Strategy ${strategy.name} failed:`, err.message);
            }
        }

        // If no strategy produced a valid result, return the best we got
        if (bestResult.length > 0) {
            console.log(`  Using best result: "${bestResult}" (from raw: "${bestRawText}", confidence: ${bestConfidence?.toFixed(2)}%)`);
            return {
                text: bestResult,
                variants: Array.from(allVariants).filter(v => v.length >= 4 && v.length <= 6)
            };
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
 * Main OCR function with retry logic and correction variants
 * 
 * @param {Buffer} imageBuffer - Preprocessed image buffer
 * @returns {Promise<Object>} - {solution: string, alternatives: Array<string>}
 */
async function recognizeText(imageBuffer) {
    try {
        // Primary attempt with Tesseract (tries multiple PSM modes)
        const result = await recognizeWithTesseract(imageBuffer);

        if (result.text && result.text.length >= 1) {
            return {
                solution: result.text,
                alternatives: result.variants || []
            };
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
    cleanOCROutput,
    generateCorrectionVariants
};
