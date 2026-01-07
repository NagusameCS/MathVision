#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { solveMath } = require('../lib/solver');
const { extractTextFromImage } = require('../lib/ocr');
const { PDFHandler } = require('../lib/pdfHandler');

program
    .name('mathvision')
    .description('Solve math problems from images, PDFs, or text')
    .version('1.0.0');

program
    .command('solve')
    .description('Solve a math problem')
    .argument('<input>', 'Math expression, image, or PDF file path')
    .option('-v, --verbose', 'Show detailed steps')
    .option('-j, --json', 'Output as JSON')
    .option('-f, --fast', 'Fast mode (skip some optimizations)')
    .option('-o, --output <file>', 'Output annotated PDF (for PDF input)')
    .option('-p, --pdf <file>', 'Generate solutions PDF')
    .action(async (input, options) => {
        const spinner = ora('Processing...').start();
        
        try {
            let mathText = input;
            let isPDF = false;
            const pdfHandler = new PDFHandler();
            
            // Check if input is a file path
            if (fs.existsSync(input)) {
                const ext = path.extname(input).toLowerCase();
                if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
                    spinner.text = 'Extracting text from image...';
                    mathText = await extractTextFromImage(input, !options.fast);
                    spinner.text = 'Solving...';
                } else if (ext === '.pdf') {
                    spinner.text = 'Extracting text from PDF...';
                    isPDF = true;
                    const result = await pdfHandler.loadPDF(input);
                    mathText = result.text || '';
                    if (!mathText.trim()) {
                        throw new Error('No text found in PDF. Try using OCR on individual pages.');
                    }
                    spinner.text = 'Solving...';
                } else if (['.txt'].includes(ext)) {
                    mathText = fs.readFileSync(input, 'utf-8');
                }
            }
            
            const solutions = solveMath(mathText);
            spinner.stop();
            
            // Generate annotated PDF if requested
            if (options.output && isPDF) {
                const outputSpinner = ora('Generating annotated PDF...').start();
                pdfHandler.setSolutions(solutions);
                const outputPath = options.output;
                await pdfHandler.createAnnotatedPDF(outputPath);
                outputSpinner.succeed(`Annotated PDF saved: ${outputPath}`);
            }
            
            // Generate solutions-only PDF if requested
            if (options.pdf) {
                const pdfSpinner = ora('Generating solutions PDF...').start();
                const solPdfHandler = new PDFHandler();
                solPdfHandler.setSolutions(solutions);
                await solPdfHandler.createSolutionsPDF(options.pdf);
                pdfSpinner.succeed(`Solutions PDF saved: ${options.pdf}`);
            }
            
            if (options.json) {
                console.log(JSON.stringify(solutions, null, 2));
                return;
            }
            
            // Pretty print results
            console.log();
            console.log(chalk.bold.white('━'.repeat(50)));
            console.log(chalk.bold.white(' MathVision Results'));
            console.log(chalk.bold.white('━'.repeat(50)));
            console.log();
            
            solutions.forEach((sol, i) => {
                console.log(chalk.cyan(`Problem ${sol.number}:`) + ` ${sol.original}`);
                console.log(chalk.dim(`Type: ${sol.type}`));
                
                if (options.verbose && sol.steps && sol.steps.length > 0) {
                    console.log(chalk.dim('\nSteps:'));
                    sol.steps.forEach((step, j) => {
                        console.log(chalk.dim(`  ${j + 1}. ${step.description}`));
                        console.log(chalk.white(`     ${step.math}`));
                    });
                }
                
                if (sol.answer) {
                    console.log(chalk.green(`\n✓ Answer: ${sol.answer}`));
                }
                
                if (sol.error) {
                    console.log(chalk.red(`✗ Error: ${sol.error}`));
                }
                
                console.log();
                console.log(chalk.dim('─'.repeat(50)));
                console.log();
            });
            
        } catch (error) {
            spinner.stop();
            console.error(chalk.red('Error:'), error.message);
            process.exit(1);
        }
    });

