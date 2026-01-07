/**
 * MathVision - Main Application
 * Version 2.0.0
 * Handles UI interactions, tabs, history, image processing, PDF handling, and OCR
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the math solver and visualizer
    const solver = new MathSolver();
    const visualizer = new MathVisualizer();
    const pdfHandler = new PDFHandler();
    
    // ==================== DOM ELEMENTS ====================
    
    // Navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // Upload elements
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const pdfInput = document.getElementById('pdfInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadPdfBtn = document.getElementById('uploadPdfBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeBtn = document.getElementById('removeBtn');
    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    const pdfFileName = document.getElementById('pdfFileName');
    const pdfPageCount = document.getElementById('pdfPageCount');
    const pdfPages = document.getElementById('pdfPages');
    const removePdfBtn = document.getElementById('removePdfBtn');
    
    // Input/solve elements
    const manualInput = document.getElementById('manualInput');
    const solveBtn = document.getElementById('solveBtn');
    const processingSection = document.getElementById('processingSection');
    const processingStatus = document.getElementById('processingStatus');
    const resultsSection = document.getElementById('resultsSection');
    const detectedText = document.getElementById('detectedText');
    const editDetectedBtn = document.getElementById('editDetectedBtn');
    const solutionsContainer = document.getElementById('solutionsContainer');
    const pdfDownloadSection = document.getElementById('pdfDownloadSection');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    
    // Quick examples
    const exampleBtns = document.querySelectorAll('.example-btn');
    
    // Camera elements
    const cameraModal = document.getElementById('cameraModal');
    const cameraFeed = document.getElementById('cameraFeed');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCameraBtn');
    
    // History/Database elements
    const historyList = document.getElementById('historyList');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchHistory = document.getElementById('searchHistory');
    const problemCount = document.getElementById('problemCount');
    const firebaseStatus = document.getElementById('firebaseStatus');
    
    // Toast container
    const toastContainer = document.getElementById('toastContainer');
    
    // State
    let currentImage = null;
    let currentPDF = null;
    let stream = null;
    let cachedWorker = null;
    let currentSolutions = null;
    let historyData = [];

    // ==================== NAVIGATION ====================
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    function switchTab(tabName) {
        // Update tab buttons
        navTabs.forEach(t => {
            const isActive = t.dataset.tab === tabName;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive);
        });
        
        // Update panels
        tabPanels.forEach(panel => {
            const isActive = panel.id === `${tabName}-panel`;
            panel.classList.toggle('active', isActive);
            panel.classList.toggle('hidden', !isActive);
        });
        
        // Load history when switching to history tab
        if (tabName === 'history') {
            loadHistory();
        }
        
        // Update firebase status indicator
        if (tabName === 'history') {
            updateFirebaseStatus();
        }
    }
    
    function updateFirebaseStatus() {
        const isEnabled = window.firebaseDB?.enabled;
        const statusDot = firebaseStatus.querySelector('.status-dot');
        const statusText = firebaseStatus.querySelector('span:last-child');
        
        if (isEnabled) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusText.textContent = 'Live database';
        } else {
            statusDot.classList.remove('online');
            statusDot.classList.add('offline');
            statusText.textContent = 'Offline';
        }
    }

    // ==================== HISTORY ====================
    
    async function loadHistory() {
        try {
            historyList.innerHTML = '<div class="history-loading">Loading problem database...</div>';
            historyData = await window.firebaseDB.getProblems(100);
            renderHistory(historyData);
            problemCount.textContent = historyData.length + '+';
            updateFirebaseStatus();
        } catch (error) {
            console.error('Error loading database:', error);
            showToast('Failed to load problem database', 'error');
            historyList.innerHTML = '<div class="history-empty"><p>Failed to connect to database.</p></div>';
        }
    }
    
    function renderHistory(problems) {
        if (problems.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <p>No problems in database yet.</p>
                    <p>Solve a problem to add it to the community database!</p>
                </div>
            `;
            return;
        }
        
        historyList.innerHTML = problems.map(problem => {
            const time = problem.timestamp 
                ? formatTimeAgo(new Date(problem.timestamp.seconds ? problem.timestamp.seconds * 1000 : problem.timestamp))
                : 'Recently';
            
            return `
                <div class="history-item" role="listitem" data-problem="${escapeHtml(problem.originalProblem || '')}">
                    <span class="history-item-category">${escapeHtml(problem.category || problem.problemType || 'General')}</span>
                    <div class="history-item-content">
                        <div class="history-item-problem">${escapeHtml(truncate(problem.originalProblem || 'Unknown', 60))}</div>
                        <div class="history-item-answer">${escapeHtml(truncate(problem.answer || '', 40))}</div>
                    </div>
                    <div class="history-item-meta">
                        <span class="history-item-time">${time}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const problem = item.dataset.problem;
                if (problem) {
                    manualInput.value = problem;
                    switchTab('solve');
                    manualInput.focus();
                }
            });
        });
    }
    
    function filterHistory() {
        const category = categoryFilter.value.toLowerCase();
        const search = searchHistory.value.toLowerCase();
        
        const filtered = historyData.filter(problem => {
            const matchesCategory = !category || 
                (problem.category || '').toLowerCase().includes(category) ||
                (problem.problemType || '').toLowerCase().includes(category);
            const matchesSearch = !search || 
                (problem.originalProblem || '').toLowerCase().includes(search) ||
                (problem.answer || '').toLowerCase().includes(search);
            return matchesCategory && matchesSearch;
        });
        
        renderHistory(filtered);
    }
    
    refreshHistoryBtn?.addEventListener('click', loadHistory);
    
    categoryFilter?.addEventListener('change', filterHistory);
    searchHistory?.addEventListener('input', debounce(filterHistory, 300));

    // ==================== QUICK EXAMPLES ====================
    
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            manualInput.value = btn.dataset.example;
            manualInput.focus();
        });
    });

    // ==================== UPLOAD HANDLERS ====================
    
    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.click();
    });

    uploadPdfBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pdfInput.click();
    });

    uploadArea.addEventListener('click', () => {
        imageInput.click();
    });
    
    uploadArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', handleFileSelect);
    pdfInput.addEventListener('change', handlePDFSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                handlePDFFile(file);
            } else if (file.type.startsWith('image/')) {
                handleFile(file);
            }
        }
    });

    // Remove handlers
    removeBtn.addEventListener('click', () => {
        currentImage = null;
        previewContainer.classList.add('hidden');
        uploadArea.classList.remove('hidden');
        imageInput.value = '';
    });

    removePdfBtn.addEventListener('click', () => {
        currentPDF = null;
        pdfHandler.reset();
        pdfPreviewContainer.classList.add('hidden');
        pdfPages.innerHTML = '';
        uploadArea.classList.remove('hidden');
        pdfInput.value = '';
        pdfDownloadSection.classList.add('hidden');
    });

    // Camera
    cameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCamera();
    });

    captureBtn.addEventListener('click', capturePhoto);
    closeCameraBtn.addEventListener('click', closeCamera);

    // Solve button
    solveBtn.addEventListener('click', solveProblem);

    // Download PDF
    downloadPdfBtn.addEventListener('click', async () => {
        if (currentSolutions && currentSolutions.length > 0) {
            try {
                if (currentPDF) {
                    await pdfHandler.downloadAnnotatedPDF();
                } else {
                    await pdfHandler.downloadSolutionsPDF(currentSolutions);
                }
                showToast('PDF downloaded successfully', 'success');
            } catch (error) {
                console.error('PDF download error:', error);
                showToast('Error generating PDF: ' + error.message, 'error');
            }
        }
    });

    // Edit detected text
    editDetectedBtn.addEventListener('click', () => {
        const currentText = detectedText.textContent;
        manualInput.value = currentText;
        resultsSection.classList.add('hidden');
        manualInput.focus();
    });

    // ==================== KEYBOARD SHORTCUTS ====================
    
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to solve
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            solveProblem();
        }
        
        // Tab switching with number keys (when not in input)
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            if (e.key === '1') switchTab('solve');
            if (e.key === '2') switchTab('history');
            if (e.key === '3') switchTab('about');
        }
        
        // Escape to close modal
        if (e.key === 'Escape') {
            if (!cameraModal.classList.contains('hidden')) {
                closeCamera();
            }
        }
    });
    
    // Paste image
    document.addEventListener('paste', async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleFile(file);
                    showToast('Image pasted', 'success');
                }
                break;
            }
        }
    });

    // ==================== FILE HANDLING ====================

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImage = e.target.result;
            imagePreview.src = currentImage;
            previewContainer.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            pdfPreviewContainer.classList.add('hidden');
            currentPDF = null;
        };
        reader.readAsDataURL(file);
    }

    // ==================== PDF HANDLING ====================

    function handlePDFSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handlePDFFile(file);
        }
    }

    async function handlePDFFile(file) {
        if (file.type !== 'application/pdf') {
            showToast('Please select a PDF file', 'error');
            return;
        }

        showProcessing('Loading PDF...');
        
        try {
            const result = await pdfHandler.loadPDF(file);
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            currentPDF = file;
            currentImage = null;
            
            pdfFileName.textContent = result.fileName;
            pdfPageCount.textContent = `${result.numPages} page${result.numPages !== 1 ? 's' : ''}`;
            
            await renderPDFPreview(Math.min(result.numPages, 3));
            
            previewContainer.classList.add('hidden');
            pdfPreviewContainer.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            
            hideProcessing();
        } catch (error) {
            hideProcessing();
            showToast('Error loading PDF: ' + error.message, 'error');
            console.error('PDF load error:', error);
        }
    }

    async function renderPDFPreview(numPages) {
        pdfPages.innerHTML = '';
        
        for (let i = 1; i <= numPages; i++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-preview';
            
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            
            const pageLabel = document.createElement('span');
            pageLabel.className = 'pdf-page-label';
            pageLabel.textContent = `Page ${i}`;
            
            pageContainer.appendChild(canvas);
            pageContainer.appendChild(pageLabel);
            pdfPages.appendChild(pageContainer);
            
            await pdfHandler.renderPage(i, canvas, 0.5);
        }
    }

    // ==================== CAMERA HANDLING ====================

    async function openCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            cameraFeed.srcObject = stream;
            cameraModal.classList.remove('hidden');
        } catch (error) {
            showToast('Could not access camera. Please check permissions.', 'error');
            console.error('Camera error:', error);
        }
    }

    function capturePhoto() {
        const context = cameraCanvas.getContext('2d');
        cameraCanvas.width = cameraFeed.videoWidth;
        cameraCanvas.height = cameraFeed.videoHeight;
        context.drawImage(cameraFeed, 0, 0);
        
        currentImage = cameraCanvas.toDataURL('image/png');
        imagePreview.src = currentImage;
        previewContainer.classList.remove('hidden');
        uploadArea.classList.add('hidden');
        
        closeCamera();
        showToast('Photo captured', 'success');
    }

    function closeCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraModal.classList.add('hidden');
    }

    // ==================== OCR & SOLVING ====================

    async function solveProblem() {
        let textToSolve = manualInput.value.trim();
        
        if (!textToSolve && currentPDF) {
            try {
                showProcessing('Extracting text from PDF...');
                textToSolve = pdfHandler.getFullText();
                
                if (!textToSolve || textToSolve.trim().length === 0) {
                    throw new Error('No text found in PDF');
                }
            } catch (error) {
                hideProcessing();
                showToast('Failed to extract text from PDF: ' + error.message, 'error');
                return;
            }
        } else if (!textToSolve && currentImage) {
            try {
                showProcessing('Analyzing image with OCR...');
                textToSolve = await performOCR(currentImage);
            } catch (error) {
                hideProcessing();
                showToast('Failed to extract text from image: ' + error.message, 'error');
                return;
            }
        }
        
        if (!textToSolve) {
            showToast('Please upload an image, PDF, or enter a math problem', 'error');
            return;
        }

        showProcessing('Solving problems...');
        
        try {
            const solutions = solver.solve(textToSolve);
            currentSolutions = solutions;
            pdfHandler.setSolutions(solutions);
            displayResults(textToSolve, solutions);
            
            if (solutions && solutions.length > 0) {
                pdfDownloadSection.classList.remove('hidden');
                showToast(`Solved ${solutions.length} problem${solutions.length > 1 ? 's' : ''}!`, 'success');
            }
        } catch (error) {
            hideProcessing();
            showToast('Error solving problem: ' + error.message, 'error');
        }
    }

    async function performOCR(imageData) {
        updateProcessingStatus('Preprocessing image...');
        const processedImage = await preprocessImage(imageData);
        
        updateProcessingStatus('Initializing OCR engine...');
        
        if (!cachedWorker) {
            cachedWorker = await Tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        updateProcessingStatus(`Recognizing text... ${progress}%`);
                    }
                }
            });
            
            await cachedWorker.setParameters({
                tessedit_char_whitelist: '0123456789+-*/=()^.xyzabcXYZABC√∫∑πesincostalogln²³ ',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            });
        }
        
        updateProcessingStatus('Processing image...');
        
        const { data: { text } } = await cachedWorker.recognize(processedImage);
        const cleanedText = cleanOCRText(text);
        
        if (!cleanedText) {
            throw new Error('No math expressions detected in the image');
        }
        
        return cleanedText;
    }

    async function preprocessImage(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const scale = Math.max(1, 1000 / Math.max(img.width, img.height));
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const contrast = 1.5;
                    const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
                    let adjusted = factor * (gray - 128) + 128;
                    adjusted = adjusted > 140 ? 255 : 0;
                    data[i] = data[i + 1] = data[i + 2] = adjusted;
                }
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = imageData;
        });
    }

    function cleanOCRText(text) {
        return text
            .replace(/[oO](?=\d|[\+\-\*\/\=])/g, '0')
            .replace(/(?<=\d)[oO]/g, '0')
            .replace(/[lI](?=[\d\+\-\*\/\=])/g, '1')
            .replace(/(?<=\d)[lI]/g, '1')
            .replace(/[xX×]/g, '*')
            .replace(/[÷]/g, '/')
            .replace(/[−–—]/g, '-')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/\s*=\s*/g, ' = ')
            .replace(/\s*\+\s*/g, ' + ')
            .replace(/\s*-\s*/g, ' - ')
            .replace(/\s*\*\s*/g, ' * ')
            .replace(/\s*\/\s*/g, ' / ')
            .replace(/\s+/g, ' ')
            .replace(/[^\d\w\s\+\-\*\/\=\(\)\^\.\,]/g, '')
            .trim();
    }

    // ==================== DISPLAY FUNCTIONS ====================

    function showProcessing(message) {
        processingSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        updateProcessingStatus(message);
    }

    function updateProcessingStatus(message) {
        processingStatus.textContent = message;
    }

    function hideProcessing() {
        processingSection.classList.add('hidden');
    }

    function displayResults(originalText, solutions) {
        hideProcessing();
        
        detectedText.textContent = originalText;
        solutionsContainer.innerHTML = '';
        
        solutions.forEach(solution => {
            const card = createSolutionCard(solution);
            solutionsContainer.appendChild(card);
        });
        
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function createSolutionCard(solution) {
        const card = document.createElement('div');
        card.className = 'solution-card';
        
        // Header
        const header = document.createElement('div');
        header.className = 'solution-header';
        
        const numberBadge = document.createElement('span');
        numberBadge.className = 'problem-number';
        numberBadge.textContent = solution.number;
        
        const typeBadge = document.createElement('span');
        typeBadge.className = 'problem-type';
        typeBadge.textContent = solution.type;
        
        const originalProblem = document.createElement('span');
        originalProblem.className = 'original-problem';
        originalProblem.textContent = truncate(solution.original, 80);
        
        header.appendChild(numberBadge);
        header.appendChild(typeBadge);
        
        // Add category badge if available
        if (solution.category) {
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'problem-category';
            categoryBadge.textContent = solution.category;
            header.appendChild(categoryBadge);
        }
        
        header.appendChild(originalProblem);
        card.appendChild(header);
        
        // Steps
        if (solution.steps && solution.steps.length > 0) {
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'steps-container';
            
            solution.steps.forEach((step, index) => {
                const stepDiv = document.createElement('div');
                stepDiv.className = 'step';
                
                const stepNumber = document.createElement('span');
                stepNumber.className = 'step-number';
                stepNumber.textContent = index + 1;
                
                const stepContent = document.createElement('div');
                stepContent.className = 'step-content';
                
                const stepDesc = document.createElement('p');
                stepDesc.className = 'step-description';
                stepDesc.textContent = step.description;
                
                const stepMath = document.createElement('div');
                stepMath.className = 'step-math';
                renderMath(stepMath, step.math);
                
                stepContent.appendChild(stepDesc);
                stepContent.appendChild(stepMath);
                stepDiv.appendChild(stepNumber);
                stepDiv.appendChild(stepContent);
                stepsContainer.appendChild(stepDiv);
            });
            
            card.appendChild(stepsContainer);
        }
        
        // Final answer
        if (solution.answer) {
            const answerDiv = document.createElement('div');
            answerDiv.className = 'final-answer';
            
            const answerTitle = document.createElement('h4');
            answerTitle.textContent = '✓ Answer';
            
            const answerContent = document.createElement('div');
            answerContent.className = 'answer';
            renderMath(answerContent, solution.answer);
            
            answerDiv.appendChild(answerTitle);
            answerDiv.appendChild(answerContent);
            card.appendChild(answerDiv);
        }

        // Visualization
        if (solution.visualization) {
            const vizContainer = document.createElement('div');
            vizContainer.className = 'visualization-container';
            
            const vizTitle = document.createElement('h4');
            vizTitle.textContent = 'Visualization';
            vizContainer.appendChild(vizTitle);
            
            const vizContent = document.createElement('div');
            vizContent.className = solution.visualization.type === 'function' ? 'graph-container' : 'diagram-container';
            vizContent.id = `viz-${solution.number}-${Date.now()}`;
            vizContainer.appendChild(vizContent);
            
            card.appendChild(vizContainer);
            
            setTimeout(() => {
                renderVisualization(vizContent, solution.visualization);
            }, 100);
        }
        
        // Error message
        if (solution.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = solution.error;
            card.appendChild(errorDiv);
        }
        
        return card;
    }

    function renderVisualization(container, viz) {
        try {
            switch (viz.type) {
                case 'function':
                    const expr = viz.expression.replace(/y\s*=\s*/i, '').replace(/f\(x\)\s*=\s*/i, '');
                    visualizer.createFunctionGraph(container, expr);
                    break;
                case 'quadratic':
                    visualizer.createQuadraticGraph(container, viz.a, viz.b, viz.c, viz.roots);
                    break;
                case 'circle':
                    visualizer.createCircleDiagram(container, viz.radius);
                    break;
                case 'triangle':
                    visualizer.createTriangleDiagram(container, viz.a, viz.b, viz.c);
                    break;
                case 'rectangle':
                    visualizer.createRectangleDiagram(container, viz.width, viz.height);
                    break;
                case 'derivative':
                    visualizer.createDerivativeGraph(container, viz.original, viz.derivative);
                    break;
                case 'integral':
                    visualizer.createIntegralGraph(container, viz.expression, viz.lower, viz.upper);
                    break;
            }
        } catch (e) {
            console.error('Visualization error:', e);
        }
    }

    function renderMath(element, text) {
        try {
            const latexText = convertToLatex(text);
            katex.render(latexText, element, {
                throwOnError: false,
                displayMode: false
            });
        } catch (e) {
            element.textContent = text;
        }
    }

    function convertToLatex(text) {
        return text
            .replace(/\^(\d+)/g, '^{$1}')
            .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
            .replace(/\*/g, ' \\cdot ')
            .replace(/(\d)([a-zA-Z])/g, '$1$2')
            .replace(/₁/g, '_1')
            .replace(/₂/g, '_2')
            .replace(/±/g, '\\pm')
            .replace(/÷/g, '\\div')
            .replace(/∫/g, '\\int')
            .replace(/∑/g, '\\sum')
            .replace(/π/g, '\\pi')
            .replace(/√/g, '\\sqrt');
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    function formatTimeAgo(date) {
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }
    
    function truncate(str, maxLength) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== INITIALIZATION ====================
    
    // Update firebase status on load
    setTimeout(updateFirebaseStatus, 1000);
    
    console.log('MathVision v2.0.0 loaded');
});
