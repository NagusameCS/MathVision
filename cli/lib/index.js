/**
 * MathVision CLI - Main Library Export
 */

const { extractText, terminateWorker, recognizeFromBuffer } = require('./ocr');
const { solveMath } = require('./solver');

/**
 * Process an image and return solutions
 */
async function processImage(imagePath) {
    const text = await extractText(imagePath);
    const solutions = solveMath(text);
    return { text, solutions };
}

/**
 * Solve math from text directly
 */
function solveFromText(text) {
    return solveMath(text);
}

/**
 * Cleanup resources
 */
async function cleanup() {
    await terminateWorker();
}

module.exports = {
    processImage,
    solveFromText,
    solveMath,
    extractText,
    recognizeFromBuffer,
    cleanup
};