program
    .command('ocr')
    .description('Extract text from an image (without solving)')
    .argument('<image>', 'Path to image file')
    .option('-f, --fast', 'Fast mode (less preprocessing)')
    .action(async (image, options) => {
        const spinner = ora('Extracting text...').start();
        
        try {
            if (!fs.existsSync(image)) {
                throw new Error(`File not found: ${image}`);
            }
            
            const text = await extractTextFromImage(image, !options.fast);
            spinner.stop();
            
            console.log(chalk.bold('\nExtracted Text:'));
            console.log(chalk.white(text));
            
        } catch (error) {
            spinner.stop();
            console.error(chalk.red('Error:'), error.message);
            process.exit(1);
        }
    });

program
    .command('pdf')
    .description('Solve problems from PDF and create annotated output')
    .argument('<input>', 'Input PDF file path')
    .option('-o, --output <file>', 'Output annotated PDF path', 'solved.pdf')
    .option('-v, --verbose', 'Show detailed steps in console')
    .action(async (input, options) => {
        const spinner = ora('Loading PDF...').start();
        
        try {
            if (!fs.existsSync(input)) {
                throw new Error(`File not found: ${input}`);
            }
            
            const ext = path.extname(input).toLowerCase();
            if (ext !== '.pdf') {
                throw new Error('Input must be a PDF file');
            }
            
            const pdfHandler = new PDFHandler();
            
            // Load and extract text
            spinner.text = 'Extracting text from PDF...';
            const result = await pdfHandler.loadPDF(input);
            
            if (!result.text || !result.text.trim()) {
                spinner.warn('No text found in PDF. The PDF may be image-based.');
                console.log(chalk.yellow('\nTip: For image-based PDFs, convert pages to images first.'));
                return;
            }
            
            spinner.text = `Found ${result.numPages} pages. Solving problems...`;
            
            // Solve
            const solutions = solveMath(result.text);
            
            if (solutions.length === 0) {
                spinner.warn('No math problems detected in PDF.');
                return;
            }
            
            spinner.text = `Found ${solutions.length} problems. Generating annotated PDF...`;
            
            // Create annotated PDF
            pdfHandler.setSolutions(solutions);
            const outputPath = options.output;
            await pdfHandler.createAnnotatedPDF(outputPath);
            
            spinner.succeed(`Annotated PDF saved: ${chalk.green(outputPath)}`);
            
            // Print summary
            console.log();
            console.log(chalk.bold.white('━'.repeat(50)));
            console.log(chalk.bold.white(' Solutions Summary'));
            console.log(chalk.bold.white('━'.repeat(50)));
            console.log();
            
            solutions.forEach(sol => {
                console.log(chalk.cyan(`${sol.number}.`) + ` ${sol.original}`);
                if (sol.answer) {
                    console.log(chalk.red(`   ✓ ${sol.answer}`));
                }
                if (options.verbose && sol.steps) {
                    sol.steps.forEach((step, i) => {
                        console.log(chalk.dim(`      ${i + 1}. ${step.description}`));
                    });
                }
                console.log();
            });
            
            console.log(chalk.green(`\n📄 Annotated PDF with solutions in red: ${outputPath}`));
            
        } catch (error) {
            spinner.stop();
            console.error(chalk.red('Error:'), error.message);
            process.exit(1);
        }
    });

program
    .command('interactive')
    .alias('i')
    .description('Interactive mode - enter problems line by line')
    .action(async () => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log(chalk.bold.white('\n MathVision Interactive Mode'));
        console.log(chalk.dim(' Type math problems and press Enter. Type "exit" to quit.\n'));
        
        const prompt = () => {
            rl.question(chalk.cyan('math> '), (input) => {
                if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                    console.log(chalk.dim('Goodbye!'));
                    rl.close();
                    return;
                }
                
                if (input.trim()) {
                    try {
                        const solutions = solveMath(input);
                        solutions.forEach(sol => {
                            if (sol.answer) {
                                console.log(chalk.green(`  = ${sol.answer}`));
                            }
                            if (sol.error) {
                                console.log(chalk.red(`  Error: ${sol.error}`));
                            }
                        });
                    } catch (e) {
                        console.log(chalk.red(`  Error: ${e.message}`));
                    }
                }
                
                prompt();
            });
        };
        
        prompt();
    });

program.parse();
