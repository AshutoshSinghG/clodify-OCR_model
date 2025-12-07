const Tesseract = require('tesseract.js');

const CHARACTER_CONFUSIONS = {
    'W': ['V'], 'V': ['W'],
    'I': ['1'], '1': ['I'],
    'O': ['0'], '0': ['O'],
    'S': ['5'], '5': ['S']
};

function generateCorrectionVariants(text) {
    const variants = [text];
    if (text.includes('W')) variants.push(text.replace(/W/g, 'V'));
    return variants;
}

async function recognizeWithConfig(imageBuffer, psmMode) {
    const worker = await Tesseract.createWorker('eng');
    try {
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            tessedit_pageseg_mode: psmMode
        });
        const { data: { text, confidence } } = await worker.recognize(imageBuffer);
        return { text, confidence };
    } finally {
        await worker.terminate();
    }
}

async function recognizeWithTesseract(imageBuffer) {
    const strategies = [
        { mode: Tesseract.PSM.SINGLE_WORD, name: 'SINGLE_WORD' },
        { mode: Tesseract.PSM.SINGLE_LINE, name: 'SINGLE_LINE' },
        { mode: Tesseract.PSM.SINGLE_BLOCK, name: 'SINGLE_BLOCK' }
    ];

    let bestResult = '';
    let bestConfidence = 0;
    const allVariants = new Set();

    for (const strategy of strategies) {
        try {
            console.log(`  Trying ${strategy.name}...`);
            const { text, confidence } = await recognizeWithConfig(imageBuffer, strategy.mode);
            const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

            console.log(`  Raw: "${text}" → Cleaned: "${cleaned}" (${cleaned.length} chars, conf: ${confidence?.toFixed(1)}%)`);

            if (!cleaned) continue;

            let validResult = '';

            // Accept and normalize to exactly 4 characters
            if (cleaned.length === 4) {
                validResult = cleaned;
                console.log(`  ✓ Perfect 4 chars: "${validResult}"`);
            } else if (cleaned.length > 4) {
                // Extract first 4 alphanumeric characters
                validResult = cleaned.substring(0, 4);
                console.log(`  ✂️ Trimmed to 4: "${validResult}" (from ${cleaned.length} chars)`);
            } else if (cleaned.length === 3) {
                // If 3 chars, might still be valid - keep it
                validResult = cleaned;
                console.log(`  ⚠ Only 3 chars: "${validResult}"`);
            }

            if (validResult.length >= 3 && validResult.length <= 4) {
                // Normalize to exactly 4 characters by padding if needed
                if (validResult.length === 3) {
                    // Skip 3-char results for now, prefer 4-char
                    console.log(`  Skipping 3-char result, looking for better match`);
                } else {
                    const variants = generateCorrectionVariants(validResult);
                    variants.forEach(v => { if (v.length === 4) allVariants.add(v); });

                    if (confidence > bestConfidence || bestResult.length < 4) {
                        bestConfidence = confidence;
                        bestResult = validResult;
                    }

                    if (confidence > 80 && validResult.length === 4) {
                        console.log(`  ✓ High confidence 4-char result: "${validResult}"`);
                        return { text: validResult, variants: Array.from(allVariants) };
                    }
                }
            }
        } catch (err) {
            console.log(`  ${strategy.name} failed: ${err.message}`);
        }
    }

    // If we have a valid result (even 3 chars), use it
    if (bestResult.length >= 3) {
        if (bestResult.length === 3) {
            // Pad with most common letter or just use as-is
            console.log(`  ⚠ Best result is 3 chars: "${bestResult}" - using as-is`);
        }
        console.log(`  Using best result: "${bestResult}" (${bestConfidence?.toFixed(1)}% conf)`);
        return { text: bestResult, variants: Array.from(allVariants) };
    }

    throw new Error('No valid result found (need at least 3 characters)');
}

async function recognizeText(imageBuffer) {
    const result = await recognizeWithTesseract(imageBuffer);
    return {
        solution: result.text,
        alternatives: result.variants || []
    };
}

module.exports = {
    recognizeText,
    recognizeWithTesseract,
    generateCorrectionVariants
};
