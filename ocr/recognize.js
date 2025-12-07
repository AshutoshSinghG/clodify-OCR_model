const Tesseract = require('tesseract.js');

function generateCorrectionVariants(text) {
    const variants = [text];
    if (text.includes('W')) variants.push(text.replace(/W/g, 'V'));
    if (text.includes('V')) variants.push(text.replace(/V/g, 'W'));
    if (text.includes('0')) variants.push(text.replace(/0/g, 'O'));
    if (text.includes('O')) variants.push(text.replace(/O/g, '0'));
    if (text.includes('1')) variants.push(text.replace(/1/g, 'I'));
    if (text.includes('I')) variants.push(text.replace(/I/g, '1'));
    return [...new Set(variants)];
}

async function recognizeWithConfig(imageBuffer, psmMode) {
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => { } // Suppress logging
    });

    try {
        // Set only runtime parameters (not initialization parameters)
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            tessedit_pageseg_mode: psmMode,
        });

        const { data: { text, confidence } } = await worker.recognize(imageBuffer);
        return { text, confidence };
    } finally {
        await worker.terminate();
    }
}

async function recognizeWithTesseract(imageBuffer) {
    // Try multiple PSM modes
    const strategies = [
        { mode: Tesseract.PSM.SINGLE_LINE, name: 'LINE' },
        { mode: Tesseract.PSM.SINGLE_WORD, name: 'WORD' },
        { mode: Tesseract.PSM.RAW_LINE, name: 'RAW' },
        { mode: Tesseract.PSM.SINGLE_BLOCK, name: 'BLOCK' }
    ];

    const results = [];

    console.log('  Running OCR with multiple PSM modes...');
    for (const strategy of strategies) {
        try {
            const { text, confidence } = await recognizeWithConfig(imageBuffer, strategy.mode);
            const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

            if (cleaned.length >= 3) {
                results.push({
                    text: cleaned,
                    confidence: confidence || 0,
                    mode: strategy.name
                });
                console.log(`    ${strategy.name}: "${cleaned}" (${confidence?.toFixed(1)}%)`);
            }
        } catch (err) {
            console.log(`    ${strategy.name}: failed`);
        }
    }

    if (results.length === 0) {
        throw new Error('No valid OCR results');
    }

    // Sort by: 1) length (prefer 4), 2) confidence
    results.sort((a, b) => {
        const aIs4 = a.text.length === 4 ? 1 : 0;
        const bIs4 = b.text.length === 4 ? 1 : 0;
        if (aIs4 !== bIs4) return bIs4 - aIs4;
        return b.confidence - a.confidence;
    });

    const best = results[0];

    // Ensure exactly 4 characters
    let finalText = best.text;
    if (finalText.length > 4) {
        finalText = finalText.substring(0, 4);
    }

    console.log(`  ✓ Selected: "${finalText}" (${best.mode}, ${best.confidence.toFixed(1)}%)`);

    const variants = generateCorrectionVariants(finalText);
    return {
        text: finalText,
        variants,
        confidence: best.confidence,
        allResults: results.map(r => `${r.text}(${r.confidence.toFixed(0)}%)`)
    };
}

async function recognizeText(imageBuffer) {
    try {
        const result = await recognizeWithTesseract(imageBuffer);
        return {
            solution: result.text,
            alternatives: result.variants,
            confidence: result.confidence,
            allResults: result.allResults
        };
    } catch (error) {
        console.error('  OCR error:', error.message);
        throw error;
    }
}

module.exports = {
    recognizeText,
    recognizeWithTesseract,
    generateCorrectionVariants
};
