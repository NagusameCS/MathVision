/**
 * MathVision OCR Module
 * Uses Tesseract.js with image preprocessing for better accuracy
 */

const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Cache the worker for faster subsequent runs
let cachedWorker = null;

/**
 * Preprocess image for better OCR accuracy
 * - Convert to grayscale
 * - Increase contrast
 * - Apply sharpening
 * - Resize if too small
 */
async function preprocessImage(imagePath, enhance = true) {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    let pipeline = image;
    
    if (enhance) {
        // Resize if image is too small (improves OCR)
        if (metadata.width < 800) {
            const scale = 800 / metadata.width;
            pipeline = pipeline.resize(
                Math.round(metadata.width * scale),
                Math.round(metadata.height * scale),
                { kernel: 'lanczos3' }
            );
        }
        
        // Convert to grayscale
        pipeline = pipeline.grayscale();
        
        // Increase contrast and normalize
        pipeline = pipeline.normalize();
        
        // Sharpen for clearer edges
        pipeline = pipeline.sharpen({ sigma: 1.5 });
        
        // Apply threshold for cleaner text (binarization)
        pipeline = pipeline.threshold(140);
    }
    
    // Return as buffer
    return await pipeline.toBuffer();
}

/**
 * Get or create Tesseract worker
 */
async function getWorker() {
    if (cachedWorker) {
        return cachedWorker;
    }
    
    const worker = await Tesseract.createWorker('eng', 1, {
        // Use faster LSTM engine
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    });
    
    // Configure for math recognition
    await worker.setParameters({
        // Whitelist math characters for better accuracy
        tessedit_char_whitelist: '0123456789+-*/=()^.xyzabcXYZABCπ√∫∑sincostanlogln ',
        // Single block of text
        tessedit_pageseg_mode: '6',
    });
    
    cachedWorker = worker;
    return worker;
}

/**
 * Extract text from image
 * @param {string} imagePath - Path to image file
 * @param {boolean} enhance - Whether to preprocess image
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromImage(imagePath, enhance = true) {
    // Verify file exists
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // Preprocess image
    const imageBuffer = await preprocessImage(imagePath, enhance);
    
    // Get worker
    const worker = await getWorker();
    
    // Perform OCR
    const { data } = await worker.recognize(imageBuffer);
    
    // Clean and return text
    return cleanOCRText(data.text);
}

/**
 * Clean OCR output for math parsing
 */
function cleanOCRText(text) {
    return text
        // Common OCR misreads
        .replace(/[oO](?=\d|\s*[+\-*/=])/g, '0')  // O -> 0 in math context
        .replace(/(?<=\d)[oO]/g, '0')              // O after digit -> 0
        .replace(/[lI](?=\d|\s*[+\-*/=x])/g, '1') // l/I -> 1 in math context
        .replace(/(?<=\d)[lI]/g, '1')              // l/I after digit -> 1
        .replace(/[×✕xX](?=\s*\d)/g, '*')         // × -> * before number
        .replace(/[÷]/g, '/')
        .replace(/[−–—]/g, '-')
        .replace(/\s*=\s*/g, ' = ')
        .replace(/\s*\+\s*/g, ' + ')
        .replace(/\s*-\s*/g, ' - ')
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E\n]/g, '')            // Remove non-ASCII except newlines
        .trim();
}

/**
 * Terminate the worker (call when done)
 */
async function terminateWorker() {
    if (cachedWorker) {
        await cachedWorker.terminate();
        cachedWorker = null;
    }
}

module.exports = {
    extractTextFromImage,
    preprocessImage,
    cleanOCRText,
    terminateWorker
};
