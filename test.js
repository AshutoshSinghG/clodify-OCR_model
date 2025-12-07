const axios = require('axios');

// Test the OCR service with a sample CAPTCHA
async function testOCRService() {
    console.log('='.repeat(50));
    console.log('OCR CAPTCHA Solver - Test Script');
    console.log('='.repeat(50));

    // Test 1: Health Check
    console.log('\n[Test 1] Health Check...');
    try {
        const healthResponse = await axios.get('http://localhost:3000/');
        console.log('✓ Health check passed:', healthResponse.data);
    } catch (error) {
        console.error('✗ Health check failed:', error.message);
        return;
    }

    // Test 2: OCR with Sample Image
    console.log('\n[Test 2] OCR Test...');

    // Sample CAPTCHA image (4-letter CAPTCHA: "TEST")
    // This is a simple test image - replace with actual CAPTCHA for real testing
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    try {
        const ocrResponse = await axios.post('http://localhost:3000/', {
            captcha: sampleBase64
        });

        console.log('✓ OCR Response:', ocrResponse.data);
        console.log('  Solution:', ocrResponse.data.solution);

    } catch (error) {
        if (error.response) {
            console.error('✗ OCR failed:', error.response.data);
        } else {
            console.error('✗ OCR request failed:', error.message);
        }
    }

    // Test 3: Error Handling - Missing captcha field
    console.log('\n[Test 3] Error Handling Test (missing captcha field)...');
    try {
        await axios.post('http://localhost:3000/', {});
    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.log('✓ Correctly rejected invalid request:', error.response.data);
        } else {
            console.error('✗ Unexpected error:', error.message);
        }
    }

    // Test 4: Error Handling - Invalid base64
    console.log('\n[Test 4] Error Handling Test (invalid base64)...');
    try {
        await axios.post('http://localhost:3000/', {
            captcha: 'not-valid-base64'
        });
    } catch (error) {
        if (error.response && error.response.status === 500) {
            console.log('✓ Correctly handled invalid base64:', error.response.data.error);
        } else {
            console.error('✗ Unexpected error:', error.message);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('All tests completed!');
    console.log('='.repeat(50));
}

// Run tests
testOCRService().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
