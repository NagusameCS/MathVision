# MathVision 📐

> **A free, community-powered math problem solver that extracts and solves ANY math problem from images, PDFs, or manual input. 100% client-side — no external APIs or billing required!**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Client-Side](https://img.shields.io/badge/runs-100%25%20in%20browser-brightgreen)

## 📢 How It Works

**MathVision is free to use.** In exchange, all solved problems are uploaded to our **public community database**. This creates a valuable resource for students and educators while keeping the tool free for everyone.

- ✅ Free to use, no signup required
- ✅ All math processing happens in your browser
- 📤 Solved problems are shared publicly in the database
- 🌐 Browse problems solved by users worldwide

## ✨ Features

### 🧮 Universal Math Solver
Handles virtually **any math problem** you throw at it:

| Category | Examples |
|----------|----------|
| **Arithmetic** | `2 + 3 * 4`, `(10 - 5) / 2` |
| **Algebra** | `2x + 5 = 15`, `x^2 - 4x + 3 = 0` |
| **Calculus** | `derivative of sin(x^2)`, `integrate x^3 from 0 to 2` |
| **Geometry** | `area of circle radius 5`, `perimeter of rectangle 3 by 7` |
| **Trigonometry** | `sin(45 degrees)`, `arctan(1)` |
| **Statistics** | `mean of 10, 20, 30, 40, 50`, `standard deviation` |
| **Matrices** | `[[1,2],[3,4]] determinant`, `matrix inverse` |
| **Vectors** | `dot product`, `cross product`, `magnitude` |
| **Logarithms** | `log_2(8)`, `ln(e^3)` |
| **Complex Numbers** | `3 + 4i modulus`, `complex conjugate` |
| **Limits** | `limit as x → 0 of sin(x)/x` |
| **Series** | `sum of 1/n^2`, `Taylor series` |

### 📸 Input Methods
- **📷 Image Upload & Camera** — Snap or upload photos of handwritten/printed problems
- **📄 PDF Support** — Import PDFs and get annotated solutions in red
- **⌨️ Manual Input** — Type problems directly with syntax hints
- **📋 Paste Images** — Ctrl+V to paste screenshots directly

### 🔧 Core Features
- **🔍 OCR Powered** — Tesseract.js with enhanced preprocessing for accuracy
- **📊 Visualizations** — Interactive graphs and diagrams (Plotly.js)
- **📝 Step-by-Step** — Detailed solution explanations
- **📥 PDF Export** — Download annotated PDFs with solutions
- **☁️ Community Database** — All problems shared publicly in Firebase
- **🎨 Dark Theme** — Sleek monotone UI with accessibility support
- **⌨️ Keyboard Shortcuts** — Ctrl+Enter to solve, number keys to switch tabs
- **🖥️ CLI Tool** — Command-line interface for terminal lovers

## 🛠️ Open Source Libraries Used

All libraries are **free and open-source** with no billing required:

| Library | Purpose |
|---------|---------|
| **Tesseract.js** | OCR - Extract text from images |
| **Math.js** | Numerical computation and parsing |
| **Algebrite** | Symbolic math (derivatives, integrals, simplification) |
| **Nerdamer** | Advanced equation solving and algebra |
| **PDF.js** | Read and render PDF documents (Mozilla) |
| **pdf-lib** | Create and annotate PDFs |
| **Plotly.js** | Interactive graphs and charts |
| **Function-Plot** | Additional function graphing |
| **KaTeX** | Beautiful math equation rendering |
| **D3.js** | Data visualization foundation |
| **Sharp** (CLI) | High-performance image preprocessing |

## 🚀 Getting Started

### Web Version

#### Option 1: Open Directly
Simply open `index.html` in your web browser. No installation required!

#### Option 2: Use a Local Server
For better performance with file uploads, run a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (with http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### CLI Version

```bash
# Install globally
cd cli && npm install && npm link

# Solve problems
mathvision solve "2x + 5 = 15"
mv solve "x^2 - 5x + 6 = 0"
mv solve "derivative of x^3 + 2x"
mv solve "integrate x^2 from 0 to 3"

# Solve and output as PDF
mv solve "2x + 5 = 15; x^2 - 9 = 0" -p solutions.pdf

# Process PDF files
mathvision pdf homework.pdf -o solved-homework.pdf
mv pdf test.pdf --output answers.pdf --verbose

# Extract from image
mathvision ocr photo.jpg

# Interactive mode
mathvision interactive
```

## 📄 PDF Features

### Web App
1. **Upload PDF**: Click "Choose PDF" or drag & drop a PDF file
2. **Preview Pages**: See thumbnail previews of PDF pages
3. **Solve Problems**: Click "Solve" to extract and solve math problems
4. **Download Annotated PDF**: Get your PDF with solutions annotated in red

### CLI
```bash
# Process a PDF and create annotated output
mathvision pdf worksheet.pdf -o solved.pdf

# With verbose output
mathvision pdf exam.pdf -o exam-solved.pdf --verbose
```

## 📖 How to Use

1. **Upload an Image**: Click "Choose Image" or drag and drop an image of your math problem
2. **Or Take a Photo**: Click "Use Camera" to capture a photo directly
3. **Or Type Manually**: Enter your math problem in the text box
4. **Click Solve**: Press the "Solve Problem" button
5. **View Results**: See the step-by-step solution, final answer, and visualization

## 🔧 Supported Problem Types

| Type | Example | Description |
|------|---------|-------------|
| Arithmetic | `(5 + 3) * 2 - 4` | Basic calculations following PEMDAS |
| Linear Equations | `3x + 7 = 22` | Single variable equations |
| Quadratic Equations | `x^2 - 5x + 6 = 0` | Using quadratic formula |
| Derivatives | `derivative of 3x^2 + 2x + 1` | Power rule differentiation |
| Integrals | `integrate x^3 from 0 to 2` | Definite and indefinite integrals |
| Geometry | `area of circle radius 5` | Circles, triangles, rectangles |
| Graphing | `graph y = x^2` | Function visualization |

## � Privacy & Security

**Your privacy is our priority:**

- ✅ **100% Client-Side** — All processing happens in your browser
- ✅ **No Data Sent** — Your images and problems never leave your device
- ✅ **No API Keys Required** — Works offline, no billing
- ✅ **Optional Cloud Sync** — Firebase integration is opt-in only
- ✅ **Local History** — Problem history stored locally by default

### Firebase Configuration (Optional)

If you want to sync problems to Firebase:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Copy `firebase-config.js` to `firebase-config.local.js`
3. Add your Firebase config values
4. The `.gitignore` excludes `.local.js` files to protect your keys

```javascript
// firebase-config.local.js (gitignored)
window.MATHVISION_FIREBASE_CONFIG = {
    apiKey: "your-api-key",
    projectId: "your-project-id",
    // ... other config
};
window.MATHVISION_FIREBASE_ENABLED = true;
```

## 🛠️ Technology Stack

All libraries are **free and open-source** with no billing:

| Library | Purpose |
|---------|---------|
| **Tesseract.js** | OCR — Extract text from images |
| **Math.js** | Numerical computation and parsing |
| **Algebrite** | Symbolic math (derivatives, integrals) |
| **Nerdamer** | Advanced equation solving |
| **PDF.js** | Read and render PDFs (Mozilla) |
| **pdf-lib** | Create and annotate PDFs |
| **Plotly.js** | Interactive graphs and charts |
| **KaTeX** | Beautiful math equation rendering |
| **Firebase** | Optional cloud sync |

## 📁 Project Structure

```
MathVision/
├── index.html          # Main HTML file
├── styles.css          # Styling and layout
├── app.js              # UI logic, tabs, history, OCR
├── mathSolver.js       # Universal math solving engine
├── pdfHandler.js       # PDF loading and annotation
├── visualizer.js       # Graph and diagram rendering
├── firebase-config.js  # Firebase config template
├── .gitignore          # Ignores local config files
├── cli/                # Command-line interface
│   ├── bin/            # CLI executable
│   ├── lib/            # Core modules
│   └── README.md       # CLI documentation
└── README.md           # This file
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Solve problem |
| `Ctrl + V` | Paste image |
| `1` / `2` / `3` | Switch tabs (Solve/History/About) |
| `Esc` | Close modal |

## 💡 Tips for Best Results

1. **Clear Images** — Use well-lit, high-contrast photos
2. **Neat Handwriting** — Write clearly for OCR accuracy
3. **One Problem per Line** — Separate multiple problems with newlines
4. **Standard Notation** — Use `^` for exponents, `*` for multiplication
5. **Manual Fallback** — Type directly if OCR struggles

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Add support for more math problem types
- Improve OCR accuracy
- Enhance the UI/UX

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Tesseract.js team for the amazing OCR library
- Math.js team for the comprehensive math library
- KaTeX team for beautiful math rendering

---

Made with ❤️ for students and math enthusiasts everywhere
