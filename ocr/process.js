const sharp = require('sharp');

/**
 * CAPTCHA-specific preprocessing with noise removal and morphological operations
 */
async function preprocessImage(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const metadata = await sharp(imageBuffer).metadata();
        console.log(`  Original: ${metadata.width}x${metadata.height}`);

        // Multi-stage preprocessing optimized for CAPTCHAs
        const processedBuffer = await sharp(imageBuffer)
            // Stage 1: Convert to grayscale
            .grayscale()

            // Stage 2: Very strong denoise using blur then sharpen
            .blur(0.3)

            // Stage 3: Extreme contrast for CAPTCHA text
            .linear(2.5, -(128 * 2.5) + 128)

            // Stage 4: Normalize histogram
            .normalize()

            // Stage 5: Scale up significantly for better character recognition  
            .resize({
                width: 2000,
                height: 1000,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                kernel: 'lanczos3'
            })

            // Stage 6: Binary thresholding - very aggressive
            .threshold(110)

            // Stage 7: Remove salt-and-pepper noise
            .median(2)

            // Stage 8: Extreme sharpening to make characters crisp
            .sharpen({
                sigma: 4.0,
                m1: 3.0,
                m2: 3.0
            })

            .png()
            .toBuffer();

        console.log(`  Preprocessed: ${processedBuffer.length} bytes`);
        return processedBuffer;
    } catch (error) {
        console.error('Preprocessing error:', error.message);
        throw new Error(`Preprocessing failed: ${error.message}`);
    }
}

/**
 * Inverted preprocessing - sometimes CAPTCHAs work better inverted
 */
async function preprocessImageAggressive(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('  Using inverted preprocessing');

        const processedBuffer = await sharp(imageBuffer)
            .grayscale()
            .blur(0.5)
            .linear(3.0, -(128 * 3.0) + 128)
            .normalize()
            .resize({
                width: 2000,
                height: 1000,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 },
                kernel: 'lanczos3'
            })
            // Inverted threshold
            .negate()
            .threshold(110)
            .negate()
            .median(1)
            .sharpen({
                sigma: 4.5,
                m1: 3.5,
                m2: 3.5
            })
            .png()
            .toBuffer();

        console.log(`  Inverted preprocessing: ${processedBuffer.length} bytes`);
        return processedBuffer;
    } catch (error) {
        console.error('Aggressive preprocessing error:', error.message);
        throw new Error(`Aggressive preprocessing failed: ${error.message}`);
    }
}

/**
 * Light preprocessing for already clean images
 */
async function preprocessImageLight(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('  Using minimal preprocessing');

        const processedBuffer = await sharp(imageBuffer)
            .grayscale()
            .normalize()
            .resize({
                width: 1600,
                height: 800,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                kernel: 'lanczos3'
            })
            .threshold(128)
            .sharpen({ sigma: 2.0 })
            .png()
            .toBuffer();

        console.log(`  Light preprocessing: ${processedBuffer.length} bytes`);
        return processedBuffer;
    } catch (error) {
        throw new Error(`Light preprocessing failed: ${error.message}`);
    }
}

module.exports = {
    preprocessImage,
    preprocessImageAggressive,
    preprocessImageLight
};
