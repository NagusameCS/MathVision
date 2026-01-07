/**
 * MathVision PDF Handler (CLI Version)
 * Handles PDF loading, text extraction, and annotation generation
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

class PDFHandler {
    constructor() {
        this.pdfBytes = null;
        this.solutions = [];
        this.extractedText = '';
    }

    /**
     * Load a PDF file and extract text
     */
    async loadPDF(filePath) {
        this.pdfBytes = fs.readFileSync(filePath);
        
        // Try pdf-parse for text extraction
        let text = '';
        let numPages = 0;
        
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(this.pdfBytes);
            text = data.text;
            numPages = data.numpages;
        } catch (e) {
            // If pdf-parse fails, try to extract text using pdf-lib basic info
            console.warn('pdf-parse failed, using fallback...');
            try {
                const pdfDoc = await PDFDocument.load(this.pdfBytes, { ignoreEncryption: true });
                numPages = pdfDoc.getPageCount();
                // pdf-lib doesn't extract text, but we can at least get page count
                text = '';
            } catch (e2) {
                throw new Error('Unable to read PDF: ' + e2.message);
            }
        }
        
        this.extractedText = text;
        
        return {
            success: true,
            numPages: numPages,
            text: text
        };
    }

    /**
     * Get extracted text
     */
    getText() {
        return this.extractedText;
    }

    /**
     * Store solutions
     */
    setSolutions(solutions) {
        this.solutions = solutions;
    }

    /**
     * Create annotated PDF with solutions in red
     */
    async createAnnotatedPDF(outputPath) {
        if (!this.pdfBytes) {
            throw new Error('No PDF loaded');
        }

        const pdfDoc = await PDFDocument.load(this.pdfBytes);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();

        // Add solution annotations to first page
        if (pages.length > 0 && this.solutions.length > 0) {
            const page = pages[0];
            const { width, height } = page.getSize();

            // Calculate box dimensions
            const boxHeight = Math.min(250, this.solutions.length * 70 + 50);
            const boxY = 20;
            const boxX = 20;
            const boxWidth = width - 40;

            // Draw annotation box
            page.drawRectangle({
                x: boxX,
                y: boxY,
                width: boxWidth,
                height: boxHeight,
                color: rgb(1, 0.95, 0.95),
                borderColor: rgb(0.85, 0.1, 0.1),
                borderWidth: 2,
            });

            // Header
            page.drawText('MathVision Solutions', {
                x: boxX + 15,
                y: boxY + boxHeight - 25,
                size: 14,
                font: helveticaBold,
                color: rgb(0.85, 0.1, 0.1),
            });

            // Solutions
            let yOffset = boxY + boxHeight - 50;

            for (const sol of this.solutions.slice(0, 5)) {
                if (yOffset < boxY + 30) break;

                // Problem
                page.drawText(this.truncate(`${sol.number}. ${sol.original}`, 80), {
                    x: boxX + 15,
                    y: yOffset,
                    size: 10,
                    font: helvetica,
                    color: rgb(0.3, 0.3, 0.3),
                });
                yOffset -= 16;

                // Answer in RED
                if (sol.answer) {
                    page.drawText(this.truncate(`   => ${sol.answer}`, 75), {
                        x: boxX + 15,
                        y: yOffset,
                        size: 11,
                        font: helveticaBold,
                        color: rgb(0.85, 0.1, 0.1),
                    });
                    yOffset -= 22;
                }
            }
        }

        // Add full solutions page
        await this.addSolutionsPage(pdfDoc, helveticaBold, helvetica);

        // Save
        const pdfBytesOut = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytesOut);

        return outputPath;
    }

    /**
     * Create solutions-only PDF
     */
    async createSolutionsPDF(outputPath) {
        const pdfDoc = await PDFDocument.create();
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        await this.addSolutionsPage(pdfDoc, helveticaBold, helvetica);

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);

        return outputPath;
    }

    /**
     * Add solutions page
     */
    async addSolutionsPage(pdfDoc, boldFont, regularFont) {
        let page = pdfDoc.addPage([612, 792]);
        let { width, height } = page.getSize();

        // Header
        page.drawRectangle({
            x: 0,
            y: height - 80,
            width: width,
            height: 80,
            color: rgb(0.1, 0.1, 0.1),
        });

        page.drawText('MathVision — Complete Solutions', {
            x: 50,
            y: height - 50,
            size: 24,
            font: boldFont,
            color: rgb(1, 1, 1),
        });

        let yOffset = height - 120;
        const lineHeight = 18;
        const margin = 50;

        for (const sol of this.solutions) {
            // Check if we need a new page
            if (yOffset < 120) {
                page = pdfDoc.addPage([612, 792]);
                ({ width, height } = page.getSize());
                yOffset = height - 50;
            }

            // Problem header
            page.drawText(`Problem ${sol.number}: ${sol.type}`, {
                x: margin,
                y: yOffset,
                size: 12,
                font: boldFont,
                color: rgb(0.2, 0.2, 0.2),
            });
            yOffset -= lineHeight;

            // Original problem
            page.drawText(this.truncate(sol.original, 90), {
                x: margin,
                y: yOffset,
                size: 11,
                font: regularFont,
                color: rgb(0.4, 0.4, 0.4),
            });
            yOffset -= lineHeight * 1.5;

            // Steps (abbreviated)
            if (sol.steps && sol.steps.length > 0) {
                const maxSteps = Math.min(sol.steps.length, 4);
                for (let i = 0; i < maxSteps; i++) {
                    if (yOffset < 80) break;
                    
                    const step = sol.steps[i];
                    page.drawText(`  ${i + 1}. ${this.truncate(step.description, 70)}`, {
                        x: margin,
                        y: yOffset,
                        size: 9,
                        font: regularFont,
                        color: rgb(0.5, 0.5, 0.5),
                    });
                    yOffset -= lineHeight;

                    page.drawText(`     ${this.truncate(step.math, 65)}`, {
                        x: margin,
                        y: yOffset,
                        size: 10,
                        font: regularFont,
                        color: rgb(0.3, 0.3, 0.3),
                    });
                    yOffset -= lineHeight;
                }

                if (sol.steps.length > 4) {
                    page.drawText(`  ... and ${sol.steps.length - 4} more steps`, {
                        x: margin,
                        y: yOffset,
                        size: 9,
                        font: regularFont,
                        color: rgb(0.6, 0.6, 0.6),
                    });
                    yOffset -= lineHeight;
                }
            }

            // Final answer in RED
            if (sol.answer) {
                page.drawText(`=> Answer: ${sol.answer}`, {
                    x: margin,
                    y: yOffset,
                    size: 12,
                    font: boldFont,
                    color: rgb(0.85, 0.1, 0.1),
                });
                yOffset -= lineHeight * 1.5;
            }

            // Separator
            page.drawLine({
                start: { x: margin, y: yOffset },
                end: { x: width - margin, y: yOffset },
                thickness: 0.5,
                color: rgb(0.85, 0.85, 0.85),
            });
            yOffset -= lineHeight * 1.5;
        }

        // Footer on last page
        page.drawText('Generated by MathVision CLI', {
            x: margin,
            y: 30,
            size: 9,
            font: regularFont,
            color: rgb(0.6, 0.6, 0.6),
        });
    }

    truncate(text, maxLength) {
        if (!text) return '';
        text = String(text);
        // Replace non-ASCII characters that can't be encoded in WinAnsi
        text = text
            .replace(/✓/g, '=>')
            .replace(/Δ/g, 'delta')
            .replace(/∑/g, 'sum')
            .replace(/∫/g, 'integral')
            .replace(/√/g, 'sqrt')
            .replace(/π/g, 'pi')
            .replace(/±/g, '+/-')
            .replace(/÷/g, '/')
            .replace(/×/g, '*')
            .replace(/≠/g, '!=')
            .replace(/≤/g, '<=')
            .replace(/≥/g, '>=')
            .replace(/∞/g, 'infinity')
            .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}

module.exports = { PDFHandler };
