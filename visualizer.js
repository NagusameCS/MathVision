/**
 * MathVision - Visualizer Module
 * Creates graphs, diagrams, and visual representations
 */

class MathVisualizer {
    constructor() {
        this.plotlyConfig = {
            displayModeBar: false,
            responsive: true
        };
        
        this.plotlyLayout = {
            paper_bgcolor: '#111111',
            plot_bgcolor: '#1a1a1a',
            font: { color: '#888888', family: 'Inter, sans-serif' },
            xaxis: {
                gridcolor: '#2a2a2a',
                zerolinecolor: '#444444',
                tickfont: { color: '#666666' }
            },
            yaxis: {
                gridcolor: '#2a2a2a',
                zerolinecolor: '#444444',
                tickfont: { color: '#666666' }
            },
            margin: { t: 20, r: 20, b: 40, l: 40 },
            showlegend: false
        };
    }

    /**
     * Create a function graph
     */
    createFunctionGraph(container, expression, options = {}) {
        const {
            xMin = -10,
            xMax = 10,
            points = 200,
            title = ''
        } = options;

        // Generate x values
        const xValues = [];
        const yValues = [];
        const step = (xMax - xMin) / points;

        // Parse the expression
        let func;
        try {
            const cleanExpr = expression
                .replace(/y\s*=\s*/i, '')
                .replace(/f\(x\)\s*=\s*/i, '');
            func = math.compile(cleanExpr);
        } catch (e) {
            console.error('Could not parse function:', e);
            return;
        }

        for (let x = xMin; x <= xMax; x += step) {
            try {
                const y = func.evaluate({ x: x });
                if (isFinite(y) && Math.abs(y) < 1000) {
                    xValues.push(x);
                    yValues.push(y);
                }
            } catch (e) {
                // Skip undefined points
            }
        }

        const trace = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ffffff', width: 2 }
        };

        const layout = {
            ...this.plotlyLayout,
            title: title ? { text: title, font: { color: '#888888', size: 14 } } : undefined
        };

