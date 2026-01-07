/**
 * MathVision Solver Module (CLI Version)
 * Universal math problem parser and solver
 * Uses multi-strategy approach: math.js, nerdamer, algebrite
 */

const math = require('mathjs');

// Symbolic math libraries
let Algebrite, nerdamer;
try {
    Algebrite = require('algebrite');
} catch (e) {}
try {
    nerdamer = require('nerdamer');
    require('nerdamer/Algebra');
    require('nerdamer/Calculus');
    require('nerdamer/Solve');
} catch (e) {}

// Problem categories for classification
const problemCategories = {
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

/**
 * Classify problem into category
 */
function classifyProblem(problem) {
    const lower = problem.toLowerCase();
    let scores = {};
    
    for (const [category, keywords] of Object.entries(problemCategories)) {
        scores[category] = 0;
        for (const keyword of keywords) {
            if (lower.includes(keyword.toLowerCase())) {
                scores[category] += keyword.length;
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
 * Generate Markdown for problem
 */
function generateMarkdown(problem, result) {
    let md = `# Math Problem\n\n`;
    md += `## Question\n\n\`\`\`\n${problem}\n\`\`\`\n\n`;
    md += `## Classification\n\n- **Type:** ${result.type}\n- **Category:** ${classifyProblem(problem)}\n\n`;
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
 * Main solve function
 */
function solveMath(input) {
    const cleanedInput = cleanInput(input);
    const problems = extractProblems(cleanedInput);
    
    return problems.map((problem, index) => {
        try {
            const result = solveProblem(problem, index + 1);
            result.markdown = generateMarkdown(problem, result);
            result.category = classifyProblem(problem);
            return result;
        } catch (error) {
            // Try universal fallback
            return universalFallback(problem, index + 1, error);
        }
    });
}

/**
 * Universal fallback - try multiple solving strategies
 */
function universalFallback(problem, number, originalError) {
    const steps = [];
    const strategies = [
        { name: 'Nerdamer Solve', fn: () => tryNerdamer(problem) },
        { name: 'Algebrite Solve', fn: () => tryAlgebrite(problem) },
        { name: 'Math.js Evaluate', fn: () => tryMathJs(problem) },
        { name: 'Pattern Analysis', fn: () => tryPatternMatch(problem) }
    ];
    
    steps.push({ description: 'Problem Analysis', math: problem.substring(0, 150) });
    
    for (const strategy of strategies) {
        try {
            const result = strategy.fn();
            if (result && result !== 'undefined' && result !== 'NaN') {
                steps.push({ description: `Solved using ${strategy.name}`, math: String(result) });
                return { number, original: problem, type: classifyProblem(problem), steps, answer: String(result) };
            }
        } catch (e) {}
    }
    
    return {
        number,
        original: problem,
        type: classifyProblem(problem),
        steps,
        answer: 'Problem requires manual analysis',
        error: originalError?.message
    };
}

function tryNerdamer(problem) {
    if (!nerdamer) return null;
    const clean = problem.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/(\d)([a-z])/gi, '$1*$2');
    if (/=/.test(clean)) {
        const parts = clean.split('=');
        const expr = `${parts[0]}-(${parts[1]})`;
        const vars = clean.match(/[a-z]/gi);
        const mainVar = vars ? vars[0].toLowerCase() : 'x';
        return `${mainVar} = ${nerdamer.solve(expr, mainVar).toString()}`;
    }
    return nerdamer(clean).evaluate().text();
}

function tryAlgebrite(problem) {
    if (!Algebrite) return null;
    const clean = problem.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/²/g, '^2').replace(/³/g, '^3');
    return Algebrite.run(clean);
}

function tryMathJs(problem) {
    const clean = problem.replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/²/g, '^2').replace(/(\d)([a-z])/gi, '$1*$2');
    if (/=/.test(clean)) {
        const parts = clean.split('=').map(p => p.trim());
        const simplified = math.simplify(`${parts[0]}-(${parts[1]})`);
        return `Simplified: ${simplified.toString()} = 0`;
    }
    return math.evaluate(clean);
}

function tryPatternMatch(problem) {
    // Factorial
    const factorialMatch = problem.match(/(\d+)!/);
    if (factorialMatch) {
        const n = parseInt(factorialMatch[1]);
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return `${n}! = ${result}`;
    }
    // Percentage
    const percentMatch = problem.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
    if (percentMatch) {
        return `${percentMatch[1]}% of ${percentMatch[2]} = ${(parseFloat(percentMatch[1])/100) * parseFloat(percentMatch[2])}`;
    }
    return null;
}

/**
 * Clean and normalize input
 */
function cleanInput(input) {
    return input
        .replace(/[×✕]/g, '*')
        .replace(/[÷]/g, '/')
        .replace(/[−–—]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/(\d)\s*\(/g, '$1*(')
        .replace(/\)\s*(\d)/g, ')*$1')
        .replace(/\)\s*\(/g, ')*(')
        .trim();
}

/**
 * Extract individual problems
 */
function extractProblems(input) {
    const lines = input.split(/\n+/).map(l => l.trim()).filter(Boolean);
    
    const problems = [];
    for (const line of lines) {
        // Split by common separators but not inside parentheses
        // Simpler approach: split by semicolons and numbered patterns at start
        const parts = line.split(/;\s*/)
            .map(p => p.trim())
            .map(p => p.replace(/^\d+[\.\)]\s*/, ''))  // Remove leading numbers like "1." or "1)"
            .filter(p => p && /[\d\+\-\*\/\=a-z\(]/i.test(p));
        problems.push(...parts);
    }
    
    return problems.length > 0 ? problems : [input];
}

/**
 * Detect problem type and solve
 */
function solveProblem(problem, number) {
    const lower = problem.toLowerCase();
    
    // Detection order matters - more specific first
    if (isVector(problem)) return solveVector(problem, number);
    if (isMatrix(lower)) return solveMatrix(problem, number);
    if (isStatistics(lower)) return solveStatistics(problem, number);
    if (isLimit(lower)) return solveLimit(problem, number);
    if (isLogarithm(lower)) return solveLogarithm(problem, number);
    if (isTrigonometry(lower)) return solveTrigonometry(problem, number);
    if (isComplexNumber(lower)) return solveComplexNumber(problem, number);
    if (isGraph(lower)) return solveGraph(problem, number);
    if (isGeometry(lower)) return solveGeometry(problem, number);
    if (isIntegral(lower)) return solveIntegral(problem, number);
    if (isDerivative(lower)) return solveDerivative(problem, number);
    if (isQuadratic(problem)) return solveQuadratic(problem, number);
    if (isLinear(problem)) return solveLinear(problem, number);
    if (isArithmetic(problem)) return solveArithmetic(problem, number);
    
    return solveGeneric(problem, number);
}

// ==================== NEW DETECTION ====================

function isMatrix(p) {
    return /matrix|determinant|inverse|transpose|eigenvalue|\[\s*\[|\]\s*\]|det\s*\(/i.test(p);
}

function isStatistics(p) {
    return /mean|median|mode|standard\s*deviation|variance|average|probability|percentile/i.test(p);
}

function isLimit(p) {
    return /limit|lim\s|lim\(|approaches|as\s+x\s*→/i.test(p);
}

function isLogarithm(p) {
    return /\blog\b|\bln\b|logarithm|natural\s*log/i.test(p);
}

function isTrigonometry(p) {
    return /\bsin\b|\bcos\b|\btan\b|\bcot\b|\bsec\b|\bcsc\b|arcsin|arccos|arctan/i.test(p) && !/area|perimeter/i.test(p);
}

function isComplexNumber(p) {
    return /complex|imaginary|\bi\b.*[+-]|\d+\s*[+-]\s*\d*i|conjugate/i.test(p);
}

// ==================== DETECTION ====================

function isVector(p) {
    return /→|vector|dot\s*product|cross\s*product|•|position\s*vector|unit\s*vector|magnitude|perpendicular|normal|plane\s+Π|cartesian\s*equation|𝐫|reflection|line.*plane.*intersect/i.test(p) ||
           /\b[A-Z]{2}\s*→/i.test(p) ||
           (/\(\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\)/i.test(p) && /[A-Z]\s*\(/i.test(p)) ||
           /𝑥|𝑦|𝑧|ℝ|𝛱|𝜇|𝜆/i.test(p);
}

function isGraph(p) {
    return /\bgraph\b|plot|y\s*=\s*[^=]/i.test(p);
}

function isGeometry(p) {
    return /area|perimeter|circumference|volume|radius|diameter|circle|triangle|rectangle|square|sphere|cube|hypotenuse|pythag/i.test(p);
}

function isIntegral(p) {
    return /integrate|integral|∫|antiderivative/i.test(p);
}

function isDerivative(p) {
    return /derive|derivative|differentiate|d\/dx/i.test(p);
}

function isQuadratic(p) {
    return /[a-z]\^2|[a-z]²/i.test(p) && /=/.test(p);
}

function isLinear(p) {
    return /[a-z]/i.test(p) && /=/.test(p) && !/\^/.test(p);
}

function isArithmetic(p) {
    return /^[\d\s\+\-\*\/\(\)\.\^\%]+$/.test(p);
}

// ==================== SOLVERS ====================

function solveArithmetic(problem, number) {
    const steps = [{ description: 'Evaluate expression', math: problem }];
    
    try {
        const result = math.evaluate(problem);
        const formatted = formatNumber(result);
        
        steps.push({ description: 'Result', math: `= ${formatted}` });
        
        return {
            number,
            original: problem,
            type: 'Arithmetic',
            steps,
            answer: formatted
        };
    } catch (e) {
        throw new Error('Invalid arithmetic expression');
    }
}

function solveLinear(problem, number) {
    const steps = [{ description: 'Original equation', math: problem }];
    
    const [left, right] = problem.split('=').map(s => s.trim());
    if (!right) throw new Error('Invalid equation');
    
    const varMatch = problem.match(/[a-z]/i);
    const variable = varMatch ? varMatch[0] : 'x';
    
    // Parse both sides
    const leftParsed = parseLinear(left, variable);
    const rightParsed = parseLinear(right, variable);
    
    const a = leftParsed.coef - rightParsed.coef;
    const c = rightParsed.const - leftParsed.const;
    
    if (a === 0) throw new Error('No variable found');
    
    steps.push({ 
        description: 'Isolate variable', 
        math: `${a}${variable} = ${c}` 
    });
    
    const result = c / a;
    steps.push({ 
        description: 'Divide', 
        math: `${variable} = ${formatNumber(result)}` 
    });
    
    return {
        number,
        original: problem,
        type: 'Linear Equation',
        steps,
        answer: `${variable} = ${formatNumber(result)}`
    };
}

function parseLinear(expr, variable) {
    let coef = 0, constant = 0;
    const normalized = expr.replace(/\s/g, '').replace(/-/g, '+-');
    const terms = normalized.split('+').filter(t => t);
    
    for (const term of terms) {
        if (term.includes(variable)) {
            const c = term.replace(variable, '').replace('*', '');
            coef += c === '' || c === '+' ? 1 : (c === '-' ? -1 : parseFloat(c));
        } else {
            constant += parseFloat(term) || 0;
        }
    }
    
    return { coef, const: constant };
}

function solveQuadratic(problem, number) {
    const steps = [{ description: 'Original equation', math: problem }];
    
    const equation = problem.replace(/²/g, '^2');
    const varMatch = equation.match(/[a-z]/i);
    const v = varMatch ? varMatch[0] : 'x';
    
    const [left, right] = equation.split('=');
    const { a, b, c } = parseQuadratic(left, right || '0', v);
    
    steps.push({ 
        description: 'Standard form', 
        math: `${a}${v}² + ${b}${v} + ${c} = 0` 
    });
    
    const discriminant = b * b - 4 * a * c;
    steps.push({ 
        description: 'Discriminant', 
        math: `Δ = b² - 4ac = ${discriminant}` 
    });
    
    let answer;
    if (discriminant > 0) {
        const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
        steps.push({ 
            description: 'Two real roots', 
            math: `${v} = ${formatNumber(x1)} or ${v} = ${formatNumber(x2)}` 
        });
        answer = `${v} = ${formatNumber(x1)}, ${v} = ${formatNumber(x2)}`;
    } else if (discriminant === 0) {
        const x = -b / (2 * a);
        steps.push({ description: 'One repeated root', math: `${v} = ${formatNumber(x)}` });
        answer = `${v} = ${formatNumber(x)}`;
    } else {
        const real = -b / (2 * a);
        const imag = Math.sqrt(-discriminant) / (2 * a);
        steps.push({ 
            description: 'Complex roots', 
            math: `${v} = ${formatNumber(real)} ± ${formatNumber(imag)}i` 
        });
        answer = `${v} = ${formatNumber(real)} ± ${formatNumber(imag)}i`;
    }
    
    return { number, original: problem, type: 'Quadratic Equation', steps, answer };
}

function parseQuadratic(left, right, v) {
    let a = 0, b = 0, c = 0;
    const combined = `${left}-(${right})`.replace(/\s/g, '').replace(/-/g, '+-').replace(/\+\+/g, '+');
    const terms = combined.split('+').filter(t => t);
    
    for (const term of terms) {
        if (term.includes('^2') || term.includes('²')) {
            const coef = term.replace(new RegExp(`${v}\\^?2?`, 'g'), '').replace('*', '');
            a += coef === '' || coef === '+' ? 1 : (coef === '-' ? -1 : parseFloat(coef));
        } else if (term.includes(v)) {
            const coef = term.replace(v, '').replace('*', '');
            b += coef === '' || coef === '+' ? 1 : (coef === '-' ? -1 : parseFloat(coef));
        } else if (term) {
            c += parseFloat(term) || 0;
        }
    }
    
    return { a, b, c };
}

function solveDerivative(problem, number) {
    const steps = [];
    let func = problem.replace(/derive|derivative|differentiate|d\/dx|of|:/gi, '').trim();
    func = func.replace(/f\(x\)\s*=\s*/i, '').trim();
    
    steps.push({ description: 'Function', math: `f(x) = ${func}` });
    
    // Try Algebrite first for symbolic differentiation
    if (Algebrite) {
        try {
            const derivative = Algebrite.run(`d(${func},x)`);
            steps.push({ description: 'Apply differentiation rules', math: `d/dx[${func}]` });
            steps.push({ description: 'Result', math: `= ${derivative}` });
            
            return {
                number,
                original: problem,
                type: 'Derivative',
                steps,
                answer: `f'(x) = ${derivative}`
            };
        } catch (e) {}
    }
    
    // Fallback: Simple power rule implementation
    const normalized = func.replace(/\s/g, '').replace(/-/g, '+-');
    const terms = normalized.split('+').filter(t => t);
    const derivTerms = [];
    
    for (const term of terms) {
        if (!term.includes('x')) {
            steps.push({ description: `d/dx[${term}] = 0`, math: 'Constant rule' });
            continue;
        }
        
        const match = term.match(/^([\-\d\.]*)x\^?([\d\.]*)/);
        if (match) {
            let coef = match[1] === '' || match[1] === '+' ? 1 : (match[1] === '-' ? -1 : parseFloat(match[1]));
            let exp = match[2] ? parseFloat(match[2]) : 1;
            
            const newCoef = coef * exp;
            const newExp = exp - 1;
            
            let result;
            if (newExp === 0) result = `${newCoef}`;
            else if (newExp === 1) result = `${newCoef}x`;
            else result = `${newCoef}x^${newExp}`;
            
            steps.push({ description: `Power rule on ${term}`, math: `= ${result}` });
            derivTerms.push(result);
        }
    }
    
    const derivative = derivTerms.join(' + ').replace(/\+ -/g, '- ') || '0';
    
    return {
        number,
        original: problem,
        type: 'Derivative',
        steps,
        answer: `f'(x) = ${derivative}`
    };
}

function solveIntegral(problem, number) {
    const steps = [];
    let func = problem.replace(/integrate|integral|∫|of|:/gi, '').trim();
    
    // Check for definite integral
    const boundsMatch = func.match(/from\s*([\d\.\-]+)\s*to\s*([\d\.\-]+)/i);
    let lower = null, upper = null;
    if (boundsMatch) {
        lower = parseFloat(boundsMatch[1]);
        upper = parseFloat(boundsMatch[2]);
        func = func.replace(/from\s*[\d\.\-]+\s*to\s*[\d\.\-]+/i, '').trim();
    }
    
    func = func.replace(/dx/gi, '').trim();
    steps.push({ description: 'Integrate', math: `∫ ${func} dx` });
    
    // Try Algebrite first for symbolic integration
    let integral;
    if (Algebrite) {
        try {
            integral = Algebrite.run(`integral(${func},x)`);
            steps.push({ description: 'Apply integration rules', math: `∫ ${func} dx = ${integral}` });
        } catch (e) {
            integral = null;
        }
    }
    
    // If Algebrite didn't work, use power rule
    if (!integral) {
        // Power rule integration
        const normalized = func.replace(/\s/g, '').replace(/-/g, '+-');
        const terms = normalized.split('+').filter(t => t);
        const integTerms = [];
        
        for (const term of terms) {
            if (!term.includes('x')) {
                integTerms.push(`${term}x`);
                steps.push({ description: `∫${term} dx`, math: `= ${term}x` });
                continue;
            }
            
            const match = term.match(/^([\-\d\.]*)x\^?([\-\d\.]*)/);
            if (match) {
                let coef = match[1] === '' || match[1] === '+' ? 1 : (match[1] === '-' ? -1 : parseFloat(match[1]));
                let exp = match[2] ? parseFloat(match[2]) : 1;
                
                const newExp = exp + 1;
                const newCoef = coef / newExp;
                
                let result;
                if (newExp === 1) result = `${formatNumber(newCoef)}x`;
                else result = `${formatNumber(newCoef)}x^${newExp}`;
                
                steps.push({ description: `Power rule on ${term}`, math: `= ${result}` });
                integTerms.push(result);
            }
        }
        
        integral = integTerms.join(' + ').replace(/\+ -/g, '- ');
    }
    
    if (lower !== null && upper !== null) {
        // Evaluate definite integral
        try {
            // Add * between coefficient and x for proper evaluation
            const antiderivExpr = integral.replace(/(\d)x/g, '$1*x').replace(/(\d)\(/g, '$1*(');
            const evalAt = (xVal) => {
                return math.evaluate(antiderivExpr, { x: xVal });
            };
            const result = evalAt(upper) - evalAt(lower);
            steps.push({ 
                description: `Evaluate from ${lower} to ${upper}`, 
                math: `F(${upper}) - F(${lower}) = ${formatNumber(result)}` 
            });
            return {
                number,
                original: problem,
                type: 'Definite Integral',
                steps,
                answer: formatNumber(result)
            };
        } catch (e) {
            // Fall through to indefinite
        }
    }
    
    return {
        number,
        original: problem,
        type: 'Indefinite Integral',
        steps,
        answer: `${integral} + C`
    };
}

function solveGeometry(problem, number) {
    const lower = problem.toLowerCase();
    const numbers = problem.match(/[\d.]+/g)?.map(n => parseFloat(n)) || [];
    const steps = [{ description: 'Problem', math: problem }];
    
    // Circle
    if (/circle|radius|diameter|circumference/i.test(problem)) {
        let r = numbers[0] || 1;
        if (/diameter/i.test(problem)) r /= 2;
        
        const area = Math.PI * r * r;
        const circ = 2 * Math.PI * r;
        
        steps.push({ description: 'Radius', math: `r = ${r}` });
        steps.push({ description: 'Area = πr²', math: `= ${formatNumber(area)}` });
        steps.push({ description: 'Circumference = 2πr', math: `= ${formatNumber(circ)}` });
        
        return {
            number,
            original: problem,
            type: 'Circle',
            steps,
            answer: `Area = ${formatNumber(area)}, C = ${formatNumber(circ)}`
        };
    }
    
    // Triangle
    if (/triangle|hypotenuse|pythag/i.test(problem) && numbers.length >= 2) {
        const [a, b] = numbers;
        const c = Math.sqrt(a * a + b * b);
        const area = 0.5 * a * b;
        
        steps.push({ description: 'Sides', math: `a = ${a}, b = ${b}` });
        steps.push({ description: 'Pythagorean: c² = a² + b²', math: `c = √(${a*a} + ${b*b}) = ${formatNumber(c)}` });
        steps.push({ description: 'Area = ½ab', math: `= ${formatNumber(area)}` });
        
        return {
            number,
            original: problem,
            type: 'Right Triangle',
            steps,
            answer: `Hypotenuse = ${formatNumber(c)}, Area = ${formatNumber(area)}`
        };
    }
    
    // Rectangle
    if (/rectangle/i.test(problem) && numbers.length >= 2) {
        const [w, h] = numbers;
        const area = w * h;
        const perim = 2 * (w + h);
        
        steps.push({ description: 'Dimensions', math: `${w} × ${h}` });
        steps.push({ description: 'Area', math: `= ${area}` });
        steps.push({ description: 'Perimeter', math: `= ${perim}` });
        
        return {
            number,
            original: problem,
            type: 'Rectangle',
            steps,
            answer: `Area = ${area}, Perimeter = ${perim}`
        };
    }
    
    // Square
    if (/square/i.test(problem) && numbers.length >= 1) {
        const s = numbers[0];
        
        return {
            number,
            original: problem,
            type: 'Square',
            steps: [
                { description: 'Side', math: `s = ${s}` },
                { description: 'Area = s²', math: `= ${s * s}` },
                { description: 'Perimeter = 4s', math: `= ${4 * s}` }
            ],
            answer: `Area = ${s * s}, Perimeter = ${4 * s}`
        };
    }
    
    return {
        number,
        original: problem,
        type: 'Geometry',
        steps,
        answer: 'Please specify shape and dimensions'
    };
}

function solveGraph(problem, number) {
    let func = problem.replace(/graph|plot|draw/gi, '').trim();
    
    return {
        number,
        original: problem,
        type: 'Graph',
        steps: [{ description: 'Function', math: func }],
        answer: func
    };
}

// ==================== NEW SOLVERS ====================

function solveMatrix(problem, number) {
    const steps = [{ description: 'Matrix Problem', math: problem.substring(0, 150) }];
    
    const rows = problem.match(/\[([\d\s,\-\.]+)\]/g);
    if (rows && rows.length > 0) {
        const matrix = rows.map(row => {
            const nums = row.match(/-?[\d\.]+/g);
            return nums ? nums.map(n => parseFloat(n)) : [];
        }).filter(r => r.length > 0);
        
        if (matrix.length > 0) {
            steps.push({ description: 'Parsed matrix', math: matrix.map(r => `[${r.join(', ')}]`).join(', ') });
            
            if (/determinant|det/i.test(problem) && matrix.length === matrix[0]?.length) {
                try {
                    const det = math.det(matrix);
                    return { number, original: problem, type: 'Matrix — Determinant', steps, answer: `Determinant = ${det}` };
                } catch (e) {}
            }
            
            if (/inverse/i.test(problem)) {
                try {
                    const inv = math.inv(matrix);
                    return { number, original: problem, type: 'Matrix — Inverse', steps, answer: `Inverse: ${JSON.stringify(inv)}` };
                } catch (e) {}
            }
            
            if (/transpose/i.test(problem)) {
                const transposed = math.transpose(matrix);
                return { number, original: problem, type: 'Matrix — Transpose', steps, answer: `Transpose: ${JSON.stringify(transposed)}` };
            }
        }
    }
    
    return { number, original: problem, type: 'Matrix', steps, answer: 'Enter matrix as [[a,b],[c,d]]' };
}

function solveStatistics(problem, number) {
    const steps = [{ description: 'Statistics Problem', math: problem.substring(0, 150) }];
    
    const numbers = problem.match(/-?[\d\.]+/g);
    if (numbers && numbers.length > 1) {
        const data = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));
        steps.push({ description: 'Data set', math: data.join(', ') });
        
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / data.length;
        const stdDev = Math.sqrt(variance);
        
        steps.push({ description: 'Mean', math: `μ = ${mean.toFixed(4)}` });
        steps.push({ description: 'Median', math: `${median}` });
        steps.push({ description: 'Standard Deviation', math: `σ = ${stdDev.toFixed(4)}` });
        
        return { number, original: problem, type: 'Statistics', steps, answer: `Mean: ${mean.toFixed(4)}, Median: ${median}, Std Dev: ${stdDev.toFixed(4)}` };
    }
    
    return { number, original: problem, type: 'Statistics', steps, answer: 'Provide numerical data' };
}

function solveLimit(problem, number) {
    const steps = [{ description: 'Limit Problem', math: problem.substring(0, 150) }];
    
    const limitMatch = problem.match(/lim(?:it)?\s*(?:as\s+)?(\w)\s*[→->]+\s*(-?[\d\.]+|infinity|∞)/i);
    if (limitMatch) {
        const variable = limitMatch[1];
        const approach = limitMatch[2];
        steps.push({ description: 'Limit setup', math: `As ${variable} → ${approach}` });
        
        if (approach !== 'infinity' && approach !== '∞') {
            const funcMatch = problem.match(/[→->]+\s*(?:-?[\d\.]+)\s*(?:of\s*)?(.*)/i);
            if (funcMatch) {
                try {
                    const value = parseFloat(approach);
                    const clean = funcMatch[1].replace(new RegExp(variable, 'g'), `(${value})`);
                    const result = math.evaluate(clean);
                    return { number, original: problem, type: 'Limit', steps, answer: `Limit = ${result}` };
                } catch (e) {}
            }
        }
    }
    
    steps.push({ description: 'Methods', math: "Direct substitution, L'Hôpital's rule, factoring" });
    return { number, original: problem, type: 'Limit', steps, answer: 'Apply limit techniques' };
}

function solveLogarithm(problem, number) {
    const steps = [{ description: 'Logarithm Problem', math: problem.substring(0, 150) }];
    
    const lnMatch = problem.match(/ln\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i);
    if (lnMatch) {
        const x = parseFloat(lnMatch[1]);
        const result = Math.log(x);
        return { number, original: problem, type: 'Natural Logarithm', steps, answer: `ln(${x}) = ${result.toFixed(6)}` };
    }
    
    const logMatch = problem.match(/log(?:_?(\d+))?\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i);
    if (logMatch) {
        const base = logMatch[1] ? parseFloat(logMatch[1]) : 10;
        const x = parseFloat(logMatch[2]);
        const result = Math.log(x) / Math.log(base);
        return { number, original: problem, type: 'Logarithm', steps, answer: `log_${base}(${x}) = ${result.toFixed(6)}` };
    }
    
    return { number, original: problem, type: 'Logarithm', steps, answer: 'Apply log properties' };
}

function solveTrigonometry(problem, number) {
    const steps = [{ description: 'Trigonometry Problem', math: problem.substring(0, 150) }];
    
    const angleMatch = problem.match(/(sin|cos|tan|cot|sec|csc)\s*\(?\s*(-?[\d\.]+)\s*(degrees?|°|radians?|rad)?\s*\)?/i);
    if (angleMatch) {
        const func = angleMatch[1].toLowerCase();
        let angle = parseFloat(angleMatch[2]);
        const unit = angleMatch[3]?.toLowerCase() || '';
        
        if (unit.includes('degree') || unit.includes('°') || (!unit && angle > 2 * Math.PI)) {
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
        
        return { number, original: problem, type: 'Trigonometry', steps, answer: `${func}(${angleMatch[2]}${angleMatch[3] || ''}) = ${result.toFixed(6)}` };
    }
    
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
        return { number, original: problem, type: 'Inverse Trigonometry', steps, answer: `${func}(${x}) = ${degrees.toFixed(4)}°` };
    }
    
    return { number, original: problem, type: 'Trigonometry', steps, answer: 'Apply trig formulas' };
}

function solveComplexNumber(problem, number) {
    const steps = [{ description: 'Complex Number Problem', math: problem.substring(0, 150) }];
    
    const complexMatch = problem.match(/(-?[\d\.]+)\s*([+-])\s*([\d\.]+)\s*i/);
    if (complexMatch) {
        const a = parseFloat(complexMatch[1]);
        const sign = complexMatch[2] === '+' ? 1 : -1;
        const b = sign * parseFloat(complexMatch[3]);
        
        const modulus = Math.sqrt(a * a + b * b);
        const arg = Math.atan2(b, a) * 180 / Math.PI;
        
        steps.push({ description: 'Complex number', math: `z = ${a} + ${b}i` });
        steps.push({ description: 'Modulus', math: `|z| = ${modulus.toFixed(4)}` });
        steps.push({ description: 'Argument', math: `arg(z) = ${arg.toFixed(2)}°` });
        
        return { number, original: problem, type: 'Complex Number', steps, answer: `|z| = ${modulus.toFixed(4)}, arg(z) = ${arg.toFixed(2)}°` };
    }
    
    return { number, original: problem, type: 'Complex Number', steps, answer: 'Apply complex number formulas' };
}

function solveGeneric(problem, number) {
    const steps = [{ description: 'Expression', math: problem }];
    
    try {
        const result = math.evaluate(problem);
        return {
            number,
            original: problem,
            type: 'Expression',
            steps,
            answer: formatNumber(result)
        };
    } catch (e) {
        try {
            const simplified = math.simplify(problem).toString();
            return {
                number,
                original: problem,
                type: 'Simplification',
                steps,
                answer: simplified
            };
        } catch (e2) {
            throw new Error('Could not evaluate expression');
        }
    }
}

function formatNumber(num) {
    if (typeof num !== 'number') return String(num);
    if (Number.isInteger(num)) return num.toString();
    return Math.round(num * 10000) / 10000 + '';
}

// ==================== VECTOR SOLVER ====================

function solveVector(problem, number) {
    const steps = [];
    
    steps.push({
        description: 'Vector Problem',
        math: problem.substring(0, 150) + (problem.length > 150 ? '...' : '')
    });
    
    // Extract all points from the problem
    const pointsMatch = problem.match(/([A-Z])\s*[\(\[\{]?\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*[\)\]\}]?/gi);
    
    // Parse points into object
    const parsePoints = (matches) => {
        const points = {};
        if (!matches) return points;
        for (const pm of matches) {
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
    };
    
    const points = parsePoints(pointsMatch);
    const pointNames = Object.keys(points).sort();
    
    // Find vectors AB, AC etc if points are given
    if (pointNames.length >= 2) {
        steps.push({
            description: 'Given points',
            math: pointNames.map(n => `${n}(${points[n].x}, ${points[n].y}, ${points[n].z})`).join(', ')
        });
        
        const results = [];
        
        // Calculate common vectors
        for (let i = 0; i < pointNames.length; i++) {
            for (let j = i + 1; j < pointNames.length; j++) {
                const p1 = pointNames[i];
                const p2 = pointNames[j];
                const A = points[p1];
                const B = points[p2];
                
                const vx = B.x - A.x;
                const vy = B.y - A.y;
                const vz = B.z - A.z;
                
                steps.push({
                    description: `Vector ${p1}${p2}→ = ${p2} - ${p1}`,
                    math: `${p1}${p2}→ = (${vx}, ${vy}, ${vz})`
                });
                
                results.push(`${p1}${p2}→ = (${vx}, ${vy}, ${vz})`);
            }
        }
        
        // If 3 points, also calculate cross product and area
        if (pointNames.length >= 3) {
            const A = points[pointNames[0]];
            const B = points[pointNames[1]];
            const C = points[pointNames[2]];
            
            const AB = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
            const AC = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
            
            // Cross product for normal/area
            const cross = {
                x: AB.y * AC.z - AB.z * AC.y,
                y: AB.z * AC.x - AB.x * AC.z,
                z: AB.x * AC.y - AB.y * AC.x
            };
            
            const magnitude = Math.sqrt(cross.x**2 + cross.y**2 + cross.z**2);
            const area = magnitude / 2;
            
            steps.push({
                description: `Cross product ${pointNames[0]}${pointNames[1]}→ × ${pointNames[0]}${pointNames[2]}→`,
                math: `= (${cross.x}, ${cross.y}, ${cross.z})`
            });
            
            steps.push({
                description: 'Triangle area = ½|AB→ × AC→|',
                math: `Area = ${area.toFixed(4)} sq units`
            });
            
            results.push(`Area of triangle = ${area.toFixed(4)}`);
            
            // Plane equation: nx(x-x0) + ny(y-y0) + nz(z-z0) = 0
            const d = cross.x * A.x + cross.y * A.y + cross.z * A.z;
            steps.push({
                description: 'Plane equation through these points',
                math: `${cross.x}x + ${cross.y}y + ${cross.z}z = ${d}`
            });
            
            results.push(`Plane: ${cross.x}x + ${cross.y}y + ${cross.z}z = ${d}`);
        }
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Calculate Vectors',
            steps,
            answer: results.join('; ')
        };
    }
    
    // Perpendicular vectors with variable k
    if (/perpendicular/i.test(problem)) {
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
            
            steps.push({ description: 'Vector a', math: `a = (${a.join(', ')})` });
            steps.push({ description: 'Vector b', math: `b = (${b.join(', ')})` });
            steps.push({ description: 'Perpendicular condition', math: 'a • b = 0' });
            
            // Try solving with nerdamer
            try {
                let terms = [];
                for (let i = 0; i < Math.min(a.length, b.length); i++) {
                    const ai = a[i].replace(/𝑘/g, 'k').replace(/\s/g, '');
                    const bi = b[i].replace(/𝑘/g, 'k').replace(/\s/g, '');
                    terms.push(`(${ai})*(${bi})`);
                }
                const expr = terms.join('+');
                
                steps.push({ description: 'Dot product', math: expr.replace(/\*/g, '×') + ' = 0' });
                
                if (nerdamer) {
                    const solutions = nerdamer.solve(expr, 'k').toString();
                    const kValues = solutions.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                    
                    steps.push({ description: 'Solve', math: `k = ${kValues.join(' or k = ')}` });
                    
                    return {
                        number,
                        original: problem.substring(0, 100),
                        type: 'Vector — Perpendicular (Solve for k)',
                        steps,
                        answer: `k = ${kValues.join(' or k = ')}`
                    };
                }
            } catch (e) {
                steps.push({ description: 'Method', math: 'Expand dot product and solve for k' });
            }
        }
        
        return {
            number,
            original: problem.substring(0, 100),
            type: 'Vector — Perpendicular',
            steps,
            answer: 'Set a • b = 0 and solve for the variable'
        };
    }
    
    // Dot product with numeric vectors
    const numVectorMatch = problem.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/gi);
    if (numVectorMatch && numVectorMatch.length >= 2 && /dot|•|perpendicular/i.test(problem)) {
        const parseVec = (str) => {
            const m = str.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,?\s*(-?\d+)?\s*\)/);
            return m ? [parseFloat(m[1]), parseFloat(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
        };
        
        const a = parseVec(numVectorMatch[0]);
        const b = parseVec(numVectorMatch[1]);
        
        if (a && b) {
            const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
            
            steps.push({ description: 'Vector a', math: `a = (${a.join(', ')})` });
            steps.push({ description: 'Vector b', math: `b = (${b.join(', ')})` });
            steps.push({ description: 'Dot product', math: `a • b = ${a[0]}×${b[0]} + ${a[1]}×${b[1]} + ${a[2]}×${b[2]} = ${dot}` });
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Dot Product',
                steps,
                answer: `a • b = ${dot}${dot === 0 ? ' (perpendicular)' : ''}`
            };
        }
    }
    
    // Magnitude / unit vector
    if (/magnitude|unit\s*vector/i.test(problem) && numVectorMatch) {
        const parseVec = (str) => {
            const m = str.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)?\s*\)/);
            return m ? [parseFloat(m[1]), parseFloat(m[2]), m[3] ? parseFloat(m[3]) : 0] : null;
        };
        
        const v = parseVec(numVectorMatch[0]);
        if (v) {
            const mag = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
            
            steps.push({ description: 'Vector v', math: `v = (${v.join(', ')})` });
            steps.push({ description: 'Magnitude', math: `|v| = √(${v[0]}² + ${v[1]}² + ${v[2]}²) = ${mag.toFixed(4)}` });
            
            if (/unit/i.test(problem)) {
                const unit = v.map(c => (c / mag).toFixed(4));
                steps.push({ description: 'Unit vector', math: `û = (${unit.join(', ')})` });
                
                return {
                    number,
                    original: problem.substring(0, 100),
                    type: 'Vector — Unit Vector',
                    steps,
                    answer: `|v| = ${mag.toFixed(4)}, û = (${unit.join(', ')})`
                };
            }
            
            return {
                number,
                original: problem.substring(0, 100),
                type: 'Vector — Magnitude',
                steps,
                answer: `|v| = ${mag.toFixed(4)}`
            };
        }
    }
    
    // Generic vector problem hints
    const hints = [];
    if (/AB\s*→|vector\s*AB/i.test(problem)) hints.push('Vector AB = B - A');
    if (/perpendicular/i.test(problem)) hints.push('Perpendicular: a • b = 0');
    if (/plane.*equation/i.test(problem)) hints.push('Plane: ax + by + cz = d');
    if (/cross/i.test(problem)) hints.push('Cross product for normal/area');
    if (/angle/i.test(problem)) hints.push('cos θ = (a•b)/(|a||b|)');
    if (/reflection/i.test(problem)) hints.push('Reflect along normal vector');
    
    steps.push({ description: 'Analysis', math: hints.length > 0 ? hints.join('; ') : 'Apply vector methods' });
    
    return {
        number,
        original: problem.substring(0, 100),
        type: 'Vector Problem',
        steps,
        answer: hints.length > 0 ? hints.join('; ') : 'Apply vector operations as needed'
    };
}

module.exports = { solveMath };
