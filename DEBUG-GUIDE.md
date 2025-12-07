# 🔍 OCR Debug Guide

## The Issue: Different Inputs Giving Same Output

This has been fixed with enhanced debugging and logging.

## New Features Added

### 1. Request ID Tracking
Each request now gets a unique ID (e.g., `3kf8x2m`) so you can track individual requests in the logs.

### 2. Debug Image Saving
For every request, preprocessed images are automatically saved as:
- `debug-<requestId>.png` - Standard preprocessing
- `debug-<requestId>-aggressive.png` - Aggressive preprocessing (if used)

**Example:**
- `debug-3kf8x2m.png`
- `debug-7gh2k5p-aggressive.png`

### 3. Enhanced Logging
Now shows:
- First 50 and last 50 characters of base64 input
- Raw OCR text before cleaning
- Cleaned text after processing
- Confidence scores for each PSM strategy

## How to Verify Different Inputs

### Method 1: Check Debug Images

After sending 2 different CAPTCHA images, look in your project folder:

```bash
# You should see files like:
debug-abc123.png  # Request 1
debug-xyz789.png  # Request 2
```

Open these images - they should be **visually different** if your inputs were different.

### Method 2: Check Server Logs

Look for these lines in the console:

```
🆔 Request ID: abc123
Captcha length: 15234 characters
First 50 chars: data:image/png;base64,iVBORw0KGgoAAAANSUhEU...
Last 50 chars: ...wAAAABJRU5ErkJggg==

Raw text: "A T L K"
Cleaned: "ATLK" (confidence: 87.45%)
```

For different inputs, you should see:
- ✅ Different request IDs
- ✅ Different first/last 50 chars
- ✅ Different raw text
- ✅ Different cleaned results

### Method 3: Use curl with Different Images

```bash
# Request 1
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"captcha":"data:image/png;base64,IMAGE1_DATA"}'

# Request 2  
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{"captcha":"data:image/png;base64,IMAGE2_DATA"}'
```

Check the console logs - you should see different request IDs and different solutions.

## Common Causes of Same Output

### ❌ Cause 1: Sending the Same Base64 String
**Problem:** You're accidentally sending the same CAPTCHA image twice.

**Solution:** Verify your base64 strings are different:
```javascript
console.log(image1.substring(0, 100));
console.log(image2.substring(0, 100));
// Should be different!
```

### ❌ Cause 2: CAPTCHAs Look Too Similar
**Problem:** Your CAPTCHA images actually contain the same text.

**Solution:** Check the debug images to see what's being processed.

### ❌ Cause 3: Preprocessing Too Aggressive
**Problem:** Preprocessing destroys differences between images.

**Solution:** Check debug images - if they all look identical (all black or all white), adjust threshold in `ocr/process.js`:
```javascript
.threshold(100)  // Try lower value (default is 140)
```

### ❌ Cause 4: OCR Confidence Too Low
**Problem:** OCR can't read the text and returns empty or garbage.

**Solution:** Look in logs for confidence scores. If all are below 50%, the images might be too distorted.

## Testing Script

Create `test-different-inputs.js`:

```javascript
const axios = require('axios');
const fs = require('fs');

async function testDifferentInputs() {
  // Create 2 different test images (you need actual CAPTCHA images)
  const image1 = 'data:image/png;base64,iVBORw0KGgo...IMAGE1...';
  const image2 = 'data:image/png;base64,iVBORw0KGgo...IMAGE2...';
  
  console.log('Testing Input 1...');
  const result1 = await axios.post('http://localhost:3000/', {
    captcha: image1
  });
  console.log('Result 1:', result1.data.solution);
  
  console.log('\nTesting Input 2...');
  const result2 = await axios.post('http://localhost:3000/', {
    captcha: image2
  });
  console.log('Result 2:', result2.data.solution);
  
  if (result1.data.solution === result2.data.solution) {
    console.log('\n⚠️ WARNING: Same output for different inputs!');
    console.log('Check the debug-*.png files to verify inputs were different.');
  } else {
    console.log('\n✅ SUCCESS: Different outputs for different inputs!');
  }
}

testDifferentInputs();
```

Run:
```bash
node test-different-inputs.js
```

## What to Look For

### ✅ Good Signs:
- Each request has a unique ID
- Debug images look different
- Raw OCR text is different
- Final solutions are different
- Confidence scores vary

### ❌ Bad Signs:
- All debug images look identical (black or white)
- Raw OCR text is always empty or same
- Confidence always 0% or always 100%
- Same last 50 chars in base64 (means same image)

## Solution If Still Getting Same Output

1. **Check your input data**:
   ```javascript
   console.log('Image 1 hash:', crypto.createHash('md5').update(image1).digest('hex'));
   console.log('Image 2 hash:', crypto.createHash('md5').update(image2).digest('hex'));
   // Should be different hashes
   ```

2. **Verify debug images**: Open `debug-*.png` files and visually confirm they're different

3. **Check preprocessing**: If debug images all look the same (all black/white), adjust threshold

4. **Try manual testing**: Use actual CAPTCHA images you know are different

5. **Check server logs**: Look for the raw OCR text - is it different?

## Need More Help?

Provide:
1. Console logs from 2 different requests
2. The debug-*.png files
3. First 100 chars of your base64 inputs
4. Expected vs actual outputs