        Plotly.newPlot(container, [trace], layout, this.plotlyConfig);
    }

    /**
     * Create quadratic visualization with roots
     */
    createQuadraticGraph(container, a, b, c, roots) {
        const xValues = [];
        const yValues = [];
        
        // Determine range based on roots
        let xMin = -10, xMax = 10;
        if (roots && roots.length > 0) {
            const realRoots = roots.filter(r => typeof r === 'number');
            if (realRoots.length > 0) {
                const minRoot = Math.min(...realRoots);
                const maxRoot = Math.max(...realRoots);
                const padding = Math.max(2, (maxRoot - minRoot) * 0.5);
                xMin = minRoot - padding;
                xMax = maxRoot + padding;
            }
        }

        // Vertex
        const vertexX = -b / (2 * a);
        const vertexY = a * vertexX * vertexX + b * vertexX + c;

        // Generate curve
        const step = (xMax - xMin) / 200;
        for (let x = xMin; x <= xMax; x += step) {
            xValues.push(x);
            yValues.push(a * x * x + b * x + c);
        }

        const traces = [{
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ffffff', width: 2 },
            name: 'f(x)'
        }];

        // Add roots as points
        if (roots && roots.length > 0) {
            const rootX = [];
            const rootY = [];
            roots.forEach(r => {
                if (typeof r === 'number') {
                    rootX.push(r);
                    rootY.push(0);
                }
            });
            if (rootX.length > 0) {
                traces.push({
                    x: rootX,
                    y: rootY,
                    type: 'scatter',
                    mode: 'markers',
                    marker: { color: '#4ade80', size: 10 },
                    name: 'Roots'
                });
            }
        }

        // Add vertex
        traces.push({
            x: [vertexX],
            y: [vertexY],
            type: 'scatter',
            mode: 'markers',
            marker: { color: '#888888', size: 8, symbol: 'diamond' },
            name: 'Vertex'
        });

        Plotly.newPlot(container, traces, this.plotlyLayout, this.plotlyConfig);
    }

    /**
     * Create a number line visualization
     */
    createNumberLine(container, points, options = {}) {
        const { min = -10, max = 10 } = options;
        
        container.innerHTML = '';
        container.className = 'number-line';
        
        // Create axis
        const axis = document.createElement('div');
        axis.className = 'number-line-axis';
        container.appendChild(axis);
        
        // Add tick marks
        for (let i = Math.ceil(min); i <= Math.floor(max); i++) {
            const tick = document.createElement('div');
            tick.style.cssText = `
                position: absolute;
                top: 50%;
                left: ${((i - min) / (max - min)) * 100}%;
                transform: translate(-50%, -50%);
                width: 1px;
                height: 10px;
                background: #444;
            `;
            container.appendChild(tick);
            
            const label = document.createElement('div');
            label.className = 'number-line-label';
            label.style.left = `${((i - min) / (max - min)) * 100}%`;
            label.textContent = i;
            container.appendChild(label);
        }
        
        // Add points
        points.forEach(point => {
            if (typeof point.value === 'number' && point.value >= min && point.value <= max) {
                const dot = document.createElement('div');
                dot.className = 'number-line-point';
                dot.style.left = `${((point.value - min) / (max - min)) * 100}%`;
                dot.title = point.label || point.value;
                container.appendChild(dot);
            }
        });
    }

    /**
     * Create derivative visualization
     */
    createDerivativeGraph(container, originalExpr, derivativeExpr) {
        const xValues = [];
        const yOriginal = [];
        const yDerivative = [];
        
        let funcOriginal, funcDerivative;
        try {
            funcOriginal = math.compile(originalExpr.replace(/f\(x\)\s*=\s*/i, ''));
            funcDerivative = math.compile(derivativeExpr);
        } catch (e) {
            console.error('Could not compile functions');
            return;
        }

        for (let x = -5; x <= 5; x += 0.05) {
            try {
                const y1 = funcOriginal.evaluate({ x });
                const y2 = funcDerivative.evaluate({ x });
                if (isFinite(y1) && isFinite(y2)) {
                    xValues.push(x);
                    yOriginal.push(y1);
                    yDerivative.push(y2);
                }
            } catch (e) {}
        }

        const traces = [
            {
                x: xValues,
                y: yOriginal,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#ffffff', width: 2 },
                name: 'f(x)'
            },
            {
                x: xValues,
                y: yDerivative,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#666666', width: 2, dash: 'dash' },
                name: "f'(x)"
            }
        ];

        const layout = {
            ...this.plotlyLayout,
            showlegend: true,
            legend: { 
                x: 0.02, 
                y: 0.98,
                bgcolor: 'transparent',
                font: { color: '#888888' }
            }
        };

        Plotly.newPlot(container, traces, layout, this.plotlyConfig);
    }

    /**
     * Create integral visualization with area
     */
    createIntegralGraph(container, expression, lowerBound, upperBound) {
        const xValues = [];
        const yValues = [];
        const xFill = [];
        const yFill = [];
        
        let func;
        try {
            func = math.compile(expression);
        } catch (e) {
            return;
        }

        // Full curve
        for (let x = -5; x <= 5; x += 0.05) {
            try {
                const y = func.evaluate({ x });
                if (isFinite(y)) {
                    xValues.push(x);
                    yValues.push(y);
                }
            } catch (e) {}
        }

        // Area under curve
        if (lowerBound !== undefined && upperBound !== undefined) {
            for (let x = lowerBound; x <= upperBound; x += 0.05) {
                try {
                    const y = func.evaluate({ x });
                    if (isFinite(y)) {
                        xFill.push(x);
                        yFill.push(y);
                    }
                } catch (e) {}
            }
        }

        const traces = [
            {
                x: xValues,
                y: yValues,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#ffffff', width: 2 }
            }
        ];

        if (xFill.length > 0) {
            traces.unshift({
                x: [...xFill, ...xFill.slice().reverse()],
                y: [...yFill, ...Array(yFill.length).fill(0)],
                type: 'scatter',
                fill: 'toself',
                fillcolor: 'rgba(255, 255, 255, 0.1)',
                line: { color: 'transparent' }
            });
        }

        Plotly.newPlot(container, traces, this.plotlyLayout, this.plotlyConfig);
    }

    /**
     * Create geometry diagram - Circle
     */
    createCircleDiagram(container, radius) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '200');

        // Circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '100');
        circle.setAttribute('cy', '100');
        circle.setAttribute('r', '80');
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('fill', 'none');
        svg.appendChild(circle);

        // Radius line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '100');
        line.setAttribute('y1', '100');
        line.setAttribute('x2', '180');
        line.setAttribute('y2', '100');
        line.setAttribute('stroke', '#666666');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4');
        svg.appendChild(line);

        // Center point
        const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        center.setAttribute('cx', '100');
        center.setAttribute('cy', '100');
        center.setAttribute('r', '3');
        center.setAttribute('fill', '#ffffff');
        svg.appendChild(center);

        // Radius label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '140');
        text.setAttribute('y', '95');
        text.setAttribute('fill', '#888888');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'Inter, sans-serif');
        text.textContent = `r = ${radius}`;
        svg.appendChild(text);

        container.innerHTML = '';
        container.appendChild(svg);
    }

    /**
     * Create geometry diagram - Triangle
     */
    createTriangleDiagram(container, a, b, c) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 250 200');
        svg.setAttribute('width', '250');
        svg.setAttribute('height', '200');

        // Simple scalene triangle
        const scale = 15;
        const points = `50,150 ${50 + b * scale},150 ${50 + (b * scale) / 2},${150 - a * scale * 0.8}`;

        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        triangle.setAttribute('points', points);
        triangle.setAttribute('stroke', '#ffffff');
        triangle.setAttribute('stroke-width', '2');
        triangle.setAttribute('fill', 'none');
        svg.appendChild(triangle);

        // Labels
        const addLabel = (x, y, text) => {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', y);
            label.setAttribute('fill', '#888888');
            label.setAttribute('font-size', '12');
            label.setAttribute('font-family', 'Inter, sans-serif');
            label.setAttribute('text-anchor', 'middle');
            label.textContent = text;
            svg.appendChild(label);
        };

        addLabel(50 + (b * scale) / 2, 170, `b = ${b}`);
        addLabel(30, 100, `a = ${a}`);
        addLabel(50 + b * scale + 20, 100, `c = ${c}`);

        container.innerHTML = '';
        container.appendChild(svg);
    }

    /**
     * Create geometry diagram - Rectangle
     */
    createRectangleDiagram(container, width, height) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 250 180');
        svg.setAttribute('width', '250');
        svg.setAttribute('height', '180');

        const scale = Math.min(180 / height, 200 / width) * 0.6;
        const w = width * scale;
        const h = height * scale;
        const x = (250 - w) / 2;
        const y = (180 - h) / 2;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('fill', 'none');
        svg.appendChild(rect);

        // Width label
        const widthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        widthLabel.setAttribute('x', x + w / 2);
        widthLabel.setAttribute('y', y + h + 20);
        widthLabel.setAttribute('fill', '#888888');
        widthLabel.setAttribute('font-size', '12');
        widthLabel.setAttribute('text-anchor', 'middle');
        widthLabel.textContent = `w = ${width}`;
        svg.appendChild(widthLabel);

        // Height label
        const heightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        heightLabel.setAttribute('x', x + w + 15);
        heightLabel.setAttribute('y', y + h / 2);
        heightLabel.setAttribute('fill', '#888888');
        heightLabel.setAttribute('font-size', '12');
        heightLabel.setAttribute('text-anchor', 'start');
        heightLabel.textContent = `h = ${height}`;
        svg.appendChild(heightLabel);

        container.innerHTML = '';
        container.appendChild(svg);
    }

    /**
     * Create a pie chart for fractions
     */
    createFractionPie(container, numerator, denominator) {
        const values = [numerator, denominator - numerator];
        const colors = ['#ffffff', '#2a2a2a'];

        const trace = {
            values: values,
            type: 'pie',
            hole: 0,
            marker: { colors: colors, line: { color: '#1a1a1a', width: 2 } },
            textinfo: 'none',
            hoverinfo: 'none'
        };

        const layout = {
            ...this.plotlyLayout,
            showlegend: false,
            margin: { t: 10, r: 10, b: 10, l: 10 }
        };

        Plotly.newPlot(container, [trace], layout, this.plotlyConfig);
    }

    /**
     * Create slope visualization
     */
    createSlopeGraph(container, m, b) {
        const xValues = [];
        const yValues = [];

        for (let x = -10; x <= 10; x += 0.1) {
            xValues.push(x);
            yValues.push(m * x + b);
        }

        // Add rise/run triangle
        const traces = [
            {
                x: xValues,
                y: yValues,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#ffffff', width: 2 }
            },
            // Rise/run visualization
            {
                x: [0, 1, 1, 0],
                y: [b, b, b + m, b],
                type: 'scatter',
                mode: 'lines',
                line: { color: '#666666', width: 1, dash: 'dash' }
            }
        ];

        Plotly.newPlot(container, traces, this.plotlyLayout, this.plotlyConfig);
    }
}

// Export
window.MathVisualizer = MathVisualizer;
