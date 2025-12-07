const sharp = require('sharp');

/**
 * Preprocesses the CAPTCHA image to improve OCR accuracy
 * 
 * Standard preprocessing pipeline optimized for V vs W distinction
 * 
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<Buffer>} - Processed image buffer ready for OCR
 */
async function preprocessImage(base64Image) {
    try {
        // Remove data:image/png;base64, prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        console.log(`  Original image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

        // Apply preprocessing pipeline using Sharp
        // Enhanced for better V vs W distinction
        const processedBuffer = await sharp(imageBuffer)
            // Convert to grayscale (removes color noise)
            .grayscale()

            // Increase contrast significantly - helps distinguish V from W
            .linear(1.8, -(128 * 1.8) + 128)

            // Normalize to improve contrast
            .normalize()

            // Resize BEFORE thresholding (helps with OCR accuracy)
            // Using larger size for better V/W distinction
            .resize({
                width: 800,
                height: 400,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                kernel: 'lanczos3'
            })

            // Apply threshold to create binary image
            // Using lower threshold to preserve character details
            .threshold(130)

            // Remove noise with median filter (smaller kernel to preserve details)
            .median(1)

            // Sharpen to enhance edges of characters - critical for V vs W
            .sharpen({
                sigma: 2.5,
                m1: 1.5,
                m2: 1.5
            })

            // Output as PNG buffer
            .png()
            .toBuffer();

        console.log(`  Preprocessed image: ${processedBuffer.length} bytes`);

        return processedBuffer;
    } catch (error) {
        console.error('Error preprocessing image:', error.message);
        throw new Error(`Image preprocessing failed: ${error.message}`);
    }
}

/**
 * Aggressive preprocessing for difficult CAPTCHAs
 * 
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<Buffer>} - Processed image buffer
 */
async function preprocessImageAggressive(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('  Applying aggressive preprocessing...');

        const processedBuffer = await sharp(imageBuffer)
            .grayscale()

            // Very high contrast boost
            .linear(2.0, -(128 * 2.0) + 128)

            .normalize()

            // Resize first with high quality
            .resize({
                width: 1000,
                height: 500,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                kernel: 'lanczos3'
            })

            // Moderate threshold to preserve details
            .threshold(135)

            // Minimal noise reduction
            .median(1)

            // Very strong sharpening for edge enhancement
            .sharpen({
                sigma: 3.0,
                m1: 2.0,
                m2: 2.0
            })

            .png()
            .toBuffer();

        console.log(`  Aggressive preprocessing complete: ${processedBuffer.length} bytes`);

        return processedBuffer;
    } catch (error) {
        console.error('Error in aggressive preprocessing:', error.message);
        throw new Error(`Aggressive preprocessing failed: ${error.message}`);
    }
}

module.exports = {
    preprocessImage,
    preprocessImageAggressive
};
