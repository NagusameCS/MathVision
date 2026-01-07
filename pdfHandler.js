/**
 * MathVision PDF Handler
 * Handles PDF loading, text extraction, and annotation generation
 * Uses PDF.js (Mozilla) for reading and pdf-lib for writing
 */

class PDFHandler {
    constructor() {
        this.currentPDF = null;
        this.pdfDoc = null;
        this.pageTexts = [];
        this.solutions = [];
        this.pdfLib = window.PDFLib;
        
        // Initialize PDF.js worker
        this.initPDFJS();
    }

    async initPDFJS() {
        // PDF.js is loaded via CDN, set worker path
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    /**
     * Load a PDF file from File object or ArrayBuffer
     */
    async loadPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.currentPDF = arrayBuffer;
            
            // Load with PDF.js for text extraction
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            
            // Extract text from all pages
            this.pageTexts = await this.extractAllText();
            
            return {
                success: true,
                numPages: this.pdfDoc.numPages,
                fileName: file.name,
                pageTexts: this.pageTexts
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract text from all PDF pages
     */
    async extractAllText() {
        const texts = [];
        
        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            
            // Extract text items with their positions
            const textItems = textContent.items.map(item => ({
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
                height: item.height,
                fontSize: Math.abs(item.transform[0])
            }));
            
            // Join text for the page
            const pageText = textContent.items.map(item => item.str).join(' ');
            
            texts.push({
                pageNumber: i,
                text: pageText,
                items: textItems
            });
        }
        
        return texts;
    }

    /**
     * Get full text from PDF (all pages combined)
     */
    getFullText() {
        return this.pageTexts.map(p => p.text).join('\n\n');
    }

    /**
     * Render a specific PDF page to a canvas
     */
    async renderPage(pageNum, canvas, scale = 1.5) {
        if (!this.pdfDoc) return;
        
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const context = canvas.getContext('2d');
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        return {
            width: viewport.width,
            height: viewport.height
        };
    }

    /**
     * Store solutions for annotation
     */
    setSolutions(solutions) {
        this.solutions = solutions;
    }

    /**
     * Create annotated PDF with solutions in red
     */
    async createAnnotatedPDF() {
        if (!this.currentPDF || !this.pdfLib) {
            throw new Error('No PDF loaded or pdf-lib not available');
        }

        const { PDFDocument, rgb, StandardFonts } = this.pdfLib;
        
        // Load the existing PDF
        const pdfDoc = await PDFDocument.load(this.currentPDF);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const pages = pdfDoc.getPages();
        
        // Create solution annotations for each page
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            
            // Find solutions that might relate to this page's content
            const pageText = this.pageTexts[i]?.text || '';
            const relatedSolutions = this.findRelatedSolutions(pageText, i);
            
            if (relatedSolutions.length > 0) {
                // Add annotation box at the bottom of the page
                const boxHeight = Math.min(200, relatedSolutions.length * 60 + 40);
                const boxY = 20;
                const boxX = 20;
                const boxWidth = width - 40;
                
                // Draw annotation box background (light red tint)
                page.drawRectangle({
                    x: boxX,
                    y: boxY,
                    width: boxWidth,
                    height: boxHeight,
                    color: rgb(1, 0.95, 0.95),
                    borderColor: rgb(0.8, 0, 0),
                    borderWidth: 2,
                });
                
                // Add header
                page.drawText('MathVision Solutions', {
                    x: boxX + 10,
                    y: boxY + boxHeight - 25,
                    size: 14,
                    font: helveticaBold,
                    color: rgb(0.8, 0, 0),
                });
                
                // Add solutions text
                let yOffset = boxY + boxHeight - 50;
                
                for (const sol of relatedSolutions) {
                    if (yOffset < boxY + 20) break;
                    
                    // Problem
                    const problemText = `${sol.number}. ${sol.original}`;
                    page.drawText(this.truncateText(problemText, 80), {
                        x: boxX + 10,
                        y: yOffset,
                        size: 10,
                        font: helvetica,
                        color: rgb(0.3, 0.3, 0.3),
                    });
                    yOffset -= 15;
                    
                    // Answer
                    if (sol.answer && yOffset >= boxY + 20) {
                        const answerText = `   ✓ ${sol.answer}`;
                        page.drawText(this.truncateText(answerText, 80), {
                            x: boxX + 10,
                            y: yOffset,
                            size: 11,
                            font: helveticaBold,
                            color: rgb(0.8, 0, 0), // Red color for answer
                        });
                        yOffset -= 20;
                    }
                }
            }
        }
        
        // If there are solutions but they didn't match any page, add a new solutions page
        if (this.solutions.length > 0) {
            await this.addSolutionsPage(pdfDoc, helveticaBold, helvetica);
        }
        
        // Save the annotated PDF
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    /**
     * Add a dedicated solutions page at the end
     */
    async addSolutionsPage(pdfDoc, boldFont, regularFont) {
        const { rgb } = this.pdfLib;
        
        const page = pdfDoc.addPage([612, 792]); // Letter size
        const { width, height } = page.getSize();
        
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
        
        // Solutions
        let yOffset = height - 120;
        const lineHeight = 18;
        const margin = 50;
        
        for (const sol of this.solutions) {
            if (yOffset < 100) {
                // Add new page if needed
                const newPage = pdfDoc.addPage([612, 792]);
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
            page.drawText(this.truncateText(sol.original, 90), {
                x: margin,
                y: yOffset,
                size: 11,
                font: regularFont,
                color: rgb(0.4, 0.4, 0.4),
            });
            yOffset -= lineHeight * 1.5;
            
            // Steps (abbreviated)
            if (sol.steps && sol.steps.length > 0) {
                const maxSteps = Math.min(sol.steps.length, 3);
                for (let i = 0; i < maxSteps; i++) {
                    const step = sol.steps[i];
                    page.drawText(`  ${i + 1}. ${this.truncateText(step.description, 70)}`, {
                        x: margin,
                        y: yOffset,
                        size: 9,
                        font: regularFont,
                        color: rgb(0.5, 0.5, 0.5),
                    });
                    yOffset -= lineHeight;
                    
                    page.drawText(`     ${this.truncateText(step.math, 65)}`, {
                        x: margin,
                        y: yOffset,
                        size: 10,
                        font: regularFont,
                        color: rgb(0.3, 0.3, 0.3),
                    });
                    yOffset -= lineHeight;
                }
                
                if (sol.steps.length > 3) {
                    page.drawText(`  ... and ${sol.steps.length - 3} more steps`, {
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
                page.drawText(`✓ Answer: ${sol.answer}`, {
                    x: margin,
                    y: yOffset,
                    size: 12,
                    font: boldFont,
                    color: rgb(0.85, 0.1, 0.1), // Bright red
                });
                yOffset -= lineHeight * 1.5;
            }
            
            // Separator
            page.drawLine({
                start: { x: margin, y: yOffset },
                end: { x: width - margin, y: yOffset },
                thickness: 0.5,
                color: rgb(0.8, 0.8, 0.8),
            });
            yOffset -= lineHeight * 1.5;
        }
        
        // Footer
        page.drawText('Generated by MathVision — mathvision.app', {
            x: margin,
            y: 30,
            size: 9,
            font: regularFont,
            color: rgb(0.6, 0.6, 0.6),
        });
    }

    /**
     * Find solutions that relate to content on a specific page
     */
    findRelatedSolutions(pageText, pageIndex) {
        // For now, distribute solutions across pages or match by keywords
        const related = [];
        const lowerPageText = pageText.toLowerCase();
        
        for (const sol of this.solutions) {
            // Check if the problem appears on this page
            const originalLower = sol.original.toLowerCase();
            const keywords = originalLower.split(/\s+/).filter(w => w.length > 2);
            
            const matches = keywords.some(kw => lowerPageText.includes(kw));
            
            if (matches) {
                related.push(sol);
            }
        }
        
        // If first page and no matches, show all (for simple cases)
        if (pageIndex === 0 && related.length === 0 && this.solutions.length <= 3) {
            return this.solutions;
        }
        
        return related;
    }

    /**
     * Truncate text to fit in PDF
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Download the annotated PDF
     */
    async downloadAnnotatedPDF(filename = 'mathvision-solved.pdf') {
        const pdfBytes = await this.createAnnotatedPDF();
        
        // Create blob and download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    }

    /**
     * Create a new PDF with solutions (without original PDF)
     */
    async createSolutionsPDF(solutions) {
        if (!this.pdfLib) {
            throw new Error('pdf-lib not available');
        }

        const { PDFDocument, rgb, StandardFonts } = this.pdfLib;
        
        const pdfDoc = await PDFDocument.create();
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        this.solutions = solutions;
        await this.addSolutionsPage(pdfDoc, helveticaBold, helvetica);
        
        return await pdfDoc.save();
    }

    /**
     * Generate standalone solutions PDF and download
     */
    async downloadSolutionsPDF(solutions, filename = 'mathvision-solutions.pdf') {
        const pdfBytes = await this.createSolutionsPDF(solutions);
        
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return true;
    }

    /**
     * Reset handler state
     */
    reset() {
        this.currentPDF = null;
        this.pdfDoc = null;
        this.pageTexts = [];
        this.solutions = [];
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.PDFHandler = PDFHandler;
}
