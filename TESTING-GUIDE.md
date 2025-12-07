# 🔬 OCR CAPTCHA Solver - Enhanced Version & Testing Guide

## 🚀 Recent Improvements

The OCR engine has been significantly enhanced to handle more challenging CAPTCHAs:

### Enhanced OCR Engine (`ocr/recognize.js`)

**Multiple PSM Strategies**:
The engine now tries 4 different Page Segmentation Modes automatically:
1. **PSM 6** - SINGLE_BLOCK: Treats the image as a single uniform block of text
2. **PSM 7** - SINGLE_LINE: Assumes a single line of text
3. **PSM 8** - SINGLE_WORD: Treats the image as a single word
4. **PSM 13** - RAW_LINE: Raw line without using Tesseract's dictionary

The system tries each mode and picks the best result based on:
- Character count (4-6 is ideal for CAPTCHAs)
- Overall length (more characters usually means better recognition)

### Enhanced Preprocessing (`ocr/process.js`)

**Standard Preprocessing**:
- Higher contrast boost (1.5x linear adjustment)
- Larger resize (600x300 instead of 400x200)
- Better threshold value (140 instead of 128)
- Median filter for noise removal
- Stronger sharpening (sigma=2.0)

**Aggressive Preprocessing** (automatic fallback):
- Very high contrast boost (2.0x)
- Even larger resize (800x400)
- Very aggressive threshold (160)
- Strong median filter (kernel=3)
- Maximum sharpening (sigma=3.0, m1=2.0, m2=2.0)

---

## 🧪 Testing Your CAPTCHA

### Method 1: Using curl

```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"captcha":"YOUR_COMPLETE_BASE64_STRING_HERE"}'
```

**Important**: Make sure your base64 string is complete and includes the full image data.

### Method 2: Using Postman

1. Set method to `POST`
2. URL: `http://localhost:3000/`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "captcha": "data:image/png;base64,iVBORw0KGgo...COMPLETE_BASE64_HERE...5ErkJggg=="
}
```

### Method 3: Using JavaScript/Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

// Option A: From base64 string
async function testWithBase64(base64String) {
  const response = await axios.post('http://localhost:3000/', {
    captcha: base64String
  });
  console.log('Solution:', response.data.solution);
}

// Option B: From image file
async function testWithImageFile(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const base64WithPrefix = `data:image/png;base64,${base64}`;
  
  const response = await axios.post('http://localhost:3000/', {
    captcha: base64WithPrefix
  });
  console.log('Solution:', response.data.solution);
}

// Usage
testWithImageFile('./captcha-sample.png');
```

---

## 📊 Server Log Output

When you send a request, you'll see detailed logs like this:

```
========================================
New OCR Request Received
========================================
Timestamp: 2025-12-07T12:01:30.123Z
Captcha length: 25678 characters

[1/3] Preprocessing image...
  Original image: 200x100, format: png
  Preprocessed image: 45678 bytes
✓ Image preprocessed (45678 bytes)

[2/3] Performing OCR recognition...
  Trying SINGLE_BLOCK (PSM 6)...
  OCR Progress: 100%
  Result: "ATLK" (confidence: 87.45%)
  ✓ Found valid result: "ATLK"
✓ OCR completed: "ATLK"

[3/3] Validating result...
✓ Total processing time: 2840ms
========================================
```

---

## ❌ Troubleshooting

### Error: "OCR returned empty text"

**Possible Causes:**
1. Image quality is too poor
2. CAPTCHA uses unusual fonts or heavy distortion
3. Base64 string is truncated or corrupted

**Solutions:**

#### 1. Check your base64 string
Make sure it's complete:
```javascript
// Should start with: data:image/png;base64,iVBORw0KGgo...
// Should end with: ...5ErkJggg==

console.log('Base64 length:', captchaString.length);
// Typical length: 10,000 - 50,000 characters for CAPTCHA images
```

#### 2. Verify the image
Save the base64 as an actual image to inspect it:
```javascript
const fs = require('fs');
const base64Data = captchaString.replace(/^data:image\/\w+;base64,/, '');
const buffer = Buffer.from(base64Data, 'base64');
fs.writeFileSync('test-captcha.png', buffer);
// Open test-captcha.png to see if it's a valid CAPTCHA
```

