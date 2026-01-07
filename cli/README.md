# MathVision CLI

A powerful command-line tool for extracting and solving math problems from images and PDFs.

## Features

- 📸 **OCR-powered** — Extract math from photos
- 📄 **PDF Support** — Read PDFs and output annotated solutions in red
- 🧮 **Universal Solver** — Arithmetic, algebra, calculus, geometry, statistics, matrices, vectors
- 🔢 **Symbolic Math** — Powered by Algebrite & Nerdamer for advanced calculus
- ⚡ **Fast** — Optimized image preprocessing and worker caching
- 📊 **Step-by-step** — Detailed solution steps with problem classification

## Installation

```bash
# Install globally
cd cli && npm install && npm link

# Or run locally
npm install
node bin/mathvision.js solve "2x + 5 = 15"
```

## Usage

### Solve from Image

```bash
mathvision ocr photo.jpg
# or use short alias
mv ocr homework.png
```

### Solve Directly

```bash
mathvision solve "2x + 5 = 15"
mv solve "x^2 - 5x + 6 = 0"
mv solve "derivative of sin(x)"
mv solve "derivative of e^x"
mv solve "integrate cos(x)"
mv solve "integrate x^2 from 0 to 3"
mv solve "mean of 10, 20, 30, 40, 50"
mv solve "matrix [[1,2],[3,4]] determinant"
mv solve "sin(45 degrees)"
mv solve "log_2(8)"
```

### Generate Solutions PDF

```bash
# Output solutions to PDF
mv solve "2x + 5 = 15; x^2 - 9 = 0" -p solutions.pdf
```

### Process PDF Files

```bash
# Extract problems from PDF, solve, and create annotated output
mathvision pdf homework.pdf -o solved-homework.pdf

# With verbose output showing steps
mv pdf exam.pdf --output exam-solved.pdf --verbose
```

### Interactive Mode

```bash
mathvision interactive
```

Then type problems one at a time.

## Supported Problem Types

| Type | Examples |
|------|----------|
| Arithmetic | `2 + 3 * 4`, `(10 - 5) / 2` |
| Linear Equations | `2x + 5 = 15`, `3y - 7 = 8` |
| Quadratic Equations | `x^2 - 5x + 6 = 0` |
| Derivatives | `derivative of sin(x)`, `d/dx e^x`, `derivative of ln(x)` |
| Integrals | `integrate cos(x)`, `integrate x^2 from 0 to 3` |
| Trigonometry | `sin(45 degrees)`, `arctan(1)` |
| Statistics | `mean of 10, 20, 30, 40, 50`, `standard deviation` |
| Matrices | `[[1,2],[3,4]] determinant`, `matrix inverse` |
| Logarithms | `log_2(8)`, `ln(e^3)` |
| Geometry | `area of circle radius 5` |

## PDF Features

- **Read PDFs**: Extract text from PDF documents
- **Annotate Solutions**: Red-colored solution annotations
- **Preserve Original**: Annotations are added to existing pages
- **Solutions Page**: Full solutions page appended at the end

## Powered By

- **Algebrite** — Symbolic mathematics (derivatives, integrals)
- **Nerdamer** — Advanced equation solving
- **Math.js** — Numerical computation
- **pdf-lib** — PDF creation and annotation
- **pdf-parse** — PDF text extraction
- **Tesseract.js** — OCR text extraction
- **Sharp** — Image preprocessing

## License

MIT
