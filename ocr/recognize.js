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
        logger: () => { } // Suppress progress logging for cleaner output
    });

    try {
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            tessedit_pageseg_mode: psmMode,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            // Additional Tesseract parameters for better CAPTCHA recognition
            classify_bln_numeric_mode: '0',
            // Disable dictionary
            load_system_dawg: '0',
            load_freq_dawg: '0',
            load_unambig_dawg: '0',
            load_punc_dawg: '0',
            load_number_dawg: '0',
            load_fixed_length_dawgs: '0',
            load_bigram_dawg: '0',
        });

        const { data: { text, confidence } } = await worker.recognize(imageBuffer);
        return { text, confidence };
    } finally {
        await worker.terminate();
    }
}

async function recognizeWithTesseract(imageBuffer) {
    // Try multiple PSM modes - order matters, best first
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
            // Silent fail, try next mode
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
    const result = await recognizeWithTesseract(imageBuffer);
    return {
        solution: result.text,
        alternatives: result.variants,
        confidence: result.confidence,
        allResults: result.allResults
    };
}

module.exports = {
    recognizeText,
    recognizeWithTesseract,
    generateCorrectionVariants
};