#### 3. Try different preprocessing (manual)

If automatic fallback doesn't work, you can manually adjust parameters in `ocr/process.js`:

**For lighter CAPTCHAs** (light text on dark background):
```javascript
.threshold(100)  // Lower threshold (instead of 140)
```

**For darker CAPTCHAs** (dark text on light background):
```javascript
.threshold(180)  // Higher threshold (instead of 140)
```

**For very noisy CAPTCHAs**:
```javascript
.median(5)  // Stronger noise reduction (instead of 2)
```

---

## 🔧 Advanced: Saving Preprocessed Images for Debugging

Add this to `index.js` after preprocessing:

```javascript
const fs = require('fs');

// After line: const processedImage = await preprocessImage(captcha);
// Add:
fs.writeFileSync('debug-preprocessed.png', processedImage);
console.log('Saved preprocessed image to debug-preprocessed.png');
```

This lets you see exactly what image is being sent to OCR.

---

## 🎯 Expected Results

**For good quality CAPTCHAs**:
- Processing time: 2-5 seconds
- Confidence: 80%+
- Result: Correct text (4-6 characters)

**For challenging CAPTCHAs**:
- Processing time: 5-10 seconds (tries multiple strategies)
- Confidence: 60-80%
- Result: May require manual verification

**For extremely distorted CAPTCHAs**:
- May return incorrect text or empty result
- Consider:
  - Training a custom OCR model
  - Using a different OCR engine (EasyOCR, PaddleOCR)
  - Manual solving

---

## 📝 Example Test Cases

### Test Case 1: Simple CAPTCHA
```json
{
  "captcha": "data:image/png;base64,iVBORw0KGgoAAAA..."
}
```
**Expected**: Quick recognition (2-3s), high confidence

### Test Case 2: Noisy CAPTCHA
```json
{
  "captcha": "data:image/png;base64,iVBORw0KGgoAAAA..."
}
```
**Expected**: Multiple PSM attempts, aggressive preprocessing fallback

### Test Case 3: Rotated Text
```json
{
  "captcha": "data:image/png;base64,iVBORw0KGgoAAAA..."
}
```
**Expected**: May fail - current version doesn't handle rotation
**Solution**: Add rotation correction to preprocessing

---

## 🚀 Next Steps If OCR Still Fails

### Option 1: Use EasyOCR (Python-based, more accurate)

1. Install Python and EasyOCR
2. Create a Python microservice
3. Call it from Node.js

### Option 2: Train a Custom Model

1. Collect 1000+ CAPTCHA samples
2. Label them manually
3. Train a CNN model (TensorFlow.js or PyTorch)
4. Export to ONNX and use in Node.js

### Option 3: Use External OCR API

Consider commercial services:
- Google Cloud Vision API
- AWS Textract
- Azure Computer Vision
- OCR.space API

---

## 📊 Performance Optimization

For high-volume processing:

### 1. Use Worker Threads
```javascript
const { Worker } = require('worker_threads');
// Process multiple CAPTCHAs in parallel
```

### 2. Cache Tesseract Workers
```javascript
// Keep workers alive instead of creating new ones
const workerPool = [];
```

### 3. Add Request Queue
```javascript
const Queue = require('bull');
// Queue requests during high load
```

---

## ✅ Current Capabilities

- ✅ Automatic multi-strategy recognition
- ✅ Fallback preprocessing
- ✅ Detailed logging
- ✅ Error handling
- ✅ Multiple PSM modes
- ✅ Noise removal
- ✅ Contrast enhancement

## ⚠️ Limitations

- ❌ Doesn't handle rotated text
- ❌ Struggles with heavy distortion
- ❌ No support for colored text requirements
- ❌ Limited to Latin characters (A-Z, 0-9)

---

## 💡 Tips for Best Results

1. **Image Quality**: Higher resolution images work better (min 200x100)
2. **Format**: PNG works best, JPEG may lose quality
3. **Colors**: Simple black/white CAPTCHAs are easier
4. **Fonts**: Standard fonts work better than decorative ones
5. **Noise**: Less background noise = better results

---

For more details, see [README.md](file:///a:/Compnies%20Task/Cloudify/README.md)
