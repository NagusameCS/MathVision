/**
 * MathVision - Universal Math Problem Solver
 * Handles parsing and solving ANY type of math problem
 * Uses multi-strategy approach: math.js, nerdamer, algebrite, compute-engine
 * Includes Firebase integration for problem storage
 */

class MathSolver {
    constructor() {
        this.parser = math.parser();
        
        // Initialize Cortex Compute Engine if available
        this.computeEngine = null;
        try {
            if (typeof ComputeEngine !== 'undefined') {
                this.computeEngine = new ComputeEngine.ComputeEngine();
                console.log('Cortex Compute Engine initialized');
            }
        } catch (e) {
            console.log('Cortex Compute Engine not available, using fallback methods');
        }
        
        this.problemCategories = {
            'Algebra': ['equation', 'solve', 'factor', 'expand', 'simplify', 'polynomial', 'expression', 'variable', 'linear', 'quadratic', 'cubic', 'system'],
            'Calculus': ['derivative', 'differentiate', 'integral', 'integrate', 'limit', 'series', 'taylor', 'maclaurin', 'differential', 'antiderivative', "f'", 'd/dx', '∫'],
            'Geometry': ['area', 'perimeter', 'volume', 'radius', 'diameter', 'circle', 'triangle', 'rectangle', 'square', 'sphere', 'cube', 'cylinder', 'cone', 'polygon', 'angle', 'hypotenuse', 'pythagorean'],
            'Trigonometry': ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'radian', 'degree', 'trigonometric', 'identity'],
            'Vector': ['vector', 'dot product', 'cross product', 'magnitude', 'unit vector', 'position vector', 'perpendicular', 'parallel', 'plane', 'normal', 'reflection', '→'],
            'Matrix': ['matrix', 'determinant', 'inverse', 'transpose', 'eigenvalue', 'eigenvector', 'rank', 'trace'],
            'Statistics': ['mean', 'median', 'mode', 'standard deviation', 'variance', 'probability', 'distribution', 'regression', 'correlation'],
            'Number Theory': ['prime', 'factorial', 'gcd', 'lcm', 'divisor', 'modulo', 'remainder', 'fibonacci'],
            'Complex Numbers': ['complex', 'imaginary', 'real part', 'conjugate', 'arg', 'modulus', 'euler'],
            'Logarithms': ['log', 'ln', 'logarithm', 'exponential', 'exp', 'natural log'],
            'Sequences': ['sequence', 'series', 'sum', 'product', 'arithmetic', 'geometric', 'recurrence', 'nth term'],
            'Combinatorics': ['permutation', 'combination', 'choose', 'arrange', 'binomial'],
            'Graphing': ['graph', 'plot', 'y =', 'sketch', 'curve', 'function plot'],
            'Arithmetic': ['add', 'subtract', 'multiply', 'divide', 'calculate', 'compute', 'evaluate']
        };
    }

    /**
     * Main method to solve a math expression/equation
     */
    solve(input) {
        const cleanedInput = this.cleanInput(input);
        const problems = this.extractProblems(cleanedInput);
        
        return problems.map((problem, index) => {
            try {
                const result = this.solveProblem(problem, index + 1);
                // Save to Firebase asynchronously
                this.saveToFirebase(problem, result);
                return result;
            } catch (error) {
                const fallbackResult = this.universalFallback(problem, index + 1, error);
                this.saveToFirebase(problem, fallbackResult);
                return fallbackResult;
            }
        });
    }

    /**
     * Save solved problem to Firebase
     */
    async saveToFirebase(problem, result) {
        if (typeof window !== 'undefined' && window.firebaseDB) {
            try {
                const markdown = this.generateMarkdown(problem, result);
                await window.firebaseDB.saveProblem({
                    originalProblem: problem,
                    problemType: result.type,
                    category: this.classifyProblem(problem),
                    answer: result.answer,
                    steps: result.steps,
                    markdown: markdown,
                    success: !result.error
                });
            } catch (e) {
                console.log('Firebase save skipped:', e.message);
            }
        }
    }

    /**
     * Generate Markdown representation of the problem and solution
     */
    generateMarkdown(problem, result) {
        let md = `# Math Problem\n\n`;
        md += `## Question\n\n\`\`\`\n${problem}\n\`\`\`\n\n`;
        md += `## Classification\n\n- **Type:** ${result.type}\n- **Category:** ${this.classifyProblem(problem)}\n\n`;
        md += `## Solution Steps\n\n`;
        
        if (result.steps && result.steps.length > 0) {
            result.steps.forEach((step, i) => {
                md += `### Step ${i + 1}: ${step.description}\n\n`;
                md += `$$${step.math}$$\n\n`;
            });
        }
        
        md += `## Answer\n\n**${result.answer}**\n`;
        
        return md;
    }

    /**
     * Classify problem into category
     */
    classifyProblem(problem) {
        const lower = problem.toLowerCase();
        let scores = {};
        
        for (const [category, keywords] of Object.entries(this.problemCategories)) {
            scores[category] = 0;
            for (const keyword of keywords) {
                if (lower.includes(keyword.toLowerCase())) {
                    scores[category] += keyword.length; // Weight by keyword length
                }
            }
        }
        
        // Check for mathematical patterns
        if (/\^2|²|x\s*\*\s*x/i.test(problem)) scores['Algebra'] += 3;
        if (/∫|∂|dx|dy/i.test(problem)) scores['Calculus'] += 5;
        if (/→|\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i.test(problem)) scores['Vector'] += 5;
        if (/\[\s*\[|\]\s*\]/i.test(problem)) scores['Matrix'] += 5;
        if (/sin|cos|tan/i.test(problem)) scores['Trigonometry'] += 3;
        if (/log|ln\s*\(/i.test(problem)) scores['Logarithms'] += 3;
        if (/^\s*[\d\s\+\-\*\/\(\)\.\^\%]+\s*$/i.test(problem)) scores['Arithmetic'] += 10;
        
        // Find category with highest score
        let maxScore = 0;
        let bestCategory = 'General Mathematics';
        
        for (const [category, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                bestCategory = category;
            }
        }
        
        return bestCategory;
    }

    /**
     * Universal fallback - try multiple solving strategies
     */
    universalFallback(problem, number, originalError) {
        const steps = [];
        const strategies = [
            { name: 'Nerdamer Solve', fn: () => this.tryNerdamer(problem) },
            { name: 'Algebrite Solve', fn: () => this.tryAlgebrite(problem) },
            { name: 'Math.js Evaluate', fn: () => this.tryMathJs(problem) },
            { name: 'Symbolic Simplify', fn: () => this.trySimplify(problem) },
            { name: 'Pattern Analysis', fn: () => this.tryPatternMatch(problem) }
        ];
        
        steps.push({
            description: 'Problem Analysis',
            math: problem.substring(0, 150)
        });
        
        for (const strategy of strategies) {
            try {
                const result = strategy.fn();
                if (result && result !== 'undefined' && result !== 'NaN') {
                    steps.push({
                        description: `Solved using ${strategy.name}`,
                        math: String(result)
                    });
                    
                    return {
                        number,
                        original: problem,
                        type: this.classifyProblem(problem),
                        steps,
                        answer: String(result)
                    };
                }
            } catch (e) {
                // Continue to next strategy
            }
        }
        
        // All strategies failed - provide analysis
        steps.push({
            description: 'Analysis',
            math: this.analyzeProblem(problem)
        });
        
        return {
            number,
            original: problem,
            type: this.classifyProblem(problem),
            steps,
            answer: 'Problem requires manual analysis - see breakdown above',
            error: originalError?.message
        };
    }

    /**
     * Analyze problem structure when solving fails
     */
    analyzeProblem(problem) {
        const analysis = [];
        
        // Detect variables
        const vars = problem.match(/[a-z]/gi);
        if (vars) {
            const uniqueVars = [...new Set(vars.map(v => v.toLowerCase()))];
            analysis.push(`Variables: ${uniqueVars.join(', ')}`);
        }
        
        // Detect operations
        if (/\+/.test(problem)) analysis.push('Contains addition');
        if (/\-/.test(problem)) analysis.push('Contains subtraction');
        if (/[\*×]/.test(problem)) analysis.push('Contains multiplication');
        if (/[\/÷]/.test(problem)) analysis.push('Contains division');
        if (/\^|²|³/.test(problem)) analysis.push('Contains exponents');
        if (/sqrt|√/.test(problem)) analysis.push('Contains square root');
        if (/=/.test(problem)) analysis.push('This is an equation');
        
        return analysis.join('; ') || 'Complex expression detected';
    }

    /**
     * Try solving with Nerdamer
     */
    tryNerdamer(problem) {
        if (typeof nerdamer === 'undefined') return null;
        
        // Clean for nerdamer
        const clean = problem
            .replace(/[×]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/√\(/g, 'sqrt(')
            .replace(/(\d)([a-z])/gi, '$1*$2');
        
        // Try different nerdamer functions
        if (/=/.test(clean)) {
            // It's an equation - solve it
            const parts = clean.split('=');
            const expr = `${parts[0]}-(${parts[1]})`;
            const vars = clean.match(/[a-z]/gi);
            const mainVar = vars ? vars[0].toLowerCase() : 'x';
            const solutions = nerdamer.solve(expr, mainVar);
            return `${mainVar} = ${solutions.toString()}`;
        } else {
            // Evaluate or simplify
            return nerdamer(clean).evaluate().text();
        }
    }

    /**
     * Try solving with Algebrite
     */
    tryAlgebrite(problem) {
        if (typeof Algebrite === 'undefined') return null;
        
        const clean = problem
            .replace(/[×]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3');
        
        // Try run (general evaluation)
        const result = Algebrite.run(clean);
        if (result && result !== 'nil' && result !== '') {
            return result;
        }
        
        // Try simplify
        return Algebrite.simplify(clean).toString();
    }

    /**
     * Try solving with Math.js
     */
    tryMathJs(problem) {
        const clean = problem
            .replace(/[×]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/(\d)([a-z])/gi, '$1*$2');
        
        // For equations, try to solve
        if (/=/.test(clean)) {
            const parts = clean.split('=').map(p => p.trim());
            // Create expression: left - right = 0
            const expr = math.parse(`${parts[0]}-(${parts[1]})`);
            const simplified = math.simplify(expr);
            return `Simplified: ${simplified.toString()} = 0`;
        }
        
        // Try direct evaluation
        return math.evaluate(clean);
    }

    /**
     * Try symbolic simplification
     */
    trySimplify(problem) {
        const clean = problem
            .replace(/[×]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3');
        
        // Try math.js simplify
        const simplified = math.simplify(clean);
        return simplified.toString();
    }

    /**
     * Pattern matching for common problem types
     */
    tryPatternMatch(problem) {
        const lower = problem.toLowerCase();
        
        // Factorial pattern: 5!
        const factorialMatch = problem.match(/(\d+)!/);
        if (factorialMatch) {
            const n = parseInt(factorialMatch[1]);
            let result = 1;
            for (let i = 2; i <= n; i++) result *= i;
            return `${n}! = ${result}`;
        }
        
        // Percentage: X% of Y
        const percentMatch = problem.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
        if (percentMatch) {
            const pct = parseFloat(percentMatch[1]);
            const num = parseFloat(percentMatch[2]);
            return `${pct}% of ${num} = ${(pct/100) * num}`;
        }
        
        // Ratio: X:Y
        const ratioMatch = problem.match(/(\d+)\s*:\s*(\d+)/);
        if (ratioMatch) {
            const a = parseInt(ratioMatch[1]);
            const b = parseInt(ratioMatch[2]);
            const gcd = this.gcd(a, b);
            return `${a}:${b} = ${a/gcd}:${b/gcd} (simplified)`;
        }
        
        // Prime check
        if (/is\s*(\d+)\s*prime/i.test(problem)) {
            const numMatch = problem.match(/is\s*(\d+)\s*prime/i);
            const n = parseInt(numMatch[1]);
            const isPrime = this.isPrime(n);
            return `${n} is ${isPrime ? '' : 'not '}prime`;
        }
        
        return null;
    }

    /**
     * Try to evaluate an expression using multiple math engines
     * Returns the first successful result
     */
    tryEvaluate(expression) {
        // Try math.js first
        try {
            const result = math.evaluate(expression);
            if (result !== undefined && !isNaN(result)) {
                return { engine: 'math.js', result };
            }
        } catch (e) {}
        
        // Try Nerdamer
        try {
            const result = nerdamer(expression).evaluate().text();
            if (result && result !== 'undefined') {
                return { engine: 'nerdamer', result };
            }
        } catch (e) {}
        
        // Try Algebrite
        try {
            const result = Algebrite.eval(expression);
            if (result && result !== 'undefined') {
                return { engine: 'algebrite', result };
            }
        } catch (e) {}
        
        // Try Cortex Compute Engine
        if (this.computeEngine) {
            try {
                const expr = this.computeEngine.parse(expression);
                const result = expr.N();
                if (result && result.numericValue !== undefined) {
                    return { engine: 'compute-engine', result: result.numericValue };
                }
            } catch (e) {}
        }
        
        return null;
    }

    /**
     * Try to solve an equation using multiple engines
     */
    trySolve(equation, variable = 'x') {
        // Try Nerdamer first (best for equations)
        try {
            const solutions = nerdamer.solve(equation, variable).text();
            if (solutions && solutions !== '[]' && solutions !== 'undefined') {
                return { engine: 'nerdamer', solutions };
            }
        } catch (e) {}
        
        // Try Algebrite
        try {
            const result = Algebrite.run(`roots(${equation}, ${variable})`);
            if (result && result !== 'undefined' && result !== 'nil') {
                return { engine: 'algebrite', solutions: result };
            }
        } catch (e) {}
        
        // Try Cortex Compute Engine
        if (this.computeEngine) {
            try {
                const expr = this.computeEngine.parse(`Solve(${equation}, ${variable})`);
                const result = expr.evaluate();
                if (result) {
                    return { engine: 'compute-engine', solutions: result.toString() };
                }
            } catch (e) {}
        }
        
        return null;
    }

    /**
     * GCD helper
     */
    gcd(a, b) {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    /**
     * Prime check helper
     */
    isPrime(n) {
        if (n < 2) return false;
        if (n === 2) return true;
        if (n % 2 === 0) return false;
        for (let i = 3; i <= Math.sqrt(n); i += 2) {
            if (n % i === 0) return false;
        }
        return true;
    }

    /**
     * Clean and normalize input
     */
    cleanInput(input) {
        return input
            // Fix common OCR errors
            .replace(/[×✕]/g, '*')   // Only multiplication symbols, NOT x
            .replace(/[÷]/g, '/')
            .replace(/[−–—]/g, '-')
            .replace(/[''`]/g, "'")
            .replace(/[""]/g, '"')
            .replace(/\bl\b(?=\s*[=+\-*/])/g, '1')  // lowercase l often misread as 1
            .replace(/\bO\b(?=\s*[=+\-*/])/g, '0')  // uppercase O misread as 0
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            // Add implicit multiplication
            .replace(/(\d)\s*\(/g, '$1*(')           // 2( -> 2*(
            .replace(/\)\s*(\d)/g, ')*$1')           // )2 -> )*2
            .replace(/\)\s*\(/g, ')*(')              // )( -> )*(
            // Fix coordinates that might be mangled
            .replace(/\(\s*([+-]?\d+)\s+([+-]?\d+)\s+([+-]?\d+)\s*\)/g, '($1, $2, $3)')
            .replace(/\(\s*([+-]?\d+)\s+([+-]?\d+)\s*\)/g, '($1, $2)')
            .trim();
    }

    /**
     * Extract individual problems from input
     */
    extractProblems(input) {
        // Handle exam-style multi-part problems
        // First, try to split by question numbers like "1.", "2a.", "2b." etc.
        
        // Multiple exam patterns to try
        const examPatterns = [
            /(\d+[a-z]?\.\s*\[[^\]]*\]\s*)/gi,              // 1. [5 marks]
            /(?=\b\d+[a-z]?\.\s+(?:Find|Show|Prove|Calculate|Determine|Given))/gi, // 1a. Find...
            /(?=\(\s*[a-z]\s*\)\s*)/gi,                     // (a), (b), (c) style
            /(?=\b(?:Question|Q)\s*\d+)/gi,                  // Question 1, Q1
        ];
        
        for (const examPattern of examPatterns) {
            if (examPattern.test(input)) {
                // Reset regex
                examPattern.lastIndex = 0;
                
                // Split by exam question markers
                const parts = input.split(examPattern);
                const problems = parts
                    .map(p => p.trim())
                    .filter(p => p.length > 15 && /[a-z]/i.test(p) && /\d/.test(p));
                
                if (problems.length > 1) {
                    return problems;
                }
            }
        }
        
        // Try finding problems by content markers (like "line", "plane", "find", etc.)
        const contentSplit = input.split(/(?=The\s+(?:line|plane|point)|(?=Find\s+the)|(?=Show\s+that)|(?=Calculate)|(?=Given\s+that))/i);
        if (contentSplit.length > 1) {
            const filtered = contentSplit.filter(p => p.trim().length > 20);
            if (filtered.length > 1) {
                return filtered;
            }
        }
        
        // Try splitting by clear problem boundaries
        const patterns = [
            /\n\s*\n/,                           // Double newlines
            /(?=\d+\)\s*[A-Z])/,                // 1) followed by capital
            /(?=\d+\.\s*[A-Z])/,                // 1. followed by capital
            /(?=[a-z]\)\s*[A-Z])/i,             // a) followed by capital
            /;\s*/,                              // Semicolons
        ];
        
        let problems = [input];
        
        for (const pattern of patterns) {
            if (problems.length > 10) break; // Already well-split
            
            const newProblems = [];
            for (const prob of problems) {
                const splits = prob.split(pattern).filter(p => p.trim());
                newProblems.push(...splits);
            }
            if (newProblems.length > problems.length) {
                problems = newProblems;
            }
        }
        
        // Filter: must have some math content
        return problems.filter(p => {
            const trimmed = p.trim();
            // Must have numbers or math symbols
            return trimmed.length > 5 && /[\d\+\-\*\/\=xyz\[\]\(\)]/.test(trimmed);
        });
    }

    /**
     * Determine problem type and solve accordingly
     */
    solveProblem(problem, number) {
        const problemLower = problem.toLowerCase();
        
        // Handle compound requests like "solve x^2 then graph it"
        if (this.isCompoundRequest(problemLower)) {
            return this.solveCompoundRequest(problem, number);
        }
        
        // Detect problem type - order matters (more specific first)
        if (this.isVector(problemLower)) {
            return this.solveVector(problem, number);
        } else if (this.isMatrix(problemLower)) {
            return this.solveMatrix(problem, number);
        } else if (this.isStatistics(problemLower)) {
            return this.solveStatistics(problem, number);
        } else if (this.isLimit(problemLower)) {
            return this.solveLimit(problem, number);
        } else if (this.isSeries(problemLower)) {
            return this.solveSeries(problem, number);
        } else if (this.isLogarithm(problemLower)) {
            return this.solveLogarithm(problem, number);
        } else if (this.isTrigonometry(problemLower)) {
            return this.solveTrigonometry(problem, number);
        } else if (this.isComplexNumber(problemLower)) {
            return this.solveComplexNumber(problem, number);
        } else if (this.isGraph(problemLower)) {
            return this.solveGraph(problem, number);
        } else if (this.isGeometry(problemLower)) {
            return this.solveGeometry(problem, number);
        } else if (this.isIntegral(problemLower)) {
            return this.solveIntegral(problem, number);
        } else if (this.isDerivative(problemLower)) {
            return this.solveDerivative(problem, number);
        } else if (this.isCubicEquation(problem)) {
            return this.solveCubic(problem, number);
        } else if (this.isQuadraticEquation(problem)) {
            return this.solveQuadratic(problem, number);
        } else if (this.isLinearEquation(problem)) {
            return this.solveLinearEquation(problem, number);
        } else if (this.isSimplification(problem)) {
            return this.solveSimplification(problem, number);
        } else if (this.isSystem(problem)) {
            return this.solveSystem(problem, number);
        } else if (this.isArithmetic(problem)) {
            return this.solveArithmetic(problem, number);
        } else {
            return this.solveGeneric(problem, number);
        }
    }

    // ==================== DETECTION METHODS ====================

    isMatrix(problem) {
        return /matrix|determinant|inverse|transpose|eigenvalue|eigenvector|\[\s*\[|\]\s*\]|det\s*\(/i.test(problem);
    }

    isStatistics(problem) {
        return /mean|median|mode|standard\s*deviation|variance|average|probability|percentile|quartile/i.test(problem);
    }

    isLimit(problem) {
        return /limit|lim\s|lim\(|→|approaches|as\s+x\s*→/i.test(problem);
    }

    isSeries(problem) {
        return /series|sum\s+(of|from)|∑|sigma|sequence|nth\s*term|arithmetic\s*sequence|geometric\s*sequence/i.test(problem);
    }

    isLogarithm(problem) {
        return /\blog\b|\bln\b|logarithm|natural\s*log/i.test(problem);
    }

    isTrigonometry(problem) {
        return /\bsin\b|\bcos\b|\btan\b|\bcot\b|\bsec\b|\bcsc\b|arcsin|arccos|arctan|trigonometric|identity/i.test(problem) &&
               !/area|perimeter/i.test(problem); // Avoid geometry conflicts
    }

    isComplexNumber(problem) {
        return /complex|imaginary|\bi\b.*[+-]|\d+\s*[+-]\s*\d*i|conjugate|arg\s*\(/i.test(problem);
    }

    isGraph(problem) {
        // Only match if graph/plot is a standalone command, not mixed with other operations
        return /^\s*(graph|plot)\b/i.test(problem) || /y\s*=\s*[^=]/i.test(problem);
    }

    // Check if this is a compound request (solve then graph)
    isCompoundRequest(problem) {
        return /then\s+(graph|plot)/i.test(problem) || /graph.*solve|solve.*graph/i.test(problem);
    }

    isGeometry(problem) {
        return /area|perimeter|circumference|volume|radius|diameter|circle|triangle|rectangle|square|sphere|cube|cylinder|cone|polygon|hypotenuse|pythagorean/i.test(problem);
    }

    isVector(problem) {
        // Detect vector problems: AB→, dot product, cross product, plane equations, position vectors
        return /→|vector|dot\s*product|cross\s*product|•|×|position\s*vector|unit\s*vector|magnitude|parallel|perpendicular|normal|plane|cartesian\s*equation|line\s*equation|𝐫|reflection|intersection/i.test(problem) ||
               /\b[A-Z]{2}\s*→/i.test(problem) ||  // AB→
               /\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/i.test(problem) ||  // (1, 2, 3)
               /coordinates?\s*(of\s*)?[A-Z]\s*\(/i.test(problem) ||  // coordinates of A(
               /𝑥|𝑦|𝑧|ℝ|𝛱|𝜇|𝜆/i.test(problem);  // Math italic symbols
    }

    isIntegral(problem) {
        return /integrate|integral|∫|antiderivative/i.test(problem);
    }

    isDerivative(problem) {
        return /derive|derivative|differentiate|d\/dx|f'\(|f'/i.test(problem);
    }

    isCubicEquation(problem) {
        return (/[a-z]\^3|[a-z]³/i.test(problem) && /=/.test(problem)) || /cubic/i.test(problem);
    }

    isQuadraticEquation(problem) {
        return /[a-z]\^2|[a-z]²/.test(problem) && /=/.test(problem) && !/[a-z]\^3|[a-z]³/.test(problem);
    }

    isLinearEquation(problem) {
        return /[a-z]/.test(problem) && /=/.test(problem) && !/\^/.test(problem);
    }

    isSimplification(problem) {
        return /simplify|expand|factor/i.test(problem) || 
               (/[a-z]/.test(problem) && !/=/.test(problem) && /[\+\-\*\/]/.test(problem));
    }

    isSystem(problem) {
        return /system|and|,/.test(problem) && (problem.match(/=/g) || []).length > 1;
    }

    isArithmetic(problem) {
        return /^[\d\s\+\-\*\/\(\)\.\^\%]+$/.test(problem);
    }

    // ==================== SOLVING METHODS ====================

    /**
     * Solve basic arithmetic
     */
    solveArithmetic(problem, number) {
        const steps = [];
        let expression = problem.replace(/\s/g, '');
        
        steps.push({
            description: 'Original expression',
            math: problem
        });

        // Handle order of operations
        const hasParentheses = /\(/.test(expression);
        const hasExponents = /\^/.test(expression);
        const hasMulDiv = /[\*\/]/.test(expression);
        
        if (hasParentheses) {
            steps.push({
                description: 'Evaluate expressions inside parentheses first (PEMDAS)',
                math: expression
            });
        }
        
        if (hasExponents) {
            steps.push({
                description: 'Calculate exponents',
                math: expression
            });
        }
        
        if (hasMulDiv) {
            steps.push({
                description: 'Perform multiplication and division from left to right',
                math: expression
            });
        }

        try {
            const result = math.evaluate(expression);
            
            steps.push({
                description: 'Calculate the final result',
                math: `${expression} = ${this.formatNumber(result)}`
            });

            return {
                number,
                original: problem,
                type: 'Arithmetic',
                steps,
                answer: this.formatNumber(result)
            };
        } catch (e) {
            throw new Error('Could not evaluate arithmetic expression');
        }
    }

    /**
     * Solve linear equations (ax + b = c)
     */
    solveLinearEquation(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Original equation',
            math: problem
        });

        // Parse equation
        const [leftSide, rightSide] = problem.split('=').map(s => s.trim());
        
        if (!rightSide) {
            throw new Error('Invalid equation format');
        }

        steps.push({
            description: 'Identify left and right sides of the equation',
            math: `Left: ${leftSide}, Right: ${rightSide}`
        });

        // Try to solve using math.js
        try {
            // Find the variable
            const varMatch = problem.match(/[a-z]/i);
            const variable = varMatch ? varMatch[0] : 'x';
            
            // Simple linear equation solving
            const result = this.solveLinearManually(leftSide, rightSide, variable, steps);
            
            return {
                number,
                original: problem,
                type: 'Linear Equation',
                steps,
                answer: `${variable} = ${this.formatNumber(result)}`
            };
        } catch (e) {
            throw new Error('Could not solve linear equation: ' + e.message);
        }
    }

    solveLinearManually(left, right, variable, steps) {
        // Parse coefficients: ax + b = c
        let a = 0, b = 0, c = 0;
        
        // Extract from left side
        const leftParsed = this.parseLinearExpression(left, variable);
        a += leftParsed.coefficient;
        b += leftParsed.constant;
        
        // Extract from right side
        const rightParsed = this.parseLinearExpression(right, variable);
        a -= rightParsed.coefficient;
        b -= rightParsed.constant;
        c = -b;
        
        steps.push({
            description: `Collect all ${variable} terms on one side and constants on the other`,
            math: `${a}${variable} = ${c}`
        });

        if (a === 0) {
            throw new Error('No variable found or coefficient is zero');
        }

        const result = c / a;
        
        steps.push({
            description: `Divide both sides by ${a}`,
            math: `${variable} = ${c} ÷ ${a} = ${this.formatNumber(result)}`
        });

        return result;
    }

    parseLinearExpression(expr, variable) {
        let coefficient = 0;
        let constant = 0;
        
        // Normalize expression
        expr = expr.replace(/\s/g, '').replace(/\-/g, '+-');
        const terms = expr.split('+').filter(t => t);
        
        for (const term of terms) {
            if (term.includes(variable)) {
                // Coefficient term
                const coefStr = term.replace(variable, '').replace('*', '');
                if (coefStr === '' || coefStr === '+') {
                    coefficient += 1;
                } else if (coefStr === '-') {
                    coefficient -= 1;
                } else {
                    coefficient += parseFloat(coefStr);
                }
            } else {
                // Constant term
                constant += parseFloat(term) || 0;
            }
        }
        
        return { coefficient, constant };
    }

    /**
     * Solve quadratic equations (ax² + bx + c = 0)
     */
    solveQuadratic(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Original equation',
            math: problem
        });

        // Try using Nerdamer first for more accurate solving
        try {
            if (typeof nerdamer !== 'undefined') {
                const equation = problem.replace(/²/g, '^2');
                const solutions = nerdamer.solveEquations(equation, 'x');
                
                if (solutions && solutions.length > 0) {
                    steps.push({
                        description: 'Solve using algebraic methods',
                        math: `Solving ${equation}`
                    });
                    
                    const formatted = solutions.map((s, i) => `x${solutions.length > 1 ? '₁₂'[i] : ''} = ${s.toString()}`);
                    steps.push({
                        description: 'Solutions found',
                        math: formatted.join(', ')
                    });
                    
                    return {
                        number,
                        original: problem,
                        type: 'Quadratic Equation',
                        steps,
                        answer: formatted.join(', ')
                    };
                }
            }
        } catch (e) {
            // Fall through to manual solving
        }

        // Normalize the equation
        let equation = problem.replace(/²/g, '^2').replace(/\s/g, '');
        const variable = (equation.match(/[a-z]/i) || ['x'])[0];
        
        // Move everything to left side
        const [left, right] = equation.split('=');
        
        steps.push({
            description: 'Rewrite in standard form ax² + bx + c = 0',
            math: `${left} - (${right}) = 0`
        });

        // Parse coefficients
        const coeffs = this.parseQuadraticCoefficients(left, right, variable);
        const { a, b, c } = coeffs;
        
        steps.push({
            description: 'Identify coefficients',
            math: `a = ${a}, b = ${b}, c = ${c}`
        });

        // Calculate discriminant
        const discriminant = b * b - 4 * a * c;
        
        steps.push({
            description: 'Calculate discriminant: b² - 4ac',
            math: `Δ = (${b})² - 4(${a})(${c}) = ${b * b} - ${4 * a * c} = ${discriminant}`
        });

        let answer;
        if (discriminant > 0) {
            const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
            const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
            
            steps.push({
                description: 'Discriminant > 0, so there are two real solutions',
                math: `${variable} = (-b ± √Δ) / 2a`
            });
            
            steps.push({
                description: 'Apply the quadratic formula',
                math: `${variable}₁ = (${-b} + √${discriminant}) / ${2 * a} = ${this.formatNumber(x1)}`
            });
            
            steps.push({
                description: 'Calculate second solution',
                math: `${variable}₂ = (${-b} - √${discriminant}) / ${2 * a} = ${this.formatNumber(x2)}`
            });
            
            answer = `${variable}₁ = ${this.formatNumber(x1)}, ${variable}₂ = ${this.formatNumber(x2)}`;
        } else if (discriminant === 0) {
            const x = -b / (2 * a);
            
            steps.push({
                description: 'Discriminant = 0, so there is one repeated solution',
                math: `${variable} = -b / 2a = ${-b} / ${2 * a} = ${this.formatNumber(x)}`
            });
            
            answer = `${variable} = ${this.formatNumber(x)}`;
        } else {
            const realPart = -b / (2 * a);
            const imagPart = Math.sqrt(-discriminant) / (2 * a);
            
            steps.push({
                description: 'Discriminant < 0, so solutions are complex numbers',
                math: `${variable} = (-b ± i√|Δ|) / 2a`
            });
            
            steps.push({
                description: 'Calculate complex solutions',
                math: `${variable} = ${this.formatNumber(realPart)} ± ${this.formatNumber(imagPart)}i`
            });
            
            answer = `${variable} = ${this.formatNumber(realPart)} ± ${this.formatNumber(imagPart)}i`;
        }

        return {
            number,
            original: problem,
            type: 'Quadratic Equation',
            steps,
            answer
        };
    }

    parseQuadraticCoefficients(left, right, variable) {
        let a = 0, b = 0, c = 0;
        
        // Combine both sides
        const combined = `${left}-(${right || '0'})`.replace(/\s/g, '');
        const normalized = combined.replace(/\-/g, '+-').replace(/\+\+/g, '+');
        const terms = normalized.split('+').filter(t => t);
        
        for (const term of terms) {
            if (term.includes('^2') || term.includes('²')) {
                // Quadratic term
                const coef = term.replace(new RegExp(`${variable}\\^?2?`, 'g'), '').replace('*', '');
                a += coef === '' || coef === '+' ? 1 : (coef === '-' ? -1 : parseFloat(coef));
            } else if (term.includes(variable)) {
                // Linear term
                const coef = term.replace(variable, '').replace('*', '');
                b += coef === '' || coef === '+' ? 1 : (coef === '-' ? -1 : parseFloat(coef));
            } else if (term) {
                // Constant term
                c += parseFloat(term) || 0;
            }
        }
        
        return { a, b, c };
    }

    /**
     * Solve cubic equations ax³ + bx² + cx + d = 0
     */
    solveCubic(problem, number) {
        const steps = [];
        
        steps.push({ description: 'Original cubic equation', math: problem });
        
        // Try Nerdamer first
        try {
            if (typeof nerdamer !== 'undefined') {
                const equation = problem.replace(/³/g, '^3').replace(/²/g, '^2');
                const solutions = nerdamer.solveEquations(equation, 'x');
                
                if (solutions && solutions.length > 0) {
                    steps.push({ description: 'Solve using algebraic methods', math: `Solving ${equation}` });
                    const formatted = solutions.map((s, i) => `x${['₁','₂','₃'][i] || ''} = ${s.toString()}`);
                    steps.push({ description: 'Solutions found', math: formatted.join('\n') });
                    return { number, original: problem, type: 'Cubic Equation', steps, answer: formatted.join(', ') };
                }
            }
        } catch (e) {}
        
        // Parse coefficients: ax³ + bx² + cx + d = 0
        const expr = problem.replace(/³/g, '^3').replace(/²/g, '^2').replace(/=.*/, '').trim();
        let a = 0, b = 0, c = 0, d = 0;
        
        const terms = expr.replace(/-/g, '+-').split('+').filter(t => t.trim());
        for (const term of terms) {
            const t = term.trim();
            if (t.includes('x^3') || t.includes('x³')) {
                const coef = t.replace(/x\^?3?/, '').trim();
                a = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
            } else if (t.includes('x^2') || t.includes('x²')) {
                const coef = t.replace(/x\^?2?/, '').trim();
                b = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
            } else if (t.includes('x')) {
                const coef = t.replace('x', '').trim();
                c = coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : parseFloat(coef);
            } else if (t) {
                d = parseFloat(t) || 0;
            }
        }
        
        steps.push({ description: 'Identify coefficients', math: `a = ${a}, b = ${b}, c = ${c}, d = ${d}` });
        
        if (a === 0) {
            steps.push({ description: 'Note', math: 'Not a cubic (a = 0), solving as quadratic' });
            return this.solveQuadratic(problem, number);
        }
        
        // Cardano's formula
        // First, reduce to depressed cubic: t³ + pt + q = 0
        const p = (3*a*c - b*b) / (3*a*a);
        const q = (2*b*b*b - 9*a*b*c + 27*a*a*d) / (27*a*a*a);
        
        steps.push({ description: 'Convert to depressed cubic t³ + pt + q = 0', math: `p = ${this.formatNumber(p)}, q = ${this.formatNumber(q)}` });
        
        const discriminant = (q*q/4) + (p*p*p/27);
        steps.push({ description: 'Cubic discriminant', math: `Δ = q²/4 + p³/27 = ${this.formatNumber(discriminant)}` });
        
        const roots = [];
        
        if (discriminant > 0) {
            // One real root
            const sqrtDisc = Math.sqrt(discriminant);
            const u = Math.cbrt(-q/2 + sqrtDisc);
            const v = Math.cbrt(-q/2 - sqrtDisc);
            const t = u + v;
            const x = t - b/(3*a);
            
            steps.push({ description: 'One real root (discriminant > 0)', math: `x = ${this.formatNumber(x)}` });
            roots.push(x);
        } else if (discriminant === 0) {
            // Repeated roots
            const u = Math.cbrt(-q/2);
            const t1 = 2*u;
            const t2 = -u;
            const x1 = t1 - b/(3*a);
            const x2 = t2 - b/(3*a);
            
            steps.push({ description: 'Repeated roots (discriminant = 0)', math: `x₁ = ${this.formatNumber(x1)}, x₂ = ${this.formatNumber(x2)}` });
            roots.push(x1, x2);
        } else {
            // Three real roots (use trigonometric method)
            const r = Math.sqrt(-p*p*p/27);
            const theta = Math.acos(-q/(2*r));
            
            for (let k = 0; k < 3; k++) {
                const t = 2 * Math.cbrt(r) * Math.cos((theta + 2*Math.PI*k)/3);
                const x = t - b/(3*a);
                roots.push(x);
            }
            
            steps.push({ description: 'Three real roots (trigonometric method)', math: roots.map((r, i) => `x${['₁','₂','₃'][i]} = ${this.formatNumber(r)}`).join('\n') });
        }
        
        const answer = roots.map((r, i) => `x${['₁','₂','₃'][i] || ''} = ${this.formatNumber(r)}`).join(', ');
        return { number, original: problem, type: 'Cubic Equation', steps, answer };
    }

    /**
     * Solve derivatives
     */
    solveDerivative(problem, number) {
        const steps = [];
        
        // Extract the function to differentiate
        let func = problem.replace(/derive|derivative|differentiate|d\/dx|of|:/gi, '').trim();
        func = func.replace(/f\(x\)\s*=\s*/i, '').replace(/f'\(x\)/i, '').trim();
        
        steps.push({
            description: 'Original function',
            math: `f(x) = ${func}`
        });

        // Try using Algebrite first (more powerful symbolic math)
        let derivative;
        try {
            if (typeof Algebrite !== 'undefined') {
                derivative = Algebrite.run(`d(${func},x)`);
                steps.push({
                    description: 'Apply differentiation rules',
                    math: `d/dx[${func}]`
                });
            } else {
                derivative = this.computeDerivative(func, steps);
            }
        } catch (e) {
            derivative = this.computeDerivative(func, steps);
        }
        
        steps.push({
            description: 'Result',
            math: `f'(x) = ${derivative}`
        });
        
        return {
            number,
            original: problem,
            type: 'Derivative',
            steps,
            answer: `f'(x) = ${derivative}`
        };
    }

    computeDerivative(func, steps) {
        // Parse and differentiate term by term
        const normalized = func.replace(/\s/g, '').replace(/\-/g, '+-');
        const terms = normalized.split('+').filter(t => t);
        const derivatives = [];
        
        for (const term of terms) {
            const deriv = this.differentiateTerm(term, steps);
            if (deriv !== '0') {
                derivatives.push(deriv);
            }
        }
        
        const result = derivatives.join(' + ').replace(/\+ \-/g, '- ');
        
        steps.push({
            description: 'Combine all differentiated terms',
            math: `f'(x) = ${result || '0'}`
        });
        
        return result || '0';
    }

    differentiateTerm(term, steps) {
        // Power rule: d/dx[x^n] = n*x^(n-1)
        // Constant rule: d/dx[c] = 0
        
        if (!term.includes('x')) {
            steps.push({
                description: `Constant rule: derivative of ${term} is 0`,
                math: `d/dx[${term}] = 0`
            });
            return '0';
        }
        
        // Handle special functions
        // sin(x)
        if (/sin\s*\(\s*x\s*\)/i.test(term)) {
            const coefMatch = term.match(/^([\-\d\.]*)\s*sin/);
            const coef = coefMatch && coefMatch[1] ? parseFloat(coefMatch[1]) || 1 : 1;
            steps.push({ description: `d/dx[${term}]`, math: `= ${coef}cos(x)` });
            return coef === 1 ? 'cos(x)' : `${coef}cos(x)`;
        }
        
        // cos(x)
        if (/cos\s*\(\s*x\s*\)/i.test(term)) {
            const coefMatch = term.match(/^([\-\d\.]*)\s*cos/);
            const coef = coefMatch && coefMatch[1] ? parseFloat(coefMatch[1]) || 1 : 1;
            steps.push({ description: `d/dx[${term}]`, math: `= ${-coef}sin(x)` });
            return `${-coef}sin(x)`;
        }
        
        // tan(x)
        if (/tan\s*\(\s*x\s*\)/i.test(term)) {
            const coefMatch = term.match(/^([\-\d\.]*)\s*tan/);
            const coef = coefMatch && coefMatch[1] ? parseFloat(coefMatch[1]) || 1 : 1;
            steps.push({ description: `d/dx[${term}]`, math: `= ${coef}sec²(x)` });
            return coef === 1 ? 'sec²(x)' : `${coef}sec²(x)`;
        }
        
        // e^x
        if (/e\s*\^\s*x|exp\s*\(\s*x\s*\)/i.test(term)) {
            const coefMatch = term.match(/^([\-\d\.]*)\s*e\^/);
            const coef = coefMatch && coefMatch[1] ? parseFloat(coefMatch[1]) || 1 : 1;
            steps.push({ description: `d/dx[${term}]`, math: `= ${term} (exponential rule)` });
            return term;
        }
        
        // ln(x) or log(x)
        if (/ln\s*\(\s*x\s*\)|log\s*\(\s*x\s*\)/i.test(term)) {
            const coefMatch = term.match(/^([\-\d\.]*)\s*l/);
            const coef = coefMatch && coefMatch[1] ? parseFloat(coefMatch[1]) || 1 : 1;
            steps.push({ description: `d/dx[${term}]`, math: `= ${coef}/x` });
            return coef === 1 ? '1/x' : `${coef}/x`;
        }
        
        // sqrt(x) = x^(1/2)
        if (/sqrt\s*\(\s*x\s*\)|√x/i.test(term)) {
            steps.push({ description: `d/dx[${term}]`, math: `= 1/(2√x)` });
            return '1/(2√x)';
        }
        
        // Parse coefficient and exponent for polynomial
        let match = term.match(/^([\-\d\.]*)x\^?([\-\d\.]*)/);
        if (!match) {
            match = term.match(/^([\-\d\.]*)x/);
        }
        
        if (match) {
            let coef = match[1] === '' || match[1] === '+' ? 1 : (match[1] === '-' ? -1 : parseFloat(match[1]));
            let exp = match[2] ? parseFloat(match[2]) : 1;
            
            const newCoef = coef * exp;
            const newExp = exp - 1;
            
            steps.push({
                description: `Power rule: d/dx[${term}] = ${coef} × ${exp} × x^(${exp}-1)`,
                math: `= ${newCoef}x^${newExp}`
            });
            
            if (newExp === 0) return `${newCoef}`;
            if (newExp === 1) return `${newCoef}x`;
            if (newExp === -1) return `${newCoef}/x`;
            if (newExp === 0.5) return `${newCoef}√x`;
            return `${newCoef}x^${newExp}`;
        }
        
        return term;
    }

    /**
     * Solve integrals
     */
    solveIntegral(problem, number) {
        const steps = [];
        
        // Extract the function to integrate
        let func = problem.replace(/integrate|integral|∫|antiderivative|of|:/gi, '').trim();
        
        // Check for definite integral bounds
        const boundsMatch = func.match(/from\s*([\d\.\-]+)\s*to\s*([\d\.\-]+)/i);
        let lower = null, upper = null;
        if (boundsMatch) {
            lower = parseFloat(boundsMatch[1]);
            upper = parseFloat(boundsMatch[2]);
            func = func.replace(/from\s*[\d\.\-]+\s*to\s*[\d\.\-]+/i, '').trim();
        }
        
        func = func.replace(/dx/gi, '').trim();
        
        steps.push({
            description: 'Original function to integrate',
            math: `∫ ${func} dx`
        });

        // Try using Algebrite for symbolic integration
        let integral;
        try {
            if (typeof Algebrite !== 'undefined') {
                integral = Algebrite.run(`integral(${func},x)`);
                steps.push({
                    description: 'Apply integration rules',
                    math: `∫ ${func} dx = ${integral}`
                });
            } else {
                integral = this.computeIntegral(func, steps);
            }
        } catch (e) {
            integral = this.computeIntegral(func, steps);
        }
        
        // Handle definite integral
        if (lower !== null && upper !== null) {
            try {
                const integralExpr = integral.replace(/(\d)x/g, '$1*x');
                const F_upper = math.evaluate(integralExpr, { x: upper });
                const F_lower = math.evaluate(integralExpr, { x: lower });
                const result = F_upper - F_lower;
                
                steps.push({
                    description: `Evaluate from ${lower} to ${upper}`,
                    math: `F(${upper}) - F(${lower}) = ${this.formatNumber(result)}`
                });
                
                return {
                    number,
                    original: problem,
                    type: 'Definite Integral',
                    steps,
                    answer: this.formatNumber(result)
                };
            } catch (e) {}
        }
        
        return {
            number,
            original: problem,
            type: 'Indefinite Integral',
            steps,
            answer: `${integral} + C`
        };
    }

    computeIntegral(func, steps) {
        // Parse and integrate term by term
        const normalized = func.replace(/\s/g, '').replace(/\-/g, '+-');
        const terms = normalized.split('+').filter(t => t);
        const integrals = [];
        
        for (const term of terms) {
            const integ = this.integrateTerm(term, steps);
            integrals.push(integ);
        }
        
        const result = integrals.join(' + ').replace(/\+ \-/g, '- ');
        
        steps.push({
            description: 'Combine all integrated terms and add constant of integration',
            math: `∫f(x)dx = ${result} + C`
        });
        
        return result;
    }

    integrateTerm(term, steps) {
        // Power rule: ∫x^n dx = x^(n+1)/(n+1) for n ≠ -1
        
        const cleanTerm = term.trim();
        
        // Constant: ∫c dx = cx
        if (!cleanTerm.includes('x') && !cleanTerm.match(/sin|cos|tan|sec|csc|cot|ln|e\^|log/i)) {
            const c = parseFloat(cleanTerm);
            if (!isNaN(c)) {
                steps.push({
                    description: `Constant rule: ∫${c} dx = ${c}x`,
                    math: `∫${c} dx = ${c}x`
                });
                return `${c}x`;
            }
        }
        
        // ∫sin(x) dx = -cos(x)
        if (/^-?\d*\*?sin\(?x\)?$/i.test(cleanTerm)) {
            const coefMatch = cleanTerm.match(/^(-?\d*)\*?sin/i);
            const coef = coefMatch && coefMatch[1] ? (coefMatch[1] === '-' ? -1 : parseFloat(coefMatch[1])) : 1;
            const result = coef === 1 ? '-cos(x)' : coef === -1 ? 'cos(x)' : `${-coef}cos(x)`;
            steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result}` });
            return result;
        }
        
        // ∫cos(x) dx = sin(x)
        if (/^-?\d*\*?cos\(?x\)?$/i.test(cleanTerm)) {
            const coefMatch = cleanTerm.match(/^(-?\d*)\*?cos/i);
            const coef = coefMatch && coefMatch[1] ? (coefMatch[1] === '-' ? -1 : parseFloat(coefMatch[1])) : 1;
            const result = coef === 1 ? 'sin(x)' : `${coef}sin(x)`;
            steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result}` });
            return result;
        }
        
        // ∫sec²(x) dx = tan(x)
        if (/sec\^?2?\(?x\)?/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= tan(x)` });
            return 'tan(x)';
        }
        
        // ∫csc²(x) dx = -cot(x)
        if (/csc\^?2?\(?x\)?/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= -cot(x)` });
            return '-cot(x)';
        }
        
        // ∫sec(x)tan(x) dx = sec(x)
        if (/sec\(?x\)?[\s\*]*tan\(?x\)?/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= sec(x)` });
            return 'sec(x)';
        }
        
        // ∫csc(x)cot(x) dx = -csc(x)
        if (/csc\(?x\)?[\s\*]*cot\(?x\)?/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= -csc(x)` });
            return '-csc(x)';
        }
        
        // ∫e^x dx = e^x
        if (/^-?\d*\*?e\^x$/i.test(cleanTerm)) {
            const coefMatch = cleanTerm.match(/^(-?\d*)\*?e/i);
            const coef = coefMatch && coefMatch[1] ? (coefMatch[1] === '-' ? -1 : parseFloat(coefMatch[1])) : 1;
            const result = coef === 1 ? 'e^x' : `${coef}e^x`;
            steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result}` });
            return result;
        }
        
        // ∫e^(ax) dx = (1/a)e^(ax)
        if (/e\^\(?(-?\d+)x\)?/i.test(cleanTerm)) {
            const aMatch = cleanTerm.match(/e\^\(?(-?\d+)x\)?/i);
            const a = parseFloat(aMatch[1]);
            const result = `(1/${a})e^(${a}x)`;
            steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result} = ${this.formatNumber(1/a)}e^(${a}x)` });
            return `${this.formatNumber(1/a)}e^(${a}x)`;
        }
        
        // ∫1/x dx = ln|x|
        if (/^1\/x$|^x\^-1$/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= ln|x|` });
            return 'ln|x|';
        }
        
        // ∫ln(x) dx = x*ln(x) - x (integration by parts)
        if (/^ln\(?x\)?$/i.test(cleanTerm)) {
            steps.push({ description: `Integration by parts: ∫ln(x) dx`, math: `= x·ln(x) - x` });
            return 'x·ln(x) - x';
        }
        
        // ∫1/(1+x²) dx = arctan(x)
        if (/1\/\(1\+x\^?2\)|1\/\(1\s*\+\s*x\*\*2\)/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= arctan(x)` });
            return 'arctan(x)';
        }
        
        // ∫1/√(1-x²) dx = arcsin(x)
        if (/1\/sqrt\(1-x\^?2\)|1\/√\(1-x\^?2\)/i.test(cleanTerm)) {
            steps.push({ description: `∫${cleanTerm} dx`, math: `= arcsin(x)` });
            return 'arcsin(x)';
        }
        
        // Parse coefficient and exponent for power rule
        let match = cleanTerm.match(/^([\-\d\.]*)x\^?([\-\d\.]*)/);
        
        if (match) {
            let coef = match[1] === '' || match[1] === '+' ? 1 : (match[1] === '-' ? -1 : parseFloat(match[1]));
            let exp = match[2] ? parseFloat(match[2]) : 1;
            
            // Special case: ∫1/x dx = ln|x| (n = -1)
            if (exp === -1) {
                const result = coef === 1 ? 'ln|x|' : `${coef}ln|x|`;
                steps.push({ description: `∫${cleanTerm} dx (special case n = -1)`, math: `= ${result}` });
                return result;
            }
            
            const newExp = exp + 1;
            const newCoef = coef / newExp;
            
            steps.push({
                description: `Power rule: ∫${cleanTerm} dx = ${coef} × x^(${exp}+1)/(${exp}+1)`,
                math: `= ${this.formatNumber(newCoef)}x^${newExp}`
            });
            
            if (newExp === 1) return `${this.formatNumber(newCoef)}x`;
            if (newExp === 0) return `${this.formatNumber(newCoef)}`;
            return `${this.formatNumber(newCoef)}x^${newExp}`;
        }
        
        // Try Algebrite for complex integrals
        try {
            const result = Algebrite.run(`integral(${cleanTerm}, x)`).toString();
            if (result && result !== 'undefined' && !result.includes('integral')) {
                steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result}` });
                return result;
            }
        } catch (e) {}
        
        // Try Nerdamer
        try {
            const result = nerdamer(`integrate(${cleanTerm}, x)`).text();
            if (result && result !== cleanTerm) {
                steps.push({ description: `∫${cleanTerm} dx`, math: `= ${result}` });
                return result;
            }
        } catch (e) {}
        
        return cleanTerm + 'x';
    }

    /**
     * Simplify expressions
     */
    solveSimplification(problem, number) {
        const steps = [];
        
        let expr = problem.replace(/simplify|expand|factor|:/gi, '').trim();
        
        steps.push({
            description: 'Original expression',
            math: expr
        });

        // Check if this is factoring
        if (/factor/i.test(problem)) {
            try {
                const factored = Algebrite.run(`factor(${expr})`).toString();
                if (factored && factored !== expr && factored !== 'undefined') {
                    steps.push({
                        description: 'Factor the expression',
                        math: factored
                    });
                    return { number, original: problem, type: 'Factorization', steps, answer: factored };
                }
            } catch (e) {}
            
            // Try Nerdamer
            try {
                const factored = nerdamer(`factor(${expr})`).text();
                if (factored && factored !== expr) {
                    steps.push({
                        description: 'Factor the expression',
                        math: factored
                    });
                    return { number, original: problem, type: 'Factorization', steps, answer: factored };
                }
            } catch (e) {}
        }
        
        // Check if this is expansion
        if (/expand/i.test(problem)) {
            try {
                const expanded = Algebrite.run(`expand(${expr})`).toString();
                steps.push({
                    description: 'Expand the expression',
                    math: expanded
                });
                return { number, original: problem, type: 'Expansion', steps, answer: expanded };
            } catch (e) {}
            
            try {
                const expanded = nerdamer(expr).expand().text();
                steps.push({
                    description: 'Expand the expression',
                    math: expanded
                });
                return { number, original: problem, type: 'Expansion', steps, answer: expanded };
            } catch (e) {}
        }

        try {
            // Try multiple simplification strategies
            let simplified;
            
            // Try Algebrite first for symbolic simplification
            try {
                simplified = Algebrite.run(`simplify(${expr})`).toString();
                if (simplified && simplified !== 'undefined') {
                    steps.push({ description: 'Simplify symbolically', math: simplified });
                }
            } catch (e) {}
            
            // Then try math.js
            if (!simplified || simplified === 'undefined') {
                simplified = math.simplify(expr).toString();
                steps.push({ description: 'Combine like terms and simplify', math: simplified });
            }

            return {
                number,
                original: problem,
                type: 'Simplification',
                steps,
                answer: simplified
            };
        } catch (e) {
            throw new Error('Could not simplify expression');
        }
    }

    /**
     * Solve system of equations
     */
    solveSystem(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'System of equations',
            math: problem
        });

        // Try to extract two equations
        const equations = problem.match(/[^,;]+=[^,;]+/g);
        
        if (equations && equations.length >= 2) {
            steps.push({
                description: 'Identified equations',
                math: equations.map((e, i) => `Eq ${i+1}: ${e.trim()}`).join('\\n')
            });
            
            // Try Nerdamer for system solving
            try {
                const eq1 = equations[0].replace(/\s/g, '');
                const eq2 = equations[1].replace(/\s/g, '');
                
                // Find variables
                const vars = [...new Set([...eq1.matchAll(/[a-z]/gi)].map(m => m[0]))].slice(0, 2);
                
                if (vars.length >= 2) {
                    const solutions = nerdamer.solveEquations([eq1, eq2], vars);
                    
                    if (solutions && Object.keys(solutions).length > 0) {
                        const formatted = Object.entries(solutions).map(([v, val]) => `${v} = ${val}`);
                        steps.push({
                            description: 'Solution',
                            math: formatted.join(', ')
                        });
                        return { number, original: problem, type: 'System of Equations', steps, answer: formatted.join(', ') };
                    }
                }
            } catch (e) {
                // Fall through to manual method
            }
            
            // Try substitution method manually for simple cases
            const eq1 = equations[0].trim();
            const eq2 = equations[1].trim();
            
            // Check if one equation has form y = ... or x = ...
            const simpleForm = eq1.match(/^([xy])\s*=\s*(.+)$/i) || eq2.match(/^([xy])\s*=\s*(.+)$/i);
            
            if (simpleForm) {
                const solvedVar = simpleForm[1].toLowerCase();
                const expr = simpleForm[2];
                const otherEq = eq1.includes(`${solvedVar} =`) ? eq2 : eq1;
                
                steps.push({
                    description: 'Substitution method',
                    math: `Substitute ${solvedVar} = ${expr} into other equation`
                });
                
                try {
                    const otherVar = solvedVar === 'x' ? 'y' : 'x';
                    const substituted = otherEq.replace(new RegExp(solvedVar, 'gi'), `(${expr})`);
                    const solution = nerdamer.solve(substituted, otherVar).text();
                    
                    steps.push({ description: `Solve for ${otherVar}`, math: `${otherVar} = ${solution}` });
                    
                    // Back-substitute
                    const otherVal = math.evaluate(expr.replace(otherVar, solution));
                    steps.push({ description: `Back-substitute for ${solvedVar}`, math: `${solvedVar} = ${otherVal}` });
                    
                    return { number, original: problem, type: 'System of Equations', steps, answer: `${otherVar} = ${solution}, ${solvedVar} = ${otherVal}` };
                } catch (e) {}
            }
        }

        steps.push({
            description: 'For systems of equations, use substitution or elimination method',
            math: 'Method: Solve one equation for a variable, substitute into the other'
        });

        return {
            number,
            original: problem,
            type: 'System of Equations',
            steps,
            answer: 'Please solve using substitution or elimination method'
        };
    }

    // ==================== NEW ADVANCED SOLVERS ====================

    /**
     * Solve matrix problems
     */
    solveMatrix(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Matrix Problem',
            math: problem.substring(0, 150)
        });

        // Try to extract matrix from problem
        const matrixMatch = problem.match(/\[\s*\[([\d\s,\-\.]+)\](?:\s*,?\s*\[([\d\s,\-\.]+)\])*\s*\]/);
        
        if (matrixMatch) {
            // Parse matrix
            const rows = problem.match(/\[([\d\s,\-\.]+)\]/g);
            if (rows && rows.length > 0) {
                const matrix = rows.map(row => {
                    const nums = row.match(/-?[\d\.]+/g);
                    return nums ? nums.map(n => parseFloat(n)) : [];
                }).filter(r => r.length > 0);
                
                if (matrix.length > 0) {
                    steps.push({
                        description: 'Parsed matrix',
                        math: matrix.map(r => `[${r.join(', ')}]`).join('\n')
                    });
                    
                    const isSquare = matrix.length === matrix[0]?.length;
                    
                    // Determinant for square matrices
                    if (/determinant|det/i.test(problem) && isSquare) {
                        try {
                            const det = math.det(matrix);
                            steps.push({ description: 'Calculate determinant', math: `det(A) = ${this.formatNumber(det)}` });
                            return { number, original: problem, type: 'Matrix — Determinant', steps, answer: `Determinant = ${this.formatNumber(det)}` };
                        } catch (e) {}
                    }
                    
                    // Inverse
                    if (/inverse/i.test(problem)) {
                        try {
                            const det = math.det(matrix);
                            if (Math.abs(det) < 1e-10) {
                                steps.push({ description: 'Check determinant', math: `det = ${det} ≈ 0, matrix is singular (not invertible)` });
                                return { number, original: problem, type: 'Matrix — Inverse', steps, answer: 'Matrix is not invertible (singular)' };
                            }
                            const inv = math.inv(matrix);
                            const invStr = inv.map(r => `[${r.map(v => this.formatNumber(v)).join(', ')}]`).join('\n');
                            steps.push({ description: 'Calculate inverse', math: `A⁻¹ =\n${invStr}` });
                            return { number, original: problem, type: 'Matrix — Inverse', steps, answer: `Inverse:\n${invStr}` };
                        } catch (e) {
                            steps.push({ description: 'Note', math: 'Matrix is not invertible (determinant = 0)' });
                        }
                    }
                    
                    // Transpose
                    if (/transpose/i.test(problem)) {
                        const transposed = math.transpose(matrix);
                        const transStr = transposed.map(r => `[${r.join(', ')}]`).join('\n');
                        steps.push({ description: 'Transpose (swap rows and columns)', math: `Aᵀ =\n${transStr}` });
                        return { number, original: problem, type: 'Matrix — Transpose', steps, answer: `Transpose:\n${transStr}` };
                    }
                    
                    // Eigenvalues for 2x2 matrix
                    if (/eigenvalue|eigen/i.test(problem) && isSquare && matrix.length === 2) {
                        const a = matrix[0][0], b = matrix[0][1], c = matrix[1][0], d = matrix[1][1];
                        const trace = a + d;
                        const det = a * d - b * c;
                        const discriminant = trace * trace - 4 * det;
                        
                        steps.push({ description: 'Characteristic equation', math: 'det(A - λI) = 0' });
                        steps.push({ description: 'For 2×2 matrix', math: `λ² - trace(A)λ + det(A) = 0` });
                        steps.push({ description: 'Calculate trace and det', math: `trace = ${trace}, det = ${det}` });
                        steps.push({ description: 'Equation', math: `λ² - ${trace}λ + ${det} = 0` });
                        
                        if (discriminant >= 0) {
                            const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
                            const lambda2 = (trace - Math.sqrt(discriminant)) / 2;
                            steps.push({ description: 'Eigenvalues', math: `λ₁ = ${this.formatNumber(lambda1)}, λ₂ = ${this.formatNumber(lambda2)}` });
                            return { number, original: problem, type: 'Matrix — Eigenvalues', steps, answer: `λ₁ = ${this.formatNumber(lambda1)}, λ₂ = ${this.formatNumber(lambda2)}` };
                        } else {
                            const real = trace / 2;
                            const imag = Math.sqrt(-discriminant) / 2;
                            steps.push({ description: 'Complex eigenvalues', math: `λ = ${this.formatNumber(real)} ± ${this.formatNumber(imag)}i` });
                            return { number, original: problem, type: 'Matrix — Eigenvalues', steps, answer: `λ = ${this.formatNumber(real)} ± ${this.formatNumber(imag)}i` };
                        }
                    }
                    
                    // Trace
                    if (/trace/i.test(problem) && isSquare) {
                        let trace = 0;
                        for (let i = 0; i < matrix.length; i++) {
                            trace += matrix[i][i];
                        }
                        steps.push({ description: 'Trace (sum of diagonal)', math: `tr(A) = ${trace}` });
                        return { number, original: problem, type: 'Matrix — Trace', steps, answer: `Trace = ${trace}` };
                    }
                    
                    // Rank
                    if (/rank/i.test(problem)) {
                        // Simple rank calculation via row reduction
                        const reduced = this.rowEchelon([...matrix.map(r => [...r])]);
                        const rank = reduced.filter(row => row.some(v => Math.abs(v) > 1e-10)).length;
                        steps.push({ description: 'Row echelon form', math: reduced.map(r => `[${r.map(v => this.formatNumber(v)).join(', ')}]`).join('\n') });
                        steps.push({ description: 'Rank (number of non-zero rows)', math: `rank(A) = ${rank}` });
                        return { number, original: problem, type: 'Matrix — Rank', steps, answer: `Rank = ${rank}` };
                    }
                    
                    // Matrix multiplication if two matrices given
                    const allMatrices = problem.match(/\[\[[\d\s,\-\.;\[\]]+\]\]/g);
                    if (/multiply|product|×|\*/i.test(problem) && allMatrices && allMatrices.length === 2) {
                        try {
                            const m1 = math.evaluate(allMatrices[0]);
                            const m2 = math.evaluate(allMatrices[1]);
                            const product = math.multiply(m1, m2);
                            const prodStr = product.map(r => `[${r.map(v => this.formatNumber(v)).join(', ')}]`).join('\n');
                            steps.push({ description: 'Matrix multiplication', math: `A × B =\n${prodStr}` });
                            return { number, original: problem, type: 'Matrix — Product', steps, answer: `Product:\n${prodStr}` };
                        } catch (e) {}
                    }
                    
                    // Default: show all basic info
                    if (isSquare) {
                        const det = math.det(matrix);
                        const trace = matrix.reduce((sum, row, i) => sum + row[i], 0);
                        steps.push({ description: 'Determinant', math: `det(A) = ${this.formatNumber(det)}` });
                        steps.push({ description: 'Trace', math: `tr(A) = ${trace}` });
                        return { number, original: problem, type: 'Matrix Analysis', steps, answer: `det = ${this.formatNumber(det)}, trace = ${trace}` };
                    }
                }
            }
        }
        
        steps.push({
            description: 'Matrix operations',
            math: 'Supported: determinant, inverse, transpose, eigenvalues, trace, rank. Format: [[a,b],[c,d]]'
        });
        
        return { number, original: problem, type: 'Matrix', steps, answer: 'Enter matrix in format [[a,b],[c,d]]' };
    }
    
    /**
     * Row echelon form helper
     */
    rowEchelon(matrix) {
        const m = matrix.length;
        const n = matrix[0].length;
        let lead = 0;
        
        for (let r = 0; r < m; r++) {
            if (lead >= n) break;
            let i = r;
            while (Math.abs(matrix[i][lead]) < 1e-10) {
                i++;
                if (i === m) {
                    i = r;
                    lead++;
                    if (lead === n) return matrix;
                }
            }
            [matrix[i], matrix[r]] = [matrix[r], matrix[i]];
            const lv = matrix[r][lead];
            matrix[r] = matrix[r].map(v => v / lv);
            for (let i = 0; i < m; i++) {
                if (i !== r) {
                    const lv = matrix[i][lead];
                    matrix[i] = matrix[i].map((v, j) => v - lv * matrix[r][j]);
                }
            }
            lead++;
        }
        return matrix;
    }

    /**
     * Solve statistics problems
     */
    solveStatistics(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Statistics Problem',
            math: problem.substring(0, 150)
        });

        // Extract numbers from problem
        const numbers = problem.match(/-?[\d\.]+/g);
        if (numbers && numbers.length > 1) {
            const data = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));
            
            steps.push({
                description: 'Data set',
                math: data.join(', ')
            });
            
            const n = data.length;
            
            // Mean
            const mean = data.reduce((a, b) => a + b, 0) / n;
            steps.push({ description: 'Mean (average)', math: `μ = Σx/n = ${data.reduce((a,b)=>a+b,0)}/${n} = ${this.formatNumber(mean)}` });
            
            // Median
            const sorted = [...data].sort((a, b) => a - b);
            const mid = Math.floor(n / 2);
            const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            steps.push({ description: 'Median (middle value)', math: `Sorted: [${sorted.join(', ')}], Median = ${median}` });
            
            // Mode
            const freq = {};
            data.forEach(x => freq[x] = (freq[x] || 0) + 1);
            const maxFreq = Math.max(...Object.values(freq));
            const modes = Object.keys(freq).filter(k => freq[k] === maxFreq);
            const modeStr = maxFreq > 1 ? modes.join(', ') : 'No mode (all values appear once)';
            steps.push({ description: 'Mode (most frequent)', math: modeStr });
            
            // Range
            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min;
            steps.push({ description: 'Range', math: `Range = Max - Min = ${max} - ${min} = ${range}` });
            
            // Variance and Standard Deviation (population)
            const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
            const stdDev = Math.sqrt(variance);
            steps.push({ description: 'Population Variance', math: `σ² = Σ(x-μ)²/n = ${this.formatNumber(variance)}` });
            steps.push({ description: 'Population Standard Deviation', math: `σ = √σ² = ${this.formatNumber(stdDev)}` });
            
            // Sample variance and std dev (if n > 1)
            if (n > 1) {
                const sampleVar = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
                const sampleStdDev = Math.sqrt(sampleVar);
                steps.push({ description: 'Sample Variance (s²)', math: `s² = Σ(x-μ)²/(n-1) = ${this.formatNumber(sampleVar)}` });
                steps.push({ description: 'Sample Standard Deviation (s)', math: `s = ${this.formatNumber(sampleStdDev)}` });
            }
            
            // Quartiles
            const q1Idx = Math.floor(n * 0.25);
            const q3Idx = Math.floor(n * 0.75);
            const q1 = sorted[q1Idx];
            const q3 = sorted[q3Idx];
            const iqr = q3 - q1;
            steps.push({ description: 'Quartiles', math: `Q1 = ${q1}, Q2 (Median) = ${median}, Q3 = ${q3}` });
            steps.push({ description: 'Interquartile Range (IQR)', math: `IQR = Q3 - Q1 = ${q3} - ${q1} = ${iqr}` });
            
            // Sum and Sum of squares
            const sum = data.reduce((a, b) => a + b, 0);
            const sumSq = data.reduce((a, b) => a + b * b, 0);
            steps.push({ description: 'Sum', math: `Σx = ${sum}` });
            steps.push({ description: 'Sum of Squares', math: `Σx² = ${this.formatNumber(sumSq)}` });
            
            // Coefficient of Variation
            const cv = (stdDev / Math.abs(mean)) * 100;
            if (mean !== 0) {
                steps.push({ description: 'Coefficient of Variation', math: `CV = (σ/μ) × 100% = ${this.formatNumber(cv)}%` });
            }

            return {
                number,
                original: problem,
                type: 'Statistics',
                steps,
                answer: `n=${n}, Mean=${this.formatNumber(mean)}, Median=${median}, Std Dev=${this.formatNumber(stdDev)}, Range=${range}`
            };
        }
        
        // Probability keywords
        if (/probability|P\(|binomial|normal|poisson/i.test(problem)) {
            steps.push({
                description: 'Probability concepts',
                math: 'P(A) = favorable outcomes / total outcomes\nP(A∪B) = P(A) + P(B) - P(A∩B)\nP(A|B) = P(A∩B) / P(B)'
            });
            
            // Binomial: C(n,k) * p^k * (1-p)^(n-k)
            const binomMatch = problem.match(/binomial.*n\s*=\s*(\d+).*(?:k|x)\s*=\s*(\d+).*p\s*=\s*([\d.]+)/i);
            if (binomMatch) {
                const n = parseInt(binomMatch[1]);
                const k = parseInt(binomMatch[2]);
                const p = parseFloat(binomMatch[3]);
                const q = 1 - p;
                
                const nCk = this.factorial(n) / (this.factorial(k) * this.factorial(n - k));
                const prob = nCk * Math.pow(p, k) * Math.pow(q, n - k);
                
                steps.push({ description: 'Binomial probability', math: `P(X=${k}) = C(${n},${k}) × ${p}^${k} × ${q.toFixed(2)}^${n-k}` });
                steps.push({ description: 'Calculate', math: `= ${nCk} × ${Math.pow(p,k).toFixed(6)} × ${Math.pow(q,n-k).toFixed(6)} = ${this.formatNumber(prob)}` });
                
                return { number, original: problem, type: 'Probability — Binomial', steps, answer: `P(X=${k}) = ${this.formatNumber(prob)}` };
            }
        }
        
        return { number, original: problem, type: 'Statistics', steps, answer: 'Provide numerical data for analysis' };
    }
    
    factorial(n) {
        if (n <= 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
    }

    /**
     * Solve limit problems
     */
    solveLimit(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Limit Problem',
            math: problem.substring(0, 150)
        });

        // Try to parse limit: lim x→a f(x)
        const limitMatch = problem.match(/lim(?:it)?\s*(?:as\s+)?(\w)\s*(?:→|->)+\s*(-?[\d\.]+|infinity|∞|inf)/i);
        
        if (limitMatch) {
            const variable = limitMatch[1];
            const approach = limitMatch[2].toLowerCase();
            
            steps.push({
                description: 'Limit setup',
                math: `lim ${variable}→${approach}`
            });
            
            // Extract function after the limit notation
            const funcMatch = problem.match(/(?:→|->)+\s*(?:-?[\d\.]+|infinity|∞|inf)\s*(?:of\s*)?(.*)/i);
            if (funcMatch) {
                let func = funcMatch[1].trim();
                func = func.replace(/\s/g, '').replace(/\^/g, '**');
                
                steps.push({ description: 'Function', math: func.replace(/\*\*/g, '^') });
                
                // Handle infinity limits
                if (approach === 'infinity' || approach === '∞' || approach === 'inf') {
                    // Check for rational function (polynomial/polynomial)
                    const rationalMatch = func.match(/\(([^)]+)\)\/\(([^)]+)\)|([^/]+)\/([^/]+)/);
                    if (rationalMatch) {
                        const numer = rationalMatch[1] || rationalMatch[3];
                        const denom = rationalMatch[2] || rationalMatch[4];
                        
                        // Find highest power in each
                        const numerPower = this.getHighestPower(numer, variable);
                        const denomPower = this.getHighestPower(denom, variable);
                        
                        steps.push({
                            description: 'Compare degrees',
                            math: `Numerator degree: ${numerPower}, Denominator degree: ${denomPower}`
                        });
                        
                        if (numerPower < denomPower) {
                            steps.push({ description: 'Result', math: 'Limit = 0 (numerator grows slower)' });
                            return { number, original: problem, type: 'Limit', steps, answer: 'Limit = 0' };
                        } else if (numerPower > denomPower) {
                            steps.push({ description: 'Result', math: 'Limit = ±∞ (numerator grows faster)' });
                            return { number, original: problem, type: 'Limit', steps, answer: 'Limit = ∞' };
                        } else {
                            // Get leading coefficients
                            const numerCoef = this.getLeadingCoefficient(numer, variable, numerPower);
                            const denomCoef = this.getLeadingCoefficient(denom, variable, denomPower);
                            const ratio = numerCoef / denomCoef;
                            steps.push({ description: 'Equal degrees - take ratio of leading coefficients', math: `Limit = ${numerCoef}/${denomCoef} = ${this.formatNumber(ratio)}` });
                            return { number, original: problem, type: 'Limit', steps, answer: `Limit = ${this.formatNumber(ratio)}` };
                        }
                    }
                    
                    // Try 1/x form → 0
                    if (/^1\//.test(func) || func.includes(`1/${variable}`)) {
                        steps.push({ description: 'Form 1/x as x→∞', math: 'Limit = 0' });
                        return { number, original: problem, type: 'Limit', steps, answer: 'Limit = 0' };
                    }
                } else {
                    // Finite limit - try direct substitution
                    const value = parseFloat(approach);
                    try {
                        const clean = func.replace(new RegExp(variable, 'g'), `(${value})`);
                        const result = math.evaluate(clean);
                        
                        if (isFinite(result) && !isNaN(result)) {
                            steps.push({
                                description: 'Direct substitution',
                                math: `Substitute ${variable} = ${value}: ${this.formatNumber(result)}`
                            });
                            return { number, original: problem, type: 'Limit', steps, answer: `Limit = ${this.formatNumber(result)}` };
                        }
                    } catch (e) {}
                    
                    // Indeterminate form - try L'Hôpital's rule
                    steps.push({
                        description: 'Indeterminate form detected',
                        math: 'Applying L\'Hôpital\'s rule: differentiate numerator and denominator'
                    });
                    
                    // Try factoring for x→a form
                    if (func.includes('/')) {
                        const [numer, denom] = func.split('/');
                        try {
                            // Factor out (x - a) if possible
                            const numerDeriv = Algebrite.run(`d(${numer}, ${variable})`).toString();
                            const denomDeriv = Algebrite.run(`d(${denom}, ${variable})`).toString();
                            
                            const newNumer = numerDeriv.replace(new RegExp(variable, 'g'), `(${value})`);
                            const newDenom = denomDeriv.replace(new RegExp(variable, 'g'), `(${value})`);
                            
                            const result = math.evaluate(newNumer) / math.evaluate(newDenom);
                            
                            if (isFinite(result)) {
                                steps.push({
                                    description: 'L\'Hôpital\'s rule',
                                    math: `lim = ${numerDeriv}/${denomDeriv} at ${variable}=${value} = ${this.formatNumber(result)}`
                                });
                                return { number, original: problem, type: 'Limit', steps, answer: `Limit = ${this.formatNumber(result)}` };
                            }
                        } catch (e) {}
                    }
                }
            }
        }
        
        steps.push({
            description: 'Limit evaluation methods',
            math: '1. Direct substitution\n2. Factoring\n3. L\'Hôpital\'s rule for 0/0 or ∞/∞\n4. Squeeze theorem'
        });
        
        return { number, original: problem, type: 'Limit', steps, answer: 'Apply limit techniques as needed' };
    }

    /**
     * Get highest power of variable in expression
     */
    getHighestPower(expr, variable) {
        const powerMatch = expr.match(new RegExp(`${variable}\\*\\*(\\d+)|${variable}\\^(\\d+)`, 'g'));
        let maxPower = expr.includes(variable) ? 1 : 0;
        
        if (powerMatch) {
            for (const match of powerMatch) {
                const power = parseInt(match.replace(variable, '').replace(/[\*\^]/g, '')) || 1;
                maxPower = Math.max(maxPower, power);
            }
        }
        return maxPower;
    }

    /**
     * Get leading coefficient for a polynomial term
     */
    getLeadingCoefficient(expr, variable, power) {
        const pattern = power === 1 
            ? new RegExp(`([+-]?\\d*)\\*?${variable}(?![\\^\\d])`)
            : new RegExp(`([+-]?\\d*)\\*?${variable}[\\*\\^]+${power}`);
        const match = expr.match(pattern);
        if (match) {
            const coef = match[1];
            if (coef === '' || coef === '+') return 1;
            if (coef === '-') return -1;
            return parseFloat(coef);
        }
        return 1;
    }

    /**
     * Solve series and sequence problems
     */
    solveSeries(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Series/Sequence Problem',
            math: problem.substring(0, 150)
        });

        // Arithmetic sequence: a, a+d, a+2d, ...
        if (/arithmetic/i.test(problem)) {
            const nums = problem.match(/-?[\d\.]+/g);
            if (nums && nums.length >= 2) {
                const a1 = parseFloat(nums[0]);
                const d = nums.length >= 3 ? parseFloat(nums[1]) - a1 : parseFloat(nums[1]);
                
                steps.push({ description: 'First term (a₁)', math: `a₁ = ${a1}` });
                steps.push({ description: 'Common difference (d)', math: `d = ${d}` });
                steps.push({ description: 'nth term formula', math: `aₙ = a₁ + (n-1)d = ${a1} + (n-1)×${d}` });
                steps.push({ description: 'Sum formula', math: `Sₙ = n/2 × (2a₁ + (n-1)d)` });
                
                return { number, original: problem, type: 'Arithmetic Sequence', steps, answer: `aₙ = ${a1} + (n-1)×${d}` };
            }
        }
        
        // Geometric sequence: a, ar, ar², ...
        if (/geometric/i.test(problem)) {
            const nums = problem.match(/-?[\d\.]+/g);
            if (nums && nums.length >= 2) {
                const a1 = parseFloat(nums[0]);
                const r = parseFloat(nums[1]) / a1;
                
                steps.push({ description: 'First term (a₁)', math: `a₁ = ${a1}` });
                steps.push({ description: 'Common ratio (r)', math: `r = ${r}` });
                steps.push({ description: 'nth term formula', math: `aₙ = a₁ × r^(n-1) = ${a1} × ${r}^(n-1)` });
                steps.push({ description: 'Sum formula (|r| < 1)', math: `S∞ = a₁/(1-r) = ${a1/(1-r)}` });
                
                return { number, original: problem, type: 'Geometric Sequence', steps, answer: `aₙ = ${a1} × ${r}^(n-1)` };
            }
        }
        
        // Sum notation ∑
        if (/sum|∑/i.test(problem)) {
            const fromMatch = problem.match(/from\s*(\d+)\s*to\s*(\d+)/i);
            if (fromMatch) {
                const start = parseInt(fromMatch[1]);
                const end = parseInt(fromMatch[2]);
                
                // Simple sum of integers
                if (/integers|numbers|\bn\b/i.test(problem)) {
                    const sum = (end * (end + 1) / 2) - ((start - 1) * start / 2);
                    steps.push({ description: 'Sum of integers formula', math: `∑n = n(n+1)/2` });
                    steps.push({ description: 'Calculate', math: `∑n from ${start} to ${end} = ${end}(${end}+1)/2 - ${start-1}(${start})/2 = ${sum}` });
                    return { number, original: problem, type: 'Series Sum', steps, answer: `Sum = ${sum}` };
                }
                
                // Sum of squares
                if (/squares|n²|n\^2/i.test(problem)) {
                    const sumSq = (end * (end + 1) * (2 * end + 1)) / 6 - ((start - 1) * start * (2 * (start - 1) + 1)) / 6;
                    steps.push({ description: 'Sum of squares formula', math: `∑n² = n(n+1)(2n+1)/6` });
                    steps.push({ description: 'Calculate', math: `∑n² from ${start} to ${end} = ${sumSq}` });
                    return { number, original: problem, type: 'Series Sum', steps, answer: `Sum = ${sumSq}` };
                }
                
                // Sum of cubes
                if (/cubes|n³|n\^3/i.test(problem)) {
                    const n = end;
                    const sumCub = Math.pow((n * (n + 1)) / 2, 2);
                    steps.push({ description: 'Sum of cubes formula', math: `∑n³ = [n(n+1)/2]²` });
                    steps.push({ description: 'Calculate', math: `∑n³ from 1 to ${end} = ${sumCub}` });
                    return { number, original: problem, type: 'Series Sum', steps, answer: `Sum = ${sumCub}` };
                }
                
                // Generic sum - try to compute
                const exprMatch = problem.match(/of\s+(.+?)\s+from/i);
                if (exprMatch) {
                    let expr = exprMatch[1].trim();
                    let total = 0;
                    for (let n = start; n <= end; n++) {
                        try {
                            total += math.evaluate(expr.replace(/n/g, n.toString()));
                        } catch (e) { break; }
                    }
                    steps.push({ description: 'Compute sum', math: `∑(${expr}) from ${start} to ${end} = ${total}` });
                    return { number, original: problem, type: 'Series Sum', steps, answer: `Sum = ${total}` };
                }
            }
        }
        
        // Find nth term from sequence
        const seqMatch = problem.match(/sequence[:\s]+([\d,\s]+)/i);
        if (seqMatch) {
            const nums = seqMatch[1].split(',').map(n => parseFloat(n.trim()));
            if (nums.length >= 3) {
                // Check arithmetic
                const diffs = [];
                for (let i = 1; i < nums.length; i++) diffs.push(nums[i] - nums[i-1]);
                if (diffs.every(d => d === diffs[0])) {
                    const a1 = nums[0], d = diffs[0];
                    steps.push({ description: 'Arithmetic sequence detected', math: `a₁ = ${a1}, d = ${d}` });
                    steps.push({ description: 'nth term', math: `aₙ = ${a1} + (n-1)×${d} = ${a1 - d} + ${d}n` });
                    return { number, original: problem, type: 'Arithmetic Sequence', steps, answer: `aₙ = ${a1} + (n-1)×${d}` };
                }
                
                // Check geometric
                const ratios = [];
                for (let i = 1; i < nums.length; i++) ratios.push(nums[i] / nums[i-1]);
                if (ratios.every(r => Math.abs(r - ratios[0]) < 0.0001)) {
                    const a1 = nums[0], r = ratios[0];
                    steps.push({ description: 'Geometric sequence detected', math: `a₁ = ${a1}, r = ${r}` });
                    steps.push({ description: 'nth term', math: `aₙ = ${a1} × ${r}^(n-1)` });
                    return { number, original: problem, type: 'Geometric Sequence', steps, answer: `aₙ = ${a1} × ${r}^(n-1)` };
                }
            }
        }
        
        return { number, original: problem, type: 'Series/Sequence', steps, answer: 'Identify pattern and apply formula' };
    }

    /**
     * Solve logarithm problems
     */
    solveLogarithm(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Logarithm Problem',
            math: problem.substring(0, 150)
        });

        // Solve log equations like log(x) = 2, log_2(x) = 5, ln(x) = 3
        const logEqMatch = problem.match(/log(?:_?(\d+))?\s*\(?\s*x\s*\)?\s*=\s*(-?[\d\.]+)/i);
        const lnEqMatch = problem.match(/ln\s*\(?\s*x\s*\)?\s*=\s*(-?[\d\.]+)/i);
        
        if (lnEqMatch) {
            const y = parseFloat(lnEqMatch[1]);
            const x = Math.exp(y);
            steps.push({ description: 'Equation: ln(x) = ' + y, math: `x = e^${y}` });
            steps.push({ description: 'Calculate', math: `x = ${this.formatNumber(x)}` });
            return { number, original: problem, type: 'Logarithm Equation', steps, answer: `x = e^${y} = ${this.formatNumber(x)}` };
        }
        
        if (logEqMatch) {
            const base = logEqMatch[1] ? parseFloat(logEqMatch[1]) : 10;
            const y = parseFloat(logEqMatch[2]);
            const x = Math.pow(base, y);
            steps.push({ description: `Equation: log_${base}(x) = ${y}`, math: `x = ${base}^${y}` });
            steps.push({ description: 'Calculate', math: `x = ${this.formatNumber(x)}` });
            return { number, original: problem, type: 'Logarithm Equation', steps, answer: `x = ${base}^${y} = ${this.formatNumber(x)}` };
        }
        
        // Solve exponential equations like 2^x = 8, e^x = 10
        const expEqMatch = problem.match(/(\d+)\s*\^\s*x\s*=\s*(\d+)/i);
        const eExpMatch = problem.match(/e\s*\^\s*x\s*=\s*(-?[\d\.]+)/i);
        
        if (eExpMatch) {
            const y = parseFloat(eExpMatch[1]);
            const x = Math.log(y);
            steps.push({ description: 'Equation: e^x = ' + y, math: 'Take natural log of both sides' });
            steps.push({ description: 'Solve', math: `x = ln(${y}) = ${this.formatNumber(x)}` });
            return { number, original: problem, type: 'Exponential Equation', steps, answer: `x = ln(${y}) = ${this.formatNumber(x)}` };
        }
        
        if (expEqMatch) {
            const base = parseFloat(expEqMatch[1]);
            const y = parseFloat(expEqMatch[2]);
            const x = Math.log(y) / Math.log(base);
            steps.push({ description: `Equation: ${base}^x = ${y}`, math: 'Take log of both sides' });
            steps.push({ description: 'Solve', math: `x = log_${base}(${y}) = ln(${y})/ln(${base})` });
            steps.push({ description: 'Calculate', math: `x = ${this.formatNumber(x)}` });
            
            // Check if answer is an integer
            if (Math.abs(x - Math.round(x)) < 0.0001) {
                return { number, original: problem, type: 'Exponential Equation', steps, answer: `x = ${Math.round(x)}` };
            }
            return { number, original: problem, type: 'Exponential Equation', steps, answer: `x = ${this.formatNumber(x)}` };
        }

        // log_b(x) = y means b^y = x
        const logMatch = problem.match(/log(?:_?(\d+))?\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i);
        const lnMatch = problem.match(/ln\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i);
        
        if (lnMatch) {
            const x = parseFloat(lnMatch[1]);
            const result = Math.log(x);
            
            steps.push({ description: 'Natural logarithm', math: `ln(${x})` });
            
            // Check for exact values
            if (x === 1) {
                steps.push({ description: 'Exact value', math: 'ln(1) = 0' });
                return { number, original: problem, type: 'Natural Logarithm', steps, answer: 'ln(1) = 0' };
            }
            if (x === Math.E) {
                steps.push({ description: 'Exact value', math: 'ln(e) = 1' });
                return { number, original: problem, type: 'Natural Logarithm', steps, answer: 'ln(e) = 1' };
            }
            
            steps.push({ description: 'Calculate', math: `= ${this.formatNumber(result)}` });
            
            return { number, original: problem, type: 'Natural Logarithm', steps, answer: `ln(${x}) = ${this.formatNumber(result)}` };
        }
        
        if (logMatch) {
            const base = logMatch[1] ? parseFloat(logMatch[1]) : 10;
            const x = parseFloat(logMatch[2]);
            const result = Math.log(x) / Math.log(base);
            
            steps.push({ description: 'Logarithm', math: `log_${base}(${x})` });
            steps.push({ description: 'Using change of base', math: `= ln(${x}) / ln(${base})` });
            
            // Check if result is a nice integer
            if (Math.abs(result - Math.round(result)) < 0.0001) {
                const intResult = Math.round(result);
                steps.push({ description: 'Exact value', math: `= ${intResult} (since ${base}^${intResult} = ${x})` });
                return { number, original: problem, type: 'Logarithm', steps, answer: `log_${base}(${x}) = ${intResult}` };
            }
            
            steps.push({ description: 'Calculate', math: `= ${this.formatNumber(result)}` });
            
            return { number, original: problem, type: 'Logarithm', steps, answer: `log_${base}(${x}) = ${this.formatNumber(result)}` };
        }
        
        // Simplify logarithm expressions like log(a*b), log(a/b), log(a^n)
        const logProductMatch = problem.match(/log\s*\(?\s*(\d+)\s*[\*×]\s*(\d+)\s*\)?/i);
        if (logProductMatch) {
            const a = parseFloat(logProductMatch[1]);
            const b = parseFloat(logProductMatch[2]);
            steps.push({ description: 'Product rule', math: `log(${a} × ${b}) = log(${a}) + log(${b})` });
            const result = Math.log10(a) + Math.log10(b);
            steps.push({ description: 'Calculate', math: `= ${this.formatNumber(Math.log10(a))} + ${this.formatNumber(Math.log10(b))} = ${this.formatNumber(result)}` });
            return { number, original: problem, type: 'Logarithm', steps, answer: `log(${a*b}) = ${this.formatNumber(result)}` };
        }
        
        const logPowerMatch = problem.match(/log\s*\(?\s*(\d+)\s*\^\s*(\d+)\s*\)?/i);
        if (logPowerMatch) {
            const a = parseFloat(logPowerMatch[1]);
            const n = parseFloat(logPowerMatch[2]);
            steps.push({ description: 'Power rule', math: `log(${a}^${n}) = ${n} × log(${a})` });
            const result = n * Math.log10(a);
            steps.push({ description: 'Calculate', math: `= ${n} × ${this.formatNumber(Math.log10(a))} = ${this.formatNumber(result)}` });
            return { number, original: problem, type: 'Logarithm', steps, answer: `log(${a}^${n}) = ${this.formatNumber(result)}` };
        }
        
        // Log properties
        steps.push({
            description: 'Logarithm properties',
            math: 'log(ab) = log(a) + log(b)\nlog(a/b) = log(a) - log(b)\nlog(a^n) = n×log(a)'
        });
        
        return { number, original: problem, type: 'Logarithm', steps, answer: 'Apply logarithm properties' };
    }

    /**
     * Solve trigonometry problems
     */
    solveTrigonometry(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Trigonometry Problem',
            math: problem.substring(0, 150)
        });

        // Extract angle
        const angleMatch = problem.match(/(sin|cos|tan|cot|sec|csc)\s*\(?\s*(-?[\d\.]+)\s*(degrees?|°|radians?|rad)?\s*\)?/i);
        
        if (angleMatch) {
            const func = angleMatch[1].toLowerCase();
            let angle = parseFloat(angleMatch[2]);
            const unit = angleMatch[3]?.toLowerCase() || '';
            
            // Convert to radians if degrees
            if (unit.includes('degree') || unit.includes('°') || (!unit && angle > 2 * Math.PI)) {
                steps.push({ description: 'Convert degrees to radians', math: `${angle}° = ${(angle * Math.PI / 180).toFixed(6)} rad` });
                angle = angle * Math.PI / 180;
            }
            
            let result;
            switch (func) {
                case 'sin': result = Math.sin(angle); break;
                case 'cos': result = Math.cos(angle); break;
                case 'tan': result = Math.tan(angle); break;
                case 'cot': result = 1 / Math.tan(angle); break;
                case 'sec': result = 1 / Math.cos(angle); break;
                case 'csc': result = 1 / Math.sin(angle); break;
            }
            
            steps.push({ description: `Calculate ${func}`, math: `${func}(${angleMatch[2]}${unit}) = ${result.toFixed(6)}` });
            
            // Check for exact values
            const exactValues = {
                0: { sin: '0', cos: '1', tan: '0' },
                30: { sin: '1/2', cos: '√3/2', tan: '1/√3' },
                45: { sin: '√2/2', cos: '√2/2', tan: '1' },
                60: { sin: '√3/2', cos: '1/2', tan: '√3' },
                90: { sin: '1', cos: '0', tan: 'undefined' }
            };
            
            const degAngle = Math.round(angle * 180 / Math.PI) % 360;
            if (exactValues[degAngle] && exactValues[degAngle][func]) {
                steps.push({ description: 'Exact value', math: `${func}(${degAngle}°) = ${exactValues[degAngle][func]}` });
            }
            
            return { number, original: problem, type: 'Trigonometry', steps, answer: `${func}(${angleMatch[2]}${unit}) = ${result.toFixed(6)}` };
        }
        
        // Inverse trig
        const invMatch = problem.match(/(arcsin|arccos|arctan|asin|acos|atan)\s*\(?\s*(-?[\d\.]+)\s*\)?/i);
        if (invMatch) {
            const func = invMatch[1].toLowerCase();
            const x = parseFloat(invMatch[2]);
            let result;
            
            switch (func) {
                case 'arcsin': case 'asin': result = Math.asin(x); break;
                case 'arccos': case 'acos': result = Math.acos(x); break;
                case 'arctan': case 'atan': result = Math.atan(x); break;
            }
            
            const degrees = result * 180 / Math.PI;
            steps.push({ description: `Calculate ${func}`, math: `${func}(${x}) = ${result.toFixed(6)} rad = ${degrees.toFixed(4)}°` });
            
            return { number, original: problem, type: 'Inverse Trigonometry', steps, answer: `${func}(${x}) = ${degrees.toFixed(4)}°` };
        }
        
        // Inverse trig for special values
        if (/find\s*(angle|theta|θ)/i.test(problem)) {
            const valueMatch = problem.match(/sin\s*[=:]?\s*([\d\/√]+)|cos\s*[=:]?\s*([\d\/√]+)|tan\s*[=:]?\s*([\d\/√]+)/i);
            if (valueMatch) {
                const specialAngles = {
                    '0': 0, '1/2': 30, '√2/2': 45, '0.5': 30, '0.707': 45,
                    '√3/2': 60, '0.866': 60, '1': 90, '√3': 60
                };
                const val = (valueMatch[1] || valueMatch[2] || valueMatch[3]).trim();
                if (specialAngles[val] !== undefined) {
                    steps.push({ description: 'Special angle', math: `θ = ${specialAngles[val]}°` });
                    return { number, original: problem, type: 'Trigonometry', steps, answer: `θ = ${specialAngles[val]}°` };
                }
            }
        }
        
        // Solve trig equations like sin(x) = 0.5
        const trigEqMatch = problem.match(/(sin|cos|tan)\s*\(?\s*(\w)\s*\)?\s*=\s*(-?[\d\.]+)/i);
        if (trigEqMatch) {
            const func = trigEqMatch[1].toLowerCase();
            const variable = trigEqMatch[2];
            const value = parseFloat(trigEqMatch[3]);
            
            let angle;
            switch (func) {
                case 'sin': angle = Math.asin(value); break;
                case 'cos': angle = Math.acos(value); break;
                case 'tan': angle = Math.atan(value); break;
            }
            
            const degrees = angle * 180 / Math.PI;
            steps.push({ description: `Solve ${func}(${variable}) = ${value}`, math: `${variable} = ${degrees.toFixed(2)}°` });
            
            // General solution
            if (func === 'sin') {
                steps.push({ description: 'General solution', math: `${variable} = ${degrees.toFixed(2)}° + 360°n or ${variable} = ${(180 - degrees).toFixed(2)}° + 360°n` });
            } else if (func === 'cos') {
                steps.push({ description: 'General solution', math: `${variable} = ±${degrees.toFixed(2)}° + 360°n` });
            } else {
                steps.push({ description: 'General solution', math: `${variable} = ${degrees.toFixed(2)}° + 180°n` });
            }
            
            return { number, original: problem, type: 'Trigonometric Equation', steps, answer: `${variable} = ${degrees.toFixed(2)}°` };
        }
        
        // Identities
        steps.push({
            description: 'Trigonometric identities',
            math: 'sin²θ + cos²θ = 1\n1 + tan²θ = sec²θ\nsin(2θ) = 2sinθcosθ\ncos(2θ) = cos²θ - sin²θ'
        });
        
        return { number, original: problem, type: 'Trigonometry', steps, answer: 'Apply trig formulas as needed' };
    }

    /**
     * Solve complex number problems
     */
    solveComplexNumber(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Complex Number Problem',
            math: problem.substring(0, 150)
        });

        // Match complex number: a + bi or a - bi
        const complexMatch = problem.match(/(-?[\d\.]+)\s*([+-])\s*([\d\.]+)\s*i/);
        
        if (complexMatch) {
            const a = parseFloat(complexMatch[1]);
            const sign = complexMatch[2] === '+' ? 1 : -1;
            const b = sign * parseFloat(complexMatch[3]);
            
            steps.push({ description: 'Complex number', math: `z = ${a} + ${b}i` });
            
            // Modulus
            const modulus = Math.sqrt(a * a + b * b);
            steps.push({ description: 'Modulus (absolute value)', math: `|z| = √(${a}² + ${b}²) = ${modulus.toFixed(4)}` });
            
            // Argument
            const arg = Math.atan2(b, a);
            steps.push({ description: 'Argument', math: `arg(z) = arctan(${b}/${a}) = ${arg.toFixed(4)} rad = ${(arg * 180 / Math.PI).toFixed(2)}°` });
            
            // Conjugate
            steps.push({ description: 'Conjugate', math: `z* = ${a} - ${b}i` });
            
            // Polar form
            steps.push({ description: 'Polar form', math: `z = ${modulus.toFixed(4)}(cos(${arg.toFixed(4)}) + i·sin(${arg.toFixed(4)}))` });
            
            return {
                number,
                original: problem,
                type: 'Complex Number',
                steps,
                answer: `|z| = ${modulus.toFixed(4)}, arg(z) = ${(arg * 180 / Math.PI).toFixed(2)}°`
            };
        }
        
        steps.push({
            description: 'Complex number operations',
            math: 'i² = -1\n|z| = √(a² + b²)\narg(z) = arctan(b/a)\nz* = a - bi (conjugate)'
        });
        
        return { number, original: problem, type: 'Complex Number', steps, answer: 'Apply complex number formulas' };
    }

    /**
     * Generic solver using math.js
     */
    solveGeneric(problem, number) {
        const steps = [];
        
        steps.push({
            description: 'Original expression',
            math: problem
        });

        try {
            const result = math.evaluate(problem);
            
            steps.push({
                description: 'Evaluate the expression',
                math: `= ${this.formatNumber(result)}`
            });

            return {
                number,
                original: problem,
                type: 'Expression',
                steps,
                answer: this.formatNumber(result)
            };
        } catch (e) {
            try {
                const simplified = math.simplify(problem).toString();
                steps.push({
                    description: 'Simplify the expression',
                    math: simplified
                });

                return {
                    number,
                    original: problem,
                    type: 'Expression',
                    steps,
                    answer: simplified
                };
            } catch (e2) {
                throw new Error('Could not evaluate or simplify this expression');
            }
        }
    }

    /**
     * Format numbers nicely
     */
    formatNumber(num) {
        if (typeof num !== 'number') return num;
        if (Number.isInteger(num)) return num.toString();
        
        // Round to reasonable precision
        const rounded = Math.round(num * 10000) / 10000;
        
        // Check if it's close to a simple fraction
        const fractions = [
            [1/2, '1/2'], [1/3, '1/3'], [2/3, '2/3'],
            [1/4, '1/4'], [3/4, '3/4'], [1/5, '1/5'],
            [2/5, '2/5'], [3/5, '3/5'], [4/5, '4/5']
        ];
        
        for (const [val, str] of fractions) {
            if (Math.abs(rounded - val) < 0.0001) return str;
            if (Math.abs(rounded + val) < 0.0001) return '-' + str;
        }
        
        return rounded.toString();
    }

    /**
     * Normalize exponents like x^2^2 to x^4
     */
    normalizeExponents(expr) {
        // Handle x^a^b = x^(a^b) - power tower
        const match = expr.match(/x\^(\d+)\^(\d+)/);
        if (match) {
            const base = parseInt(match[1]);
            const exp = parseInt(match[2]);
            const combined = Math.pow(base, exp);
            return expr.replace(/x\^\d+\^\d+/, `x^${combined}`);
        }
        return expr;
    }

    /**
     * Handle compound requests like "solve x^2^2 then graph it"
     */
    solveCompoundRequest(problem, number) {
        const steps = [];
        
        // Extract the expression (before "then graph")
        let expr = problem.replace(/then\s+(graph|plot).*$/i, '').trim();
        expr = expr.replace(/^solve\s+/i, '').trim();
        
        // Handle x^2^2 = x^4
        const normalizedExpr = this.normalizeExponents(expr);
        
        if (normalizedExpr !== expr) {
            steps.push({
                description: 'Simplify exponents',
                math: `${expr} = ${normalizedExpr}`
            });
        }
        
        steps.push({
            description: 'Function',
            math: `f(x) = ${normalizedExpr}`
        });
        
        // Evaluate at some points
        try {
            const compiled = math.compile(normalizedExpr);
            const points = [];
            for (let x = -2; x <= 2; x++) {
                try {
                    const y = compiled.evaluate({ x });
                    if (isFinite(y)) {
                        points.push(`f(${x}) = ${this.formatNumber(y)}`);
                    }
                } catch (e) {}
            }
            if (points.length > 0) {
                steps.push({
                    description: 'Sample values',
                    math: points.join(', ')
                });
            }
        } catch (e) {}
        
        return {
            number,
            original: problem,
            type: 'Function Graph',
            steps,
            answer: `y = ${normalizedExpr}`,
            visualization: {
                type: 'function',
                expression: normalizedExpr
            }
        };
    }

    /**
     * Solve graphing problems
     */
    solveGraph(problem, number) {
        const steps = [];
        
        // Extract the function
        let func = problem.replace(/graph|plot|draw/gi, '').trim();
        func = func.replace(/the\s+function\s*/i, '').trim();
        func = this.normalizeExponents(func);
        
        steps.push({
            description: 'Function to graph',
            math: func
        });

        // Try to identify key features
        const cleanFunc = func.replace(/y\s*=\s*/i, '').replace(/f\(x\)\s*=\s*/i, '');
        
        try {
            const compiled = math.compile(cleanFunc);
            
            // Find y-intercept
            const yIntercept = compiled.evaluate({ x: 0 });
            if (isFinite(yIntercept)) {
                steps.push({
                    description: 'Y-intercept (where x = 0)',
                    math: `y = ${this.formatNumber(yIntercept)}`
                });
            }
            
            // Sample some points
            const points = [];
            for (let x = -2; x <= 2; x++) {
                try {
                    const y = compiled.evaluate({ x });
                    if (isFinite(y)) {
                        points.push(`(${x}, ${this.formatNumber(y)})`);
                    }
                } catch (e) {}
            }
            
            if (points.length > 0) {
                steps.push({
                    description: 'Sample points on the curve',
                    math: points.join(', ')
                });
            }
        } catch (e) {}

        return {
            number,
            original: problem,
            type: 'Graph',
            steps,
            answer: func,
            visualization: {
                type: 'function',
                expression: func
            }
        };
    }

    /**
     * Solve vector problems
     */
    solveVector(problem, number) {
        const steps = [];
        const problemLower = problem.toLowerCase();
        
        steps.push({
            description: 'Vector Problem',
            math: problem.substring(0, 200) + (problem.length > 200 ? '...' : '')
        });

        // Extract all points from the problem - handle various OCR formats
        const pointsMatch = problem.match(/([A-Z])\s*[\(\[\{]?\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*[\)\]\}]?/gi) ||
                           problem.match(/([A-Z])\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/gi);
        
        // Try to extract specific vector operations
        
        // Find vector AB or AC given points - look for explicit "find vector AB" or just "AB→"
        const findVectorMatch = problem.match(/find\s*(the\s*)?vector\s*([A-Z]{2})\s*→?/i) ||
                               problem.match(/vector\s*([A-Z]{2})\s*→/i) ||
                               problem.match(/([A-Z]{2})\s*→/i);
        
        if (findVectorMatch && pointsMatch && pointsMatch.length >= 2) {
            return this.solveVectorFromPoints(problem, number, findVectorMatch, pointsMatch, steps);
        }
        
        // If we have 3+ points, calculate vectors and area
        if (pointsMatch && pointsMatch.length >= 3 && /area|triangle/i.test(problem)) {
            return this.solveTriangleArea(problem, number, pointsMatch, steps);
        }
        
        // Perpendicular vectors with variable k - solve for k
        if (/perpendicular/i.test(problem) && /[𝑘k]\s*[∈\+\-]|let\s+[ab]\s*=/i.test(problem)) {
            return this.solvePerpendicularWithVariable(problem, number, steps);
        }
        
        // Dot product - find if vectors are perpendicular
        if (/perpendicular|dot\s*product|•|orthogonal/i.test(problem)) {
            return this.solveDotProduct(problem, number, steps);
        }
        
        // Cross product - find area or normal vector
        if (/cross\s*product|×|normal\s*vector|area.*triangle/i.test(problem)) {
            return this.solveCrossProduct(problem, number, steps);
        }
        
        // Magnitude/unit vector
        if (/magnitude|unit\s*vector|\|.*\|/i.test(problem)) {
            return this.solveMagnitude(problem, number, steps);
        }
        
        // Closest point on line to origin/point
        if (/closest|nearest|shortest\s*distance/i.test(problem)) {
            return this.solveClosestPoint(problem, number, steps);
        }

        // Distance from point to plane
        if (/distance.*plane|plane.*distance/i.test(problem)) {
            return this.solveDistanceToPlane(problem, number, steps);
        }
        
        // Line-plane intersection
        if (/intersection|intersect/i.test(problem) && /plane|line/i.test(problem)) {
            return this.solveLinePlaneIntersection(problem, number, steps);
        }
        
        // Angle between vectors/line and plane
        if (/angle\s*between|acute\s*angle/i.test(problem)) {
            return this.solveAngleBetween(problem, number, steps);
        }
        
        // Reflection
        if (/reflection|reflect/i.test(problem)) {
            return this.solveReflection(problem, number, steps);
        }
        
        // Plane equation from points
        if (/equation.*plane|plane.*equation|points.*lie.*plane/i.test(problem)) {
            return this.solvePlaneEquation(problem, number, steps);
        }
        
        // Position vector / coordinates
        if (/position\s*vector|coordinates?\s*of/i.test(problem)) {
            return this.solvePositionVector(problem, number, steps);
        }
        
        // If we have points, try to find vectors anyway
        if (pointsMatch && pointsMatch.length >= 2) {
            return this.solveAllVectorsFromPoints(problem, number, pointsMatch, steps);
        }
        
        // Generic vector problem - provide helpful explanation
        steps.push({
            description: 'This is a vector problem',
            math: 'Detected: vectors, planes, or 3D geometry'
        });
        
        steps.push({
            description: 'Problem Analysis',
            math: this.analyzeVectorProblem(problem)
        });
        
        return {
            number,
            original: problem.substring(0, 100) + '...',
            type: 'Vector Problem',
            steps,
            answer: 'Vector problem detected - see analysis above'
        };
    }
    
    /**
     * Solve for perpendicular vectors with variable k
     */
    solvePerpendicularWithVariable(problem, number, steps) {
        // Match vectors like a = (2, k, -1) and b = (-3, k+2, k)
        // Handle various formats from OCR
        const vectorPattern = /\(\s*([^)]+)\s*\)/gi;
        const vectors = [];
        let match;
        
        while ((match = vectorPattern.exec(problem)) !== null) {
            const components = match[1].split(/\s*,\s*/);
            if (components.length >= 2) {
                vectors.push(components.map(c => c.trim()));
            }
        }
        
        if (vectors.length >= 2) {
            const a = vectors[0];
            const b = vectors[1];
            
            steps.push({
                description: 'Vector a',
                math: `a = (${a.join(', ')})`
            });
            
            steps.push({
                description: 'Vector b', 
                math: `b = (${b.join(', ')})`
            });
            
            steps.push({
                description: 'Perpendicular condition',
                math: 'a • b = 0'
            });
            
            // Build dot product expression
            let dotExpr = '';
            const terms = [];
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                terms.push(`(${a[i]})(${b[i]})`);
            }
            dotExpr = terms.join(' + ');
            
            steps.push({
                description: 'Dot product',
                math: `${dotExpr} = 0`
            });
            
            // Try to solve for k using Nerdamer or algebraic expansion
            try {
                // Manually expand for common patterns
                // a = (2, k, -1), b = (-3, k+2, k) → 2(-3) + k(k+2) + (-1)(k) = 0
                // → -6 + k² + 2k - k = 0 → k² + k - 6 = 0
                
                let expandedExpr = '';
                let terms2 = [];
                
                for (let i = 0; i < Math.min(a.length, b.length); i++) {
                    const ai = a[i].replace(/𝑘/g, 'k').replace(/\s/g, '');
                    const bi = b[i].replace(/𝑘/g, 'k').replace(/\s/g, '');
                    terms2.push(`(${ai})*(${bi})`);
                }
                expandedExpr = terms2.join('+');
                
                steps.push({
                    description: 'Expand',
                    math: expandedExpr.replace(/\*/g, '×') + ' = 0'
                });
                
                // Try with nerdamer
                if (typeof nerdamer !== 'undefined') {
                    const expanded = nerdamer(expandedExpr).expand().text();
                    steps.push({
                        description: 'Simplified',
                        math: expanded + ' = 0'
                    });
                    
                    const solutions = nerdamer.solve(expandedExpr, 'k').toString();
                    const kValues = solutions.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                    
                    steps.push({
                        description: 'Solve for k',
                        math: `k = ${kValues.join(' or k = ')}`
                    });
                    
                    return {
                        number,
                        original: problem.substring(0, 100),
                        type: 'Vector — Perpendicular (Solve for k)',
                        steps,
                        answer: `k = ${kValues.join(' or k = ')}`
                    };
                }
            } catch (e) {
                steps.push({
                    description: 'Solve the quadratic',
                    math: 'Expand, collect like terms, and solve for k'
                });
            }
        }
        
        steps.push({
            description: 'Method',
            math: 'Set a • b = 0, expand, and solve for k'
        });
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Perpendicular (Find k)',
            steps,
            answer: 'Expand dot product and solve quadratic for k'
        };
    }
    
    /**
     * Find all vectors between given points
     */
    solveAllVectorsFromPoints(problem, number, pointsMatch, steps) {
        const points = this.parsePointsFromMatches(pointsMatch);
        const pointNames = Object.keys(points).sort();
        
        if (pointNames.length < 2) {
            return this.vectorFallback(problem, number, steps);
        }
        
        steps.push({
            description: 'Given points',
            math: pointNames.map(n => `${n}(${points[n].x}, ${points[n].y}, ${points[n].z})`).join(', ')
        });
        
        const results = [];
        
        // Calculate vectors between consecutive points
        for (let i = 0; i < pointNames.length - 1; i++) {
            const p1 = pointNames[i];
            const p2 = pointNames[i + 1];
            const A = points[p1];
            const B = points[p2];
            
            const vx = B.x - A.x;
            const vy = B.y - A.y;
            const vz = B.z - A.z;
            
            steps.push({
                description: `Vector ${p1}${p2}→ = ${p2} - ${p1}`,
                math: `${p1}${p2}→ = (${B.x} - ${A.x}, ${B.y} - ${A.y}, ${B.z} - ${A.z}) = (${vx}, ${vy}, ${vz})`
            });
            
            results.push(`${p1}${p2}→ = (${vx}, ${vy}, ${vz})`);
        }
        
        // Also calculate from first to last if 3+ points
        if (pointNames.length >= 3) {
            const p1 = pointNames[0];
            const p3 = pointNames[pointNames.length - 1];
            const A = points[p1];
            const C = points[p3];
            
            const vx = C.x - A.x;
            const vy = C.y - A.y;
            const vz = C.z - A.z;
            
            steps.push({
                description: `Vector ${p1}${p3}→ = ${p3} - ${p1}`,
                math: `${p1}${p3}→ = (${C.x} - ${A.x}, ${C.y} - ${A.y}, ${C.z} - ${A.z}) = (${vx}, ${vy}, ${vz})`
            });
            
            results.push(`${p1}${p3}→ = (${vx}, ${vy}, ${vz})`);
        }
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Calculate Vectors',
            steps,
            answer: results.join('; ')
        };
    }
    
    /**
     * Solve triangle area from 3 points using cross product
     */
    solveTriangleArea(problem, number, pointsMatch, steps) {
        const points = this.parsePointsFromMatches(pointsMatch);
        const pointNames = Object.keys(points).sort();
        
        if (pointNames.length < 3) {
            return this.vectorFallback(problem, number, steps);
        }
        
        const A = points[pointNames[0]];
        const B = points[pointNames[1]];
        const C = points[pointNames[2]];
        
        steps.push({
            description: 'Points',
            math: `${pointNames[0]}(${A.x}, ${A.y}, ${A.z}), ${pointNames[1]}(${B.x}, ${B.y}, ${B.z}), ${pointNames[2]}(${C.x}, ${C.y}, ${C.z})`
        });
        
        // Calculate AB and AC
        const AB = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
        const AC = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
        
        steps.push({
            description: `Vector ${pointNames[0]}${pointNames[1]}→`,
            math: `${pointNames[0]}${pointNames[1]}→ = (${AB.x}, ${AB.y}, ${AB.z})`
        });
        
        steps.push({
            description: `Vector ${pointNames[0]}${pointNames[2]}→`,
            math: `${pointNames[0]}${pointNames[2]}→ = (${AC.x}, ${AC.y}, ${AC.z})`
        });
        
        // Cross product
        const cross = {
            x: AB.y * AC.z - AB.z * AC.y,
            y: AB.z * AC.x - AB.x * AC.z,
            z: AB.x * AC.y - AB.y * AC.x
        };
        
        steps.push({
            description: 'Cross product (for area)',
            math: `${pointNames[0]}${pointNames[1]}→ × ${pointNames[0]}${pointNames[2]}→ = (${cross.x}, ${cross.y}, ${cross.z})`
        });
        
        const magnitude = Math.sqrt(cross.x**2 + cross.y**2 + cross.z**2);
        
        steps.push({
            description: 'Magnitude of cross product',
            math: `|cross| = √(${cross.x}² + ${cross.y}² + ${cross.z}²) = √${cross.x**2 + cross.y**2 + cross.z**2} = ${magnitude.toFixed(4)}`
        });
        
        const area = magnitude / 2;
        
        steps.push({
            description: 'Area of triangle = ½|AB→ × AC→|',
            math: `Area = ${magnitude.toFixed(4)} / 2 = ${area.toFixed(4)}`
        });
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Triangle Area',
            steps,
            answer: `Area = ${area.toFixed(4)} square units`
        };
    }
    
    /**
     * Parse points from regex matches
     */
    parsePointsFromMatches(pointsMatch) {
        const points = {};
        for (const pm of pointsMatch) {
            const match = pm.match(/([A-Z])\s*[\(\[\{]?\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*[\)\]\}]?/i);
            if (match) {
                points[match[1].toUpperCase()] = {
                    x: parseFloat(match[2]),
                    y: parseFloat(match[3]),
                    z: match[4] ? parseFloat(match[4]) : 0
                };
            }
        }
        return points;
    }

    /**
     * Analyze a vector problem to provide hints
     */
    analyzeVectorProblem(problem) {
        const hints = [];
        
        if (/AB\s*→|vector\s*AB/i.test(problem)) {
            hints.push('Vector AB = B - A (subtract coordinates)');
        }
        if (/perpendicular|⊥/i.test(problem)) {
            hints.push('Perpendicular vectors: a • b = 0');
        }
        if (/parallel/i.test(problem)) {
            hints.push('Parallel vectors: a = k × b for some scalar k');
        }
        if (/plane.*equation|equation.*plane/i.test(problem)) {
            hints.push('Plane equation: ax + by + cz = d, where (a,b,c) is normal vector');
        }
        if (/normal/i.test(problem)) {
            hints.push('Normal vector from cross product: n = AB × AC');
        }
        if (/angle/i.test(problem)) {
            hints.push('Angle formula: cos θ = (a • b) / (|a| × |b|)');
        }
        if (/intersection/i.test(problem)) {
            hints.push('Substitute parametric line equation into plane equation');
        }
        if (/reflection/i.test(problem)) {
            hints.push('Reflection: P\' = P + 2 × proj_n(Q - P) where Q is point on plane');
        }
        if (/unit\s*vector/i.test(problem)) {
            hints.push('Unit vector: û = v / |v|');
        }
        if (/magnitude/i.test(problem)) {
            hints.push('Magnitude: |v| = √(x² + y² + z²)');
        }
        
        return hints.length > 0 ? hints.join('; ') : 'Apply vector operations as needed';
    }

    /**
     * Solve for vector given two points
     */
    solveVectorFromPoints(problem, number, findMatch, pointsMatch, steps) {
        // Parse points using the shared method
        const points = this.parsePointsFromMatches(pointsMatch);
        
        // Extract vector name - handle different match group positions
        let vectorName = '';
        if (findMatch[2]) {
            vectorName = findMatch[2].toUpperCase();
        } else if (findMatch[1] && findMatch[1].length === 2) {
            vectorName = findMatch[1].toUpperCase();
        }
        
        // Check if problem asks for multiple vectors (AB and AC)
        const multiVectorMatch = problem.match(/vector\s*([A-Z]{2})\s*→?\s*(and|,)\s*(the\s*)?vector\s*([A-Z]{2})\s*→?/i);
        
        if (multiVectorMatch) {
            const v1Name = multiVectorMatch[1].toUpperCase();
            const v2Name = multiVectorMatch[4].toUpperCase();
            
            const results = [];
            
            for (const vName of [v1Name, v2Name]) {
                const p1 = vName[0];
                const p2 = vName[1];
                
                if (points[p1] && points[p2]) {
                    const A = points[p1];
                    const B = points[p2];
                    
                    const vx = B.x - A.x;
                    const vy = B.y - A.y;
                    const vz = B.z - A.z;
                    
                    steps.push({
                        description: `Vector ${vName}→ = ${p2} - ${p1}`,
                        math: `${vName}→ = (${B.x} - ${A.x}, ${B.y} - ${A.y}, ${B.z} - ${A.z}) = (${vx}, ${vy}, ${vz})`
                    });
                    
                    results.push(`${vName}→ = (${vx}, ${vy}, ${vz})`);
                }
            }
            
            if (results.length > 0) {
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Find Vectors',
                    steps,
                    answer: results.join('; ')
                };
            }
        }
        
        // Single vector case
        if (vectorName && vectorName.length === 2) {
            const point1 = vectorName[0];
            const point2 = vectorName[1];
            
            if (points[point1] && points[point2]) {
                const A = points[point1];
                const B = points[point2];
                
                steps.push({
                    description: `Point ${point1}`,
                    math: `${point1} = (${A.x}, ${A.y}, ${A.z})`
                });
                
                steps.push({
                    description: `Point ${point2}`,
                    math: `${point2} = (${B.x}, ${B.y}, ${B.z})`
                });
                
                steps.push({
                    description: `Vector ${vectorName}→ = ${point2} - ${point1}`,
                    math: `${vectorName}→ = (${B.x} - ${A.x}, ${B.y} - ${A.y}, ${B.z} - ${A.z})`
                });
                
                const vx = B.x - A.x;
                const vy = B.y - A.y;
                const vz = B.z - A.z;
                
                steps.push({
                    description: 'Result',
                    math: `${vectorName}→ = (${vx}, ${vy}, ${vz})`
                });
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Points to Vector',
                    steps,
                    answer: `${vectorName}→ = (${vx}, ${vy}, ${vz})`
                };
            }
        }
        
        // Fallback: calculate all possible vectors from available points
        return this.solveAllVectorsFromPoints(problem, number, pointsMatch, steps);
    }

    /**
     * Solve dot product problems
     */
    solveDotProduct(problem, number, steps) {
        // Try to find vector components
        const vectorMatch = problem.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/gi);
        
        if (vectorMatch && vectorMatch.length >= 2) {
            const parseVector = (str) => {
                const m = str.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/);
                return m ? [parseFloat(m[1]), parseFloat(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
            };
            
            const a = parseVector(vectorMatch[0]);
            const b = parseVector(vectorMatch[1]);
            
            if (a && b) {
                steps.push({
                    description: 'Vector a',
                    math: `a = (${a.join(', ')})`
                });
                
                steps.push({
                    description: 'Vector b',
                    math: `b = (${b.join(', ')})`
                });
                
                steps.push({
                    description: 'Dot product formula',
                    math: 'a • b = a₁b₁ + a₂b₂ + a₃b₃'
                });
                
                const dotProduct = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
                
                steps.push({
                    description: 'Calculate',
                    math: `a • b = (${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) + (${a[2]})(${b[2]}) = ${dotProduct}`
                });
                
                const perpendicular = dotProduct === 0;
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Dot Product',
                    steps,
                    answer: `a • b = ${dotProduct}${perpendicular ? ' (vectors are perpendicular)' : ''}`
                };
            }
        }
        
        // Perpendicular condition with variable
        if (/perpendicular/i.test(problem)) {
            steps.push({
                description: 'Perpendicular vectors',
                math: 'For perpendicular vectors: a • b = 0'
            });
            
            steps.push({
                description: 'Method',
                math: 'Set dot product equal to zero and solve for the variable'
            });
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Perpendicular Condition',
                steps,
                answer: 'Set a • b = 0 and solve for the unknown'
            };
        }
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Solve cross product problems
     */
    solveCrossProduct(problem, number, steps) {
        const vectorMatch = problem.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/gi);
        
        if (vectorMatch && vectorMatch.length >= 2) {
            const parseVector = (str) => {
                const m = str.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
                return m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])] : null;
            };
            
            const a = parseVector(vectorMatch[0]);
            const b = parseVector(vectorMatch[1]);
            
            if (a && b) {
                steps.push({
                    description: 'Vector a',
                    math: `a = (${a.join(', ')})`
                });
                
                steps.push({
                    description: 'Vector b',
                    math: `b = (${b.join(', ')})`
                });
                
                steps.push({
                    description: 'Cross product formula',
                    math: 'a × b = (a₂b₃ - a₃b₂, a₃b₁ - a₁b₃, a₁b₂ - a₂b₁)'
                });
                
                const cross = [
                    a[1]*b[2] - a[2]*b[1],
                    a[2]*b[0] - a[0]*b[2],
                    a[0]*b[1] - a[1]*b[0]
                ];
                
                steps.push({
                    description: 'Calculate',
                    math: `a × b = (${cross.join(', ')})`
                });
                
                const magnitude = Math.sqrt(cross[0]**2 + cross[1]**2 + cross[2]**2);
                
                steps.push({
                    description: 'Magnitude (area of parallelogram)',
                    math: `|a × b| = √(${cross[0]}² + ${cross[1]}² + ${cross[2]}²) = ${magnitude.toFixed(4)}`
                });
                
                const triangleArea = magnitude / 2;
                
                steps.push({
                    description: 'Area of triangle',
                    math: `Area = ½|a × b| = ${triangleArea.toFixed(4)}`
                });
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Cross Product',
                    steps,
                    answer: `a × b = (${cross.join(', ')}), |a × b| = ${magnitude.toFixed(4)}, Triangle area = ${triangleArea.toFixed(4)}`
                };
            }
        }
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Solve magnitude and unit vector problems
     */
    solveMagnitude(problem, number, steps) {
        const vectorMatch = problem.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)?\s*\)/);
        
        if (vectorMatch) {
            const x = parseFloat(vectorMatch[1]);
            const y = parseFloat(vectorMatch[2]);
            const z = vectorMatch[3] ? parseFloat(vectorMatch[3]) : 0;
            
            steps.push({
                description: 'Vector v',
                math: `v = (${x}, ${y}, ${z})`
            });
            
            steps.push({
                description: 'Magnitude formula',
                math: '|v| = √(x² + y² + z²)'
            });
            
            const magnitude = Math.sqrt(x**2 + y**2 + z**2);
            
            steps.push({
                description: 'Calculate',
                math: `|v| = √(${x}² + ${y}² + ${z}²) = √${x**2 + y**2 + z**2} = ${magnitude.toFixed(4)}`
            });
            
            if (/unit\s*vector/i.test(problem)) {
                const ux = x / magnitude;
                const uy = y / magnitude;
                const uz = z / magnitude;
                
                steps.push({
                    description: 'Unit vector formula',
                    math: 'û = v / |v|'
                });
                
                steps.push({
                    description: 'Calculate unit vector',
                    math: `û = (${ux.toFixed(4)}, ${uy.toFixed(4)}, ${uz.toFixed(4)})`
                });
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Unit Vector',
                    steps,
                    answer: `|v| = ${magnitude.toFixed(4)}, û = (${ux.toFixed(4)}, ${uy.toFixed(4)}, ${uz.toFixed(4)})`
                };
            }
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Magnitude',
                steps,
                answer: `|v| = ${magnitude.toFixed(4)}`
            };
        }
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Solve closest point on line to origin/given point
     */
    solveClosestPoint(problem, number, steps) {
        // Extract line equation: r = a + t*d
        // Look for vectors in the problem
        const vectorMatches = problem.match(/\(\s*-?\d+\s*,\s*-?\d+\s*,?\s*-?\d*\s*\)/gi);
        
        if (vectorMatches && vectorMatches.length >= 2) {
            const parseVec = (str) => {
                const m = str.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/);
                return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: m[3] ? parseFloat(m[3]) : 0 } : null;
            };
            
            const a = parseVec(vectorMatches[0]); // position vector
            const d = parseVec(vectorMatches[1]); // direction vector
            
            if (a && d) {
                steps.push({
                    description: 'Line equation',
                    math: `r = (${a.x}, ${a.y}, ${a.z}) + t(${d.x}, ${d.y}, ${d.z})`
                });
                
                steps.push({
                    description: 'Parametric form',
                    math: `P(t) = (${a.x} + ${d.x}t, ${a.y} + ${d.y}t, ${a.z} + ${d.z}t)`
                });
                
                // For closest point to origin: OP • d = 0
                steps.push({
                    description: 'Method: The closest point P on line to origin O satisfies OP ⊥ d',
                    math: 'This means OP • d = 0'
                });
                
                // OP = a + td, so (a + td) • d = 0
                // a•d + t(d•d) = 0
                // t = -(a•d) / (d•d)
                
                const aDotD = a.x * d.x + a.y * d.y + a.z * d.z;
                const dDotD = d.x * d.x + d.y * d.y + d.z * d.z;
                
                steps.push({
                    description: 'Since OP = a + td, we need (a + td) • d = 0',
                    math: `a • d + t(d • d) = 0`
                });
                
                steps.push({
                    description: 'Calculate dot products',
                    math: `a • d = ${aDotD}, d • d = ${dDotD}`
                });
                
                const t = -aDotD / dDotD;
                
                steps.push({
                    description: 'Solve for t',
                    math: `t = -(a • d) / (d • d) = ${-aDotD} / ${dDotD} = ${t.toFixed(4)}`
                });
                
                // Calculate the point
                const px = a.x + t * d.x;
                const py = a.y + t * d.y;
                const pz = a.z + t * d.z;
                
                steps.push({
                    description: 'Substitute t back to find P',
                    math: `P = (${a.x} + ${t.toFixed(4)}×${d.x}, ${a.y} + ${t.toFixed(4)}×${d.y}, ${a.z} + ${t.toFixed(4)}×${d.z})`
                });
                
                steps.push({
                    description: 'Coordinates of P',
                    math: `P = (${px.toFixed(4)}, ${py.toFixed(4)}, ${pz.toFixed(4)})`
                });
                
                // Clean up for nice fractions if possible
                const cleanNum = (n) => {
                    if (Math.abs(n - Math.round(n)) < 0.0001) return Math.round(n);
                    // Check for simple fractions
                    for (let denom of [2, 3, 4, 5, 6, 7, 8]) {
                        const numer = n * denom;
                        if (Math.abs(numer - Math.round(numer)) < 0.0001) {
                            return `${Math.round(numer)}/${denom}`;
                        }
                    }
                    return n.toFixed(4);
                };
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Closest Point to Origin',
                    steps,
                    answer: `P = (${cleanNum(px)}, ${cleanNum(py)}, ${cleanNum(pz)}), t = ${cleanNum(t)}`
                };
            }
        }
        
        // Fallback: provide the method
        steps.push({
            description: 'Method: Closest point on line to origin',
            math: 'For line r = a + td, find t where (a + td) • d = 0'
        });
        
        steps.push({
            description: 'Formula',
            math: 't = -(a • d) / (d • d), then P = a + td'
        });
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Solve distance from point to plane
     */
    solveDistanceToPlane(problem, number, steps) {
        // Look for point: (x, y, z) and plane: ax + by + cz = d
        const pointMatch = problem.match(/(?:point|P)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);
        const coordMatch = problem.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
        const planeMatch = problem.match(/(-?\d+(?:\.\d+)?)\s*x\s*([+-]\s*\d+(?:\.\d+)?)\s*y\s*([+-]\s*\d+(?:\.\d+)?)\s*z\s*=\s*(-?\d+(?:\.\d+)?)/i);
        
        const point = pointMatch || coordMatch;
        
        if (point && planeMatch) {
            const P = {
                x: parseFloat(point[1]),
                y: parseFloat(point[2]),
                z: parseFloat(point[3])
            };
            
            const a = parseFloat(planeMatch[1]);
            const b = parseFloat(planeMatch[2].replace(/\s/g, ''));
            const c = parseFloat(planeMatch[3].replace(/\s/g, ''));
            const d = parseFloat(planeMatch[4]);
            
            steps.push({
                description: 'Point',
                math: `P = (${P.x}, ${P.y}, ${P.z})`
            });
            
            steps.push({
                description: 'Plane equation',
                math: `${a}x + ${b}y + ${c}z = ${d}`
            });
            
            steps.push({
                description: 'Normal vector',
                math: `n = (${a}, ${b}, ${c})`
            });
            
            steps.push({
                description: 'Distance formula',
                math: `d = |ax₀ + by₀ + cz₀ - d| / √(a² + b² + c²)`
            });
            
            const numerator = Math.abs(a * P.x + b * P.y + c * P.z - d);
            const denominator = Math.sqrt(a * a + b * b + c * c);
            const distance = numerator / denominator;
            
            steps.push({
                description: 'Substitute values',
                math: `d = |${a}×${P.x} + ${b}×${P.y} + ${c}×${P.z} - ${d}| / √(${a}² + ${b}² + ${c}²)`
            });
            
            steps.push({
                description: 'Calculate numerator',
                math: `= |${a * P.x + b * P.y + c * P.z - d}|`
            });
            
            steps.push({
                description: 'Calculate denominator',
                math: `= √${a * a + b * b + c * c} = ${denominator.toFixed(4)}`
            });
            
            steps.push({
                description: 'Final distance',
                math: `d = ${numerator} / ${denominator.toFixed(4)} = ${distance.toFixed(4)}`
            });
            
            // Clean up for exact values
            const cleanDist = (d) => {
                if (Math.abs(d - Math.round(d)) < 0.0001) return Math.round(d).toString();
                // Check for √n form
                const sqr = d * d;
                for (let denom of [1, 2, 3, 4, 5, 6, 7, 8]) {
                    const num = sqr * denom * denom;
                    if (Math.abs(num - Math.round(num)) < 0.001) {
                        const sqrtVal = Math.round(num);
                        if (denom === 1) return `√${sqrtVal}`;
                        return `√${sqrtVal}/${denom}`;
                    }
                }
                return d.toFixed(4);
            };
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Distance to Plane',
                steps,
                answer: `Distance = ${cleanDist(distance)}`
            };
        }
        
        // Fallback
        steps.push({
            description: 'Distance from point to plane formula',
            math: 'd = |ax₀ + by₀ + cz₀ - k| / √(a² + b² + c²)'
        });
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Solve line-plane intersection problems
     */
    solveLinePlaneIntersection(problem, number, steps) {
        // Try to extract line: r = a + λd and plane: ax + by + cz = k
        const vectorMatches = problem.match(/\(\s*-?\d+\s*,\s*-?\d+\s*,?\s*-?\d*\s*\)/gi);
        const planeMatch = problem.match(/(\d+)\s*x\s*([+-]\s*\d+)?\s*y?\s*([+-]\s*\d+)?\s*z?\s*=\s*(\d+)/i);
        
        if (vectorMatches && vectorMatches.length >= 2) {
            const parseVec = (str) => {
                const m = str.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/);
                return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: m[3] ? parseFloat(m[3]) : 0 } : null;
            };
            
            const a = parseVec(vectorMatches[0]); // position on line
            const d = parseVec(vectorMatches[1]); // direction
            
            if (a && d) {
                steps.push({
                    description: 'Line equation',
                    math: `r = (${a.x}, ${a.y}, ${a.z}) + λ(${d.x}, ${d.y}, ${d.z})`
                });
                
                // If we found a plane equation
                if (planeMatch) {
                    const pa = parseFloat(planeMatch[1]);
                    const pb = planeMatch[2] ? parseFloat(planeMatch[2].replace(/\s/g, '')) : 0;
                    const pc = planeMatch[3] ? parseFloat(planeMatch[3].replace(/\s/g, '')) : 0;
                    const pk = parseFloat(planeMatch[4]);
                    
                    steps.push({
                        description: 'Plane equation',
                        math: `${pa}x + ${pb}y + ${pc}z = ${pk}`
                    });
                    
                    // Substitute: pa(a.x + λd.x) + pb(a.y + λd.y) + pc(a.z + λd.z) = pk
                    const constant = pa * a.x + pb * a.y + pc * a.z;
                    const coeff = pa * d.x + pb * d.y + pc * d.z;
                    
                    steps.push({
                        description: 'Substitute line into plane',
                        math: `${pa}(${a.x} + ${d.x}λ) + ${pb}(${a.y} + ${d.y}λ) + ${pc}(${a.z} + ${d.z}λ) = ${pk}`
                    });
                    
                    steps.push({
                        description: 'Simplify',
                        math: `${constant} + ${coeff}λ = ${pk}`
                    });
                    
                    if (coeff !== 0) {
                        const lambda = (pk - constant) / coeff;
                        
                        steps.push({
                            description: 'Solve for λ',
                            math: `λ = (${pk} - ${constant}) / ${coeff} = ${lambda}`
                        });
                        
                        const px = a.x + lambda * d.x;
                        const py = a.y + lambda * d.y;
                        const pz = a.z + lambda * d.z;
                        
                        steps.push({
                            description: 'Find intersection point',
                            math: `P = (${px}, ${py}, ${pz})`
                        });
                        
                        return {
                            number,
                            original: problem.substring(0, 100),
                            type: 'Vector — Line-Plane Intersection',
                            steps,
                            answer: `λ = ${lambda}, P = (${px}, ${py}, ${pz})`
                        };
                    }
                }
            }
        }
        
        steps.push({
            description: 'Line-Plane Intersection Method',
            math: 'Substitute the parametric line equation into the plane equation'
        });
        
        steps.push({
            description: 'Given line r = a + λd and plane ax + by + cz = k',
            math: 'Substitute: a(a₁ + λd₁) + b(a₂ + λd₂) + c(a₃ + λd₃) = k'
        });
        
        steps.push({
            description: 'Solve for λ',
            math: 'Collect λ terms and solve'
        });
        
        steps.push({
            description: 'Find intersection point',
            math: 'Substitute λ back into line equation to get coordinates'
        });
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Line-Plane Intersection',
            steps,
            answer: 'Substitute line into plane, solve for parameter, then find point'
        };
    }

    /**
     * Solve angle between vectors/line and plane
     */
    solveAngleBetween(problem, number, steps) {
        // Try to extract vectors from the problem
        const vectorPatterns = [
            // d = (a, b, c) or d = ai + bj + ck
            /(?:d|direction|vector)\s*=\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi,
            /(?:d|direction|vector)\s*=\s*(-?\d+(?:\.\d+)?)\s*i\s*([+-]\s*\d+(?:\.\d+)?)\s*j\s*([+-]\s*\d+(?:\.\d+)?)\s*k/gi,
            // Generic vector pattern (a, b, c)
            /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g
        ];
        
        // Extract plane normal from ax + by + cz = k
        const planeMatch = problem.match(/(-?\d+(?:\.\d+)?)\s*x\s*([+-]\s*\d+(?:\.\d+)?)\s*y\s*([+-]\s*\d+(?:\.\d+)?)\s*z\s*=\s*(-?\d+(?:\.\d+)?)/i);
        
        let vectors = [];
        for (const pattern of vectorPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            while ((match = regex.exec(problem)) !== null) {
                const vals = [match[1], match[2], match[3]].map(v => parseFloat(v.toString().replace(/\s/g, '')));
                if (vals.every(v => !isNaN(v))) {
                    vectors.push({ x: vals[0], y: vals[1], z: vals[2] });
                }
            }
        }
        
        if (/line.*plane|plane.*line/i.test(problem)) {
            steps.push({
                description: 'Angle between line and plane',
                math: 'sin θ = |d • n| / (|d| × |n|)'
            });
            
            // Try to compute actual angle
            if (planeMatch && vectors.length >= 1) {
                const d = vectors[0]; // Direction vector
                const n = {
                    x: parseFloat(planeMatch[1]),
                    y: parseFloat(planeMatch[2].replace(/\s/g, '')),
                    z: parseFloat(planeMatch[3].replace(/\s/g, ''))
                };
                
                steps.push({
                    description: 'Direction vector of line',
                    math: `d = (${d.x}, ${d.y}, ${d.z})`
                });
                
                steps.push({
                    description: 'Normal vector of plane',
                    math: `n = (${n.x}, ${n.y}, ${n.z})`
                });
                
                // Compute dot product
                const dotProduct = d.x * n.x + d.y * n.y + d.z * n.z;
                const magD = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
                const magN = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
                
                steps.push({
                    description: 'd • n',
                    math: `= ${d.x}×${n.x} + ${d.y}×${n.y} + ${d.z}×${n.z} = ${dotProduct}`
                });
                
                steps.push({
                    description: '|d|',
                    math: `= √(${d.x}² + ${d.y}² + ${d.z}²) = √${d.x*d.x + d.y*d.y + d.z*d.z} = ${magD.toFixed(4)}`
                });
                
                steps.push({
                    description: '|n|',
                    math: `= √(${n.x}² + ${n.y}² + ${n.z}²) = √${n.x*n.x + n.y*n.y + n.z*n.z} = ${magN.toFixed(4)}`
                });
                
                const sinTheta = Math.abs(dotProduct) / (magD * magN);
                const thetaRad = Math.asin(Math.min(1, sinTheta));
                const thetaDeg = thetaRad * 180 / Math.PI;
                
                steps.push({
                    description: 'sin θ',
                    math: `= |${dotProduct}| / (${magD.toFixed(4)} × ${magN.toFixed(4)}) = ${sinTheta.toFixed(6)}`
                });
                
                steps.push({
                    description: 'θ',
                    math: `= arcsin(${sinTheta.toFixed(6)}) = ${thetaDeg.toFixed(2)}° = ${thetaRad.toFixed(4)} radians`
                });
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Angle Between Line and Plane',
                    steps,
                    answer: `θ = ${thetaDeg.toFixed(2)}° (${thetaRad.toFixed(4)} radians)`
                };
            }
        } else if (vectors.length >= 2) {
            // Angle between two vectors
            const a = vectors[0];
            const b = vectors[1];
            
            steps.push({
                description: 'Angle between two vectors formula',
                math: 'cos θ = (a • b) / (|a| × |b|)'
            });
            
            steps.push({
                description: 'Vector a',
                math: `a = (${a.x}, ${a.y}, ${a.z})`
            });
            
            steps.push({
                description: 'Vector b',
                math: `b = (${b.x}, ${b.y}, ${b.z})`
            });
            
            // Compute
            const dotProduct = a.x * b.x + a.y * b.y + a.z * b.z;
            const magA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
            const magB = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
            
            steps.push({
                description: 'a • b',
                math: `= ${a.x}×${b.x} + ${a.y}×${b.y} + ${a.z}×${b.z} = ${dotProduct}`
            });
            
            steps.push({
                description: '|a|',
                math: `= √(${a.x}² + ${a.y}² + ${a.z}²) = √${a.x*a.x + a.y*a.y + a.z*a.z} = ${magA.toFixed(4)}`
            });
            
            steps.push({
                description: '|b|',
                math: `= √(${b.x}² + ${b.y}² + ${b.z}²) = √${b.x*b.x + b.y*b.y + b.z*b.z} = ${magB.toFixed(4)}`
            });
            
            const cosTheta = dotProduct / (magA * magB);
            const thetaRad = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
            const thetaDeg = thetaRad * 180 / Math.PI;
            
            steps.push({
                description: 'cos θ',
                math: `= ${dotProduct} / (${magA.toFixed(4)} × ${magB.toFixed(4)}) = ${cosTheta.toFixed(6)}`
            });
            
            steps.push({
                description: 'θ',
                math: `= arccos(${cosTheta.toFixed(6)}) = ${thetaDeg.toFixed(2)}° = ${thetaRad.toFixed(4)} radians`
            });
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Angle Between Vectors',
                steps,
                answer: `θ = ${thetaDeg.toFixed(2)}° (${thetaRad.toFixed(4)} radians)`
            };
        } else {
            steps.push({
                description: 'Formula',
                math: 'cos θ = (a • b) / (|a| × |b|)'
            });
        }
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Angle Between',
            steps,
            answer: 'Could not extract vectors. Manually apply: cos θ = (a • b) / (|a| × |b|)'
        };
    }

    /**
     * Solve reflection problems
     */
    solveReflection(problem, number, steps) {
        // Try to extract point and plane
        const pointMatch = problem.match(/(?:point|P)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);
        const planeMatch = problem.match(/(-?\d+(?:\.\d+)?)\s*x\s*([+-]\s*\d+(?:\.\d+)?)\s*y\s*([+-]\s*\d+(?:\.\d+)?)\s*z\s*=\s*(-?\d+(?:\.\d+)?)/i);
        
        // Alternative: look for any coordinate and plane
        if (!pointMatch) {
            const coordMatch = problem.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
            if (coordMatch) {
                const p = { x: parseFloat(coordMatch[1]), y: parseFloat(coordMatch[2]), z: parseFloat(coordMatch[3]) };
                
                if (planeMatch) {
                    const a = parseFloat(planeMatch[1]);
                    const b = parseFloat(planeMatch[2].replace(/\s/g, ''));
                    const c = parseFloat(planeMatch[3].replace(/\s/g, ''));
                    const d = parseFloat(planeMatch[4]);
                    
                    steps.push({
                        description: 'Point to reflect',
                        math: `P = (${p.x}, ${p.y}, ${p.z})`
                    });
                    
                    steps.push({
                        description: 'Plane equation',
                        math: `${a}x + ${b}y + ${c}z = ${d}`
                    });
                    
                    steps.push({
                        description: 'Normal vector',
                        math: `n = (${a}, ${b}, ${c})`
                    });
                    
                    // Distance from point to plane: (ax + by + cz - d) / |n|
                    const numerator = a * p.x + b * p.y + c * p.z - d;
                    const magN = Math.sqrt(a * a + b * b + c * c);
                    const signedDist = numerator / magN;
                    
                    steps.push({
                        description: 'Signed distance from P to plane',
                        math: `= (${a}×${p.x} + ${b}×${p.y} + ${c}×${p.z} - ${d}) / √(${a}² + ${b}² + ${c}²)`
                    });
                    
                    steps.push({
                        description: 'Calculate',
                        math: `= ${numerator} / ${magN.toFixed(4)} = ${signedDist.toFixed(4)}`
                    });
                    
                    // Unit normal
                    const nHat = { x: a / magN, y: b / magN, z: c / magN };
                    
                    steps.push({
                        description: 'Unit normal vector n̂',
                        math: `= (${nHat.x.toFixed(4)}, ${nHat.y.toFixed(4)}, ${nHat.z.toFixed(4)})`
                    });
                    
                    // Reflected point: P' = P - 2 × signedDist × n̂
                    const pPrime = {
                        x: p.x - 2 * signedDist * nHat.x,
                        y: p.y - 2 * signedDist * nHat.y,
                        z: p.z - 2 * signedDist * nHat.z
                    };
                    
                    steps.push({
                        description: 'Reflection formula',
                        math: `P' = P - 2 × (signed distance) × n̂`
                    });
                    
                    steps.push({
                        description: 'Calculate P\'',
                        math: `P' = (${p.x}, ${p.y}, ${p.z}) - 2 × ${signedDist.toFixed(4)} × (${nHat.x.toFixed(4)}, ${nHat.y.toFixed(4)}, ${nHat.z.toFixed(4)})`
                    });
                    
                    steps.push({
                        description: 'Reflected point',
                        math: `P' = (${pPrime.x.toFixed(4)}, ${pPrime.y.toFixed(4)}, ${pPrime.z.toFixed(4)})`
                    });
                    
                    return {
                        number,
                        original: problem.substring(0, 100),
                        type: 'Vector — Reflection',
                        steps,
                        answer: `P' = (${pPrime.x.toFixed(4)}, ${pPrime.y.toFixed(4)}, ${pPrime.z.toFixed(4)})`
                    };
                }
            }
        }
        
        steps.push({
            description: 'Reflection in a plane',
            math: 'P\' = P - 2 × (signed distance to plane) × n̂'
        });
        
        steps.push({
            description: 'Signed distance formula',
            math: 'dist = (ax₀ + by₀ + cz₀ - d) / √(a² + b² + c²)'
        });
        
        steps.push({
            description: 'Steps',
            math: '1. Find signed distance from point to plane. 2. Move point twice that distance opposite to normal direction.'
        });
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Reflection',
            steps,
            answer: 'Could not extract point and plane. Apply formula: P\' = P - 2 × dist × n̂'
        };
    }

    /**
     * Solve plane equation from points
     */
    solvePlaneEquation(problem, number, steps) {
        const pointsMatch = problem.match(/([A-Z])\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/gi);
        
        if (pointsMatch && pointsMatch.length >= 3) {
            const parsePoint = (str) => {
                const m = str.match(/([A-Z])\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i);
                return m ? { name: m[1], x: parseFloat(m[2]), y: parseFloat(m[3]), z: parseFloat(m[4]) } : null;
            };
            
            const points = pointsMatch.map(parsePoint).filter(p => p);
            
            if (points.length >= 3) {
                const A = points[0], B = points[1], C = points[2];
                
                steps.push({
                    description: 'Given points',
                    math: `${A.name}(${A.x}, ${A.y}, ${A.z}), ${B.name}(${B.x}, ${B.y}, ${B.z}), ${C.name}(${C.x}, ${C.y}, ${C.z})`
                });
                
                // Calculate vectors AB and AC
                const AB = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
                const AC = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
                
                steps.push({
                    description: `Vector ${A.name}${B.name}`,
                    math: `${A.name}${B.name} = (${AB.x}, ${AB.y}, ${AB.z})`
                });
                
                steps.push({
                    description: `Vector ${A.name}${C.name}`,
                    math: `${A.name}${C.name} = (${AC.x}, ${AC.y}, ${AC.z})`
                });
                
                // Cross product for normal vector
                const n = {
                    x: AB.y * AC.z - AB.z * AC.y,
                    y: AB.z * AC.x - AB.x * AC.z,
                    z: AB.x * AC.y - AB.y * AC.x
                };
                
                steps.push({
                    description: 'Normal vector (cross product)',
                    math: `n = ${A.name}${B.name} × ${A.name}${C.name} = (${n.x}, ${n.y}, ${n.z})`
                });
                
                // Plane equation: n.x(x - A.x) + n.y(y - A.y) + n.z(z - A.z) = 0
                const d = n.x * A.x + n.y * A.y + n.z * A.z;
                
                steps.push({
                    description: 'Plane equation',
                    math: `${n.x}x + ${n.y}y + ${n.z}z = ${d}`
                });
                
                // Simplify if possible (find GCD)
                const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
                const g = [n.x, n.y, n.z, d].reduce((a, b) => gcd(a, b));
                
                if (g > 1) {
                    const simplified = `${n.x/g}x + ${n.y/g}y + ${n.z/g}z = ${d/g}`;
                    steps.push({
                        description: 'Simplified',
                        math: simplified
                    });
                    
                    return {
                        number,
                        original: problem.substring(0, 100),
                        type: 'Vector — Plane Equation',
                        steps,
                        answer: simplified
                    };
                }
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Plane Equation',
                    steps,
                    answer: `${n.x}x + ${n.y}y + ${n.z}z = ${d}`
                };
            }
        }
        
        steps.push({
            description: 'Method to find plane equation from 3 points',
            math: '1. Find two vectors in the plane: AB and AC'
        });
        
        steps.push({
            description: 'Step 2',
            math: '2. Find normal vector: n = AB × AC (cross product)'
        });
        
        steps.push({
            description: 'Step 3',
            math: '3. Plane equation: n₁(x - x₀) + n₂(y - y₀) + n₃(z - z₀) = 0'
        });
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Plane Equation',
            steps,
            answer: 'Find normal via cross product, then use point-normal form'
        };
    }

    /**
     * Solve position vector problems
     */
    solvePositionVector(problem, number, steps) {
        const coordMatch = problem.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
        
        if (coordMatch) {
            const x = parseFloat(coordMatch[1]);
            const y = parseFloat(coordMatch[2]);
            const z = parseFloat(coordMatch[3]);
            
            steps.push({
                description: 'Position vector from origin to point',
                math: `OP = (${x}, ${y}, ${z})`
            });
            
            steps.push({
                description: 'In unit vector notation',
                math: `OP = ${x}i + ${y}j + ${z}k`
            });
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Position Vector',
                steps,
                answer: `Position vector = (${x}, ${y}, ${z}) = ${x}i + ${y}j + ${z}k`
            };
        }
        
        return this.vectorFallback(problem, number, steps);
    }

    /**
     * Fallback for complex vector problems - try to extract and compute what we can
     */
    vectorFallback(problem, number, steps) {
        // Try to extract any computable elements
        
        // Look for points in the problem
        const pointMatches = problem.match(/[A-Z]\s*[\(\[\{]\s*-?\d+\s*,\s*-?\d+\s*,?\s*-?\d*\s*[\)\]\}]/gi);
        
        if (pointMatches && pointMatches.length >= 2) {
            // We have points - compute vectors between them
            const points = {};
            for (const pm of pointMatches) {
                const match = pm.match(/([A-Z])\s*[\(\[\{]\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*[\)\]\}]/i);
                if (match) {
                    points[match[1].toUpperCase()] = {
                        x: parseFloat(match[2]),
                        y: parseFloat(match[3]),
                        z: match[4] ? parseFloat(match[4]) : 0
                    };
                }
            }
            
            const pointNames = Object.keys(points);
            if (pointNames.length >= 2) {
                steps.push({
                    description: 'Identified points',
                    math: pointNames.map(n => `${n}(${points[n].x}, ${points[n].y}, ${points[n].z})`).join(', ')
                });
                
                // Calculate all vectors
                const vectors = {};
                for (let i = 0; i < pointNames.length; i++) {
                    for (let j = i + 1; j < pointNames.length; j++) {
                        const p1 = pointNames[i], p2 = pointNames[j];
                        const A = points[p1], B = points[p2];
                        vectors[p1 + p2] = {
                            x: B.x - A.x,
                            y: B.y - A.y,
                            z: B.z - A.z
                        };
                        steps.push({
                            description: `Vector ${p1}${p2}→`,
                            math: `${p1}${p2}→ = (${vectors[p1+p2].x}, ${vectors[p1+p2].y}, ${vectors[p1+p2].z})`
                        });
                    }
                }
                
                // If we have 3+ points, compute cross product and area
                if (pointNames.length >= 3) {
                    const p1 = pointNames[0], p2 = pointNames[1], p3 = pointNames[2];
                    const v1 = vectors[p1 + p2];
                    const v2 = vectors[p1 + p3] || vectors[p2 + p3];
                    
                    if (v1 && v2) {
                        const cross = {
                            x: v1.y * v2.z - v1.z * v2.y,
                            y: v1.z * v2.x - v1.x * v2.z,
                            z: v1.x * v2.y - v1.y * v2.x
                        };
                        
                        steps.push({
                            description: 'Cross product (normal vector)',
                            math: `n = (${cross.x}, ${cross.y}, ${cross.z})`
                        });
                        
                        const mag = Math.sqrt(cross.x**2 + cross.y**2 + cross.z**2);
                        const area = mag / 2;
                        
                        steps.push({
                            description: 'Triangle area = ½|v₁ × v₂|',
                            math: `Area = ${area.toFixed(4)}`
                        });
                        
                        // Plane equation: ax + by + cz = d where (a,b,c) = normal
                        const A = points[p1];
                        const d = cross.x * A.x + cross.y * A.y + cross.z * A.z;
                        
                        steps.push({
                            description: 'Plane equation through these points',
                            math: `${cross.x}x + ${cross.y}y + ${cross.z}z = ${d}`
                        });
                    }
                }
                
                const answers = Object.entries(vectors).map(([name, v]) => 
                    `${name}→ = (${v.x}, ${v.y}, ${v.z})`
                );
                
                return {
                    number,
                    original: problem.substring(0, 100) + (problem.length > 100 ? '...' : ''),
                    type: 'Vector — Computed',
                    steps,
                    answer: answers.join('; ')
                };
            }
        }
        
        // Look for dot product perpendicular condition a • b = 0 to solve for k
        if (/perpendicular|a\s*[•·]\s*b\s*=\s*0/i.test(problem)) {
            const vectorComponents = problem.match(/\(\s*([^)]+)\s*\)/g);
            if (vectorComponents && vectorComponents.length >= 2) {
                const parseComponents = (str) => {
                    return str.replace(/[()]/g, '').split(',').map(s => s.trim());
                };
                
                const a = parseComponents(vectorComponents[0]);
                const b = parseComponents(vectorComponents[1]);
                
                steps.push({
                    description: 'Perpendicular condition: a • b = 0',
                    math: `(${a.join(', ')}) • (${b.join(', ')}) = 0`
                });
                
                // Try to solve with Nerdamer
                try {
                    let dotProduct = '';
                    for (let i = 0; i < Math.min(a.length, b.length); i++) {
                        dotProduct += (i > 0 ? ' + ' : '') + `(${a[i]})*(${b[i]})`;
                    }
                    
                    steps.push({
                        description: 'Expand dot product',
                        math: `${dotProduct} = 0`
                    });
                    
                    const expanded = nerdamer(dotProduct).expand().text();
                    steps.push({
                        description: 'Simplified equation',
                        math: `${expanded} = 0`
                    });
                    
                    const solutions = nerdamer.solve(expanded, 'k').text();
                    steps.push({
                        description: 'Solution',
                        math: `k = ${solutions}`
                    });
                    
                    return {
                        number,
                        original: problem.substring(0, 100),
                        type: 'Vector — Perpendicular',
                        steps,
                        answer: `k = ${solutions}`
                    };
                } catch (e) {
                    steps.push({
                        description: 'Set up equation',
                        math: 'Expand the dot product and solve the resulting equation for k'
                    });
                }
            }
        }
        
        // Provide analysis for anything else
        steps.push({
            description: 'Vector problem analysis',
            math: this.analyzeVectorProblem(problem)
        });
        
        return {
            number,
            original: problem.substring(0, 100) + (problem.length > 100 ? '...' : ''),
            type: 'Vector Problem',
            steps,
            answer: 'See computed values above'
        };
    }

    /**
     * Solve geometry problems
     */
    solveGeometry(problem, number) {
        const steps = [];
        const problemLower = problem.toLowerCase();
        
        steps.push({
            description: 'Problem',
            math: problem
        });

        // Circle problems
        if (/circle|radius|diameter|circumference/i.test(problem) && !/sphere|cylinder|cone/i.test(problem)) {
            return this.solveCircle(problem, number, steps);
        }
        
        // Triangle problems
        if (/triangle|hypotenuse|pythagorean/i.test(problem)) {
            return this.solveTriangle(problem, number, steps);
        }
        
        // Rectangle/Square problems
        if (/rectangle|square/i.test(problem) && !/prism/i.test(problem)) {
            return this.solveRectangle(problem, number, steps);
        }
        
        // 3D Shapes
        if (/sphere/i.test(problem)) {
            return this.solveSphere(problem, number, steps);
        }
        
        if (/cylinder/i.test(problem)) {
            return this.solveCylinder(problem, number, steps);
        }
        
        if (/cone/i.test(problem)) {
            return this.solveCone(problem, number, steps);
        }
        
        if (/cube/i.test(problem)) {
            return this.solveCube(problem, number, steps);
        }
        
        if (/prism|box|cuboid|rectangular.*solid/i.test(problem)) {
            return this.solveRectangularPrism(problem, number, steps);
        }
        
        // 2D Shapes
        if (/trapezoid|trapezium/i.test(problem)) {
            return this.solveTrapezoid(problem, number, steps);
        }
        
        if (/parallelogram/i.test(problem)) {
            return this.solveParallelogram(problem, number, steps);
        }
        
        if (/polygon|hexagon|pentagon|octagon/i.test(problem)) {
            return this.solveRegularPolygon(problem, number, steps);
        }
        
        if (/ellipse/i.test(problem)) {
            return this.solveEllipse(problem, number, steps);
        }

        // Generic area/perimeter
        return this.solveGenericGeometry(problem, number, steps);
    }
    
    solveSphere(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g);
        let radius = numbers ? parseFloat(numbers[0]) : 1;
        
        if (/diameter/i.test(problem)) {
            radius = radius / 2;
            steps.push({ description: 'Convert diameter to radius', math: `r = d/2 = ${radius}` });
        } else {
            steps.push({ description: 'Given radius', math: `r = ${radius}` });
        }
        
        const volume = (4/3) * Math.PI * Math.pow(radius, 3);
        const surfaceArea = 4 * Math.PI * Math.pow(radius, 2);
        
        steps.push({ description: 'Volume formula: V = (4/3)πr³', math: `V = (4/3) × π × ${radius}³ = ${this.formatNumber(volume)}` });
        steps.push({ description: 'Surface area formula: A = 4πr²', math: `A = 4 × π × ${radius}² = ${this.formatNumber(surfaceArea)}` });
        
        return { number, original: problem, type: 'Geometry — Sphere', steps, answer: `Volume = ${this.formatNumber(volume)}, Surface Area = ${this.formatNumber(surfaceArea)}` };
    }
    
    solveCylinder(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const radius = numbers[0] || 1;
        const height = numbers[1] || 1;
        
        steps.push({ description: 'Given dimensions', math: `radius = ${radius}, height = ${height}` });
        
        const volume = Math.PI * Math.pow(radius, 2) * height;
        const lateralArea = 2 * Math.PI * radius * height;
        const totalArea = 2 * Math.PI * radius * (radius + height);
        
        steps.push({ description: 'Volume formula: V = πr²h', math: `V = π × ${radius}² × ${height} = ${this.formatNumber(volume)}` });
        steps.push({ description: 'Lateral surface area: A = 2πrh', math: `A = 2 × π × ${radius} × ${height} = ${this.formatNumber(lateralArea)}` });
        steps.push({ description: 'Total surface area: A = 2πr(r + h)', math: `A = 2 × π × ${radius} × (${radius} + ${height}) = ${this.formatNumber(totalArea)}` });
        
        return { number, original: problem, type: 'Geometry — Cylinder', steps, answer: `Volume = ${this.formatNumber(volume)}, Surface Area = ${this.formatNumber(totalArea)}` };
    }
    
    solveCone(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const radius = numbers[0] || 1;
        const height = numbers[1] || 1;
        const slant = Math.sqrt(radius * radius + height * height);
        
        steps.push({ description: 'Given dimensions', math: `radius = ${radius}, height = ${height}` });
        steps.push({ description: 'Slant height: l = √(r² + h²)', math: `l = √(${radius}² + ${height}²) = ${this.formatNumber(slant)}` });
        
        const volume = (1/3) * Math.PI * Math.pow(radius, 2) * height;
        const lateralArea = Math.PI * radius * slant;
        const totalArea = Math.PI * radius * (radius + slant);
        
        steps.push({ description: 'Volume formula: V = (1/3)πr²h', math: `V = (1/3) × π × ${radius}² × ${height} = ${this.formatNumber(volume)}` });
        steps.push({ description: 'Total surface area: A = πr(r + l)', math: `A = π × ${radius} × (${radius} + ${this.formatNumber(slant)}) = ${this.formatNumber(totalArea)}` });
        
        return { number, original: problem, type: 'Geometry — Cone', steps, answer: `Volume = ${this.formatNumber(volume)}, Surface Area = ${this.formatNumber(totalArea)}` };
    }
    
    solveCube(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g);
        const side = numbers ? parseFloat(numbers[0]) : 1;
        
        steps.push({ description: 'Given side length', math: `s = ${side}` });
        
        const volume = Math.pow(side, 3);
        const surfaceArea = 6 * Math.pow(side, 2);
        const diagonal = side * Math.sqrt(3);
        
        steps.push({ description: 'Volume formula: V = s³', math: `V = ${side}³ = ${volume}` });
        steps.push({ description: 'Surface area formula: A = 6s²', math: `A = 6 × ${side}² = ${surfaceArea}` });
        steps.push({ description: 'Space diagonal: d = s√3', math: `d = ${side} × √3 = ${this.formatNumber(diagonal)}` });
        
        return { number, original: problem, type: 'Geometry — Cube', steps, answer: `Volume = ${volume}, Surface Area = ${surfaceArea}, Diagonal = ${this.formatNumber(diagonal)}` };
    }
    
    solveRectangularPrism(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const l = numbers[0] || 1;
        const w = numbers[1] || 1;
        const h = numbers[2] || 1;
        
        steps.push({ description: 'Given dimensions', math: `length = ${l}, width = ${w}, height = ${h}` });
        
        const volume = l * w * h;
        const surfaceArea = 2 * (l*w + w*h + l*h);
        const diagonal = Math.sqrt(l*l + w*w + h*h);
        
        steps.push({ description: 'Volume formula: V = lwh', math: `V = ${l} × ${w} × ${h} = ${volume}` });
        steps.push({ description: 'Surface area: A = 2(lw + wh + lh)', math: `A = 2(${l*w} + ${w*h} + ${l*h}) = ${surfaceArea}` });
        steps.push({ description: 'Space diagonal: d = √(l² + w² + h²)', math: `d = √(${l*l} + ${w*w} + ${h*h}) = ${this.formatNumber(diagonal)}` });
        
        return { number, original: problem, type: 'Geometry — Rectangular Prism', steps, answer: `Volume = ${volume}, Surface Area = ${surfaceArea}` };
    }
    
    solveTrapezoid(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const a = numbers[0] || 1;  // parallel side 1
        const b = numbers[1] || 1;  // parallel side 2
        const h = numbers[2] || 1;  // height
        
        steps.push({ description: 'Given dimensions', math: `parallel sides: a = ${a}, b = ${b}, height h = ${h}` });
        
        const area = 0.5 * (a + b) * h;
        
        steps.push({ description: 'Area formula: A = ½(a + b)h', math: `A = ½ × (${a} + ${b}) × ${h} = ${this.formatNumber(area)}` });
        
        return { number, original: problem, type: 'Geometry — Trapezoid', steps, answer: `Area = ${this.formatNumber(area)}` };
    }
    
    solveParallelogram(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const base = numbers[0] || 1;
        const height = numbers[1] || 1;
        
        steps.push({ description: 'Given dimensions', math: `base = ${base}, height = ${height}` });
        
        const area = base * height;
        
        steps.push({ description: 'Area formula: A = base × height', math: `A = ${base} × ${height} = ${area}` });
        
        return { number, original: problem, type: 'Geometry — Parallelogram', steps, answer: `Area = ${area}` };
    }
    
    solveRegularPolygon(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        let n;
        
        if (/pentagon/i.test(problem)) n = 5;
        else if (/hexagon/i.test(problem)) n = 6;
        else if (/heptagon/i.test(problem)) n = 7;
        else if (/octagon/i.test(problem)) n = 8;
        else n = numbers[0] || 6;
        
        const side = numbers.length > 0 ? numbers[numbers.length - 1] : 1;
        
        steps.push({ description: 'Regular polygon', math: `n = ${n} sides, side length = ${side}` });
        
        const angle = (n - 2) * 180 / n;
        const area = (n * side * side) / (4 * Math.tan(Math.PI / n));
        const perimeter = n * side;
        
        steps.push({ description: 'Interior angle', math: `angle = (n-2) × 180° / n = ${this.formatNumber(angle)}°` });
        steps.push({ description: 'Area formula: A = (ns²) / (4tan(π/n))', math: `A = ${this.formatNumber(area)}` });
        steps.push({ description: 'Perimeter: P = ns', math: `P = ${n} × ${side} = ${perimeter}` });
        
        return { number, original: problem, type: `Geometry — ${n}-gon`, steps, answer: `Area = ${this.formatNumber(area)}, Perimeter = ${perimeter}` };
    }
    
    solveEllipse(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        const a = numbers[0] || 1;  // semi-major axis
        const b = numbers[1] || 1;  // semi-minor axis
        
        steps.push({ description: 'Given semi-axes', math: `a = ${a}, b = ${b}` });
        
        const area = Math.PI * a * b;
        // Ramanujan approximation for perimeter
        const h = Math.pow((a - b) / (a + b), 2);
        const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        
        steps.push({ description: 'Area formula: A = πab', math: `A = π × ${a} × ${b} = ${this.formatNumber(area)}` });
        steps.push({ description: 'Perimeter (Ramanujan approx)', math: `P ≈ ${this.formatNumber(perimeter)}` });
        
        return { number, original: problem, type: 'Geometry — Ellipse', steps, answer: `Area = ${this.formatNumber(area)}, Perimeter ≈ ${this.formatNumber(perimeter)}` };
    }

    solveCircle(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g);
        let radius = numbers ? parseFloat(numbers[0]) : 1;
        
        // Check if diameter was given
        if (/diameter/i.test(problem)) {
            steps.push({
                description: 'Given diameter, find radius',
                math: `r = d/2 = ${radius}/2 = ${radius/2}`
            });
            radius = radius / 2;
        } else {
            steps.push({
                description: 'Given radius',
                math: `r = ${radius}`
            });
        }

        const area = Math.PI * radius * radius;
        const circumference = 2 * Math.PI * radius;
        
        steps.push({
            description: 'Area formula: A = πr²',
            math: `A = π × ${radius}² = π × ${radius * radius} = ${this.formatNumber(area)}`
        });
        
        steps.push({
            description: 'Circumference formula: C = 2πr',
            math: `C = 2 × π × ${radius} = ${this.formatNumber(circumference)}`
        });

        let answer = `Area = ${this.formatNumber(area)}, Circumference = ${this.formatNumber(circumference)}`;
        
        if (/\barea\b/i.test(problem)) {
            answer = `Area = ${this.formatNumber(area)}`;
        } else if (/circumference|perimeter/i.test(problem)) {
            answer = `Circumference = ${this.formatNumber(circumference)}`;
        }

        return {
            number,
            original: problem,
            type: 'Geometry — Circle',
            steps,
            answer,
            visualization: {
                type: 'circle',
                radius
            }
        };
    }

    solveTriangle(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        
        // Pythagorean theorem
        if (/pythagorean|hypotenuse/i.test(problem) || numbers.length >= 2) {
            if (numbers.length >= 2) {
                const a = numbers[0];
                const b = numbers[1];
                
                steps.push({
                    description: 'Given two sides of a right triangle',
                    math: `a = ${a}, b = ${b}`
                });
                
                steps.push({
                    description: 'Pythagorean theorem: a² + b² = c²',
                    math: `${a}² + ${b}² = c²`
                });
                
                const cSquared = a * a + b * b;
                steps.push({
                    description: 'Calculate',
                    math: `${a * a} + ${b * b} = ${cSquared}`
                });
                
                const c = Math.sqrt(cSquared);
                steps.push({
                    description: 'Take the square root',
                    math: `c = √${cSquared} = ${this.formatNumber(c)}`
                });
                
                const area = 0.5 * a * b;
                steps.push({
                    description: 'Area of right triangle: A = ½ × base × height',
                    math: `A = ½ × ${a} × ${b} = ${this.formatNumber(area)}`
                });

                return {
                    number,
                    original: problem,
                    type: 'Geometry — Triangle',
                    steps,
                    answer: `Hypotenuse = ${this.formatNumber(c)}, Area = ${this.formatNumber(area)}`,
                    visualization: {
                        type: 'triangle',
                        a, b, c
                    }
                };
            }
        }
        
        // Three sides given
        if (numbers.length >= 3) {
            const [a, b, c] = numbers;
            const s = (a + b + c) / 2;
            const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
            
            steps.push({
                description: 'Given three sides',
                math: `a = ${a}, b = ${b}, c = ${c}`
            });
            
            steps.push({
                description: "Heron's formula: s = (a + b + c)/2",
                math: `s = (${a} + ${b} + ${c})/2 = ${s}`
            });
            
            steps.push({
                description: 'Area = √(s(s-a)(s-b)(s-c))',
                math: `Area = √(${s} × ${s-a} × ${s-b} × ${s-c}) = ${this.formatNumber(area)}`
            });

            return {
                number,
                original: problem,
                type: 'Geometry — Triangle',
                steps,
                answer: `Area = ${this.formatNumber(area)}`,
                visualization: {
                    type: 'triangle',
                    a, b, c
                }
            };
        }

        return {
            number,
            original: problem,
            type: 'Geometry — Triangle',
            steps,
            answer: 'Please provide side lengths',
            visualization: null
        };
    }

    solveRectangle(problem, number, steps) {
        const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
        
        if (/square/i.test(problem) && numbers.length >= 1) {
            const side = numbers[0];
            const area = side * side;
            const perimeter = 4 * side;
            
            steps.push({
                description: 'Given side of square',
                math: `s = ${side}`
            });
            
            steps.push({
                description: 'Area = s²',
                math: `A = ${side}² = ${area}`
            });
            
            steps.push({
                description: 'Perimeter = 4s',
                math: `P = 4 × ${side} = ${perimeter}`
            });

            return {
                number,
                original: problem,
                type: 'Geometry — Square',
                steps,
                answer: `Area = ${area}, Perimeter = ${perimeter}`,
                visualization: {
                    type: 'rectangle',
                    width: side,
                    height: side
                }
            };
        }
        
        if (numbers.length >= 2) {
            const [width, height] = numbers;
            const area = width * height;
            const perimeter = 2 * (width + height);
            
            steps.push({
                description: 'Given dimensions',
                math: `width = ${width}, height = ${height}`
            });
            
            steps.push({
                description: 'Area = width × height',
                math: `A = ${width} × ${height} = ${area}`
            });
            
            steps.push({
                description: 'Perimeter = 2(width + height)',
                math: `P = 2(${width} + ${height}) = ${perimeter}`
            });

            return {
                number,
                original: problem,
                type: 'Geometry — Rectangle',
                steps,
                answer: `Area = ${area}, Perimeter = ${perimeter}`,
                visualization: {
                    type: 'rectangle',
                    width,
                    height
                }
            };
        }

        return {
            number,
            original: problem,
            type: 'Geometry — Rectangle',
            steps,
            answer: 'Please provide dimensions'
        };
    }

    solveGenericGeometry(problem, number, steps) {
        steps.push({
            description: 'Geometry problem detected',
            math: 'Please specify the shape and dimensions'
        });

        return {
            number,
            original: problem,
            type: 'Geometry',
            steps,
            answer: 'Please provide more details about the shape'
        };
    }
}

// Export for use in app.js
window.MathSolver = MathSolver;
