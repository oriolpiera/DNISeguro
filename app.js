const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const langSwitcher = document.getElementById('lang-switcher');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent getImageData calls
const undoButton = document.getElementById('undoButton');
const addTextButton = document.getElementById('addTextButton');
const textControls = document.getElementById('text-controls');
const grayscaleButton = document.getElementById('grayscaleButton');
const downloadButton = document.getElementById('downloadButton');

let originalImage = null;
let isDrawing = false;
let lastPoint = null;
let selectedObject = null;
let isDragging = false;
let dragOffsetX, dragOffsetY;

// Store a clean version of the image data to use for the blur effect
let originalImageData = null;
// Store canvas states for the undo functionality
let history = [];
// Store current language translations
let translations = {};

/**
 * Renders the entire canvas.
 * It draws the original image and then iterates through the history
 * to draw every redaction and text object.
 */
function render() {
    if (!originalImage) return;
    ctx.drawImage(originalImage, 0, 0);
    history.forEach(obj => {
        drawObject(obj);
        // If the object is selected, draw a selection box around it
        if (obj === selectedObject) drawSelectionBox(obj);
    });
}

// 1. Load the image onto the canvas
imageLoader.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            // Set canvas dimensions to match the image
            canvas.width = originalImage.width;
            canvas.height = originalImage.height;
            // Draw the image on the canvas
            ctx.drawImage(originalImage, 0, 0);

            addTextButton.style.display = 'block';
            grayscaleButton.style.display = 'block';
            downloadButton.style.display = 'block'; // Show the download button

            // Reset history for the new image
            history = [];
            undoButton.style.display = 'none';
        };
        originalImage.src = event.target.result;
    };
    // Read the uploaded file as a URL
    if (e.target.files[0]) {
        reader.readAsDataURL(e.target.files[0]);
    }
});

function handleCanvasMouseDown(e) {
    if (!originalImage) return;
    e.preventDefault();

    const { x, y } = getCoords(e);

    // Check if we are clicking on an existing text object
    const clickedObject = findClickedTextObject(x, y);

    if (clickedObject) {
        // We clicked an object, enter dragging mode
        selectedObject = clickedObject;
        isDragging = true;
        isDrawing = false; // Ensure we are not in drawing mode
        dragOffsetX = x - selectedObject.x;
        dragOffsetY = y - selectedObject.y;
        textControls.style.display = 'flex';
        document.getElementById('fontSize').value = selectedObject.size;
        render();
    } else {
        // We clicked on the background, start a new redaction stroke
        deselectAll();
        isDrawing = true;
        isDragging = false;
        lastPoint = { x, y };

        const redactionStroke = {
            type: 'redaction',
            points: [{ x, y }]
        };
        history.push(redactionStroke);
        render();
    }
}

function deselectAll() {
    selectedObject = null;
    textControls.style.display = 'none';
    render();
}

const handleCanvasMouseUp = () => {
    if (isDrawing) {
        // Finished a redaction stroke
        undoButton.style.display = 'inline-block';
    }
    if (isDragging) {
        // Finished dragging an object
        // The object position is already updated, just re-render to be safe
        render();
    }
    isDrawing = false;
    isDragging = false;
    lastPoint = null; // Reset the last point

    // The redaction object was already added on startDrawing and paint
    ctx.beginPath();
};

const paint = (e) => {
    if (!originalImage) return;

    if (isDragging && selectedObject) {
        e.preventDefault();
        const { x, y } = getCoords(e);
        selectedObject.x = x - dragOffsetX;
        selectedObject.y = y - dragOffsetY;
        render();
        return;
    }

    if (!isDrawing) return;

    // Prevent default behavior like scrolling on touch devices
    e.preventDefault();

    if (!lastPoint) return;

    // Get the current redaction stroke object
    const currentStroke = history[history.length - 1];

    const currentPoint = getCoords(e);

    // Calculate the distance and angle between the last point and the current point
    const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
    const angle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);

    const brushSize = 25; // Must match the brush size in applyRedaction

    // Draw a line of redaction marks to fill the gap
    for (let i = 0; i < dist; i += brushSize / 4) { // Step by a fraction of the brush size
        const x = lastPoint.x + (Math.cos(angle) * i);
        const y = lastPoint.y + (Math.sin(angle) * i);
        currentStroke.points.push({ x, y });
    }
    render();

    // Update the last point for the next move event
    lastPoint = currentPoint;
};

// Helper to get coordinates for both mouse and touch events
const getCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (e.touches) {
        // Touch event
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        // Mouse event
        x = e.offsetX;
        y = e.offsetY;
    }

    // Scale coordinates to match canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return { x: x * scaleX, y: y * scaleY };
};

// Add event listeners for both mouse and touch
canvas.addEventListener('mousedown', handleCanvasMouseDown);
canvas.addEventListener('mouseup', handleCanvasMouseUp);
canvas.addEventListener('mouseout', handleCanvasMouseUp); // Stop if mouse leaves canvas
canvas.addEventListener('mousemove', paint);

canvas.addEventListener('touchstart', handleCanvasMouseDown);
canvas.addEventListener('touchend', handleCanvasMouseUp);
canvas.addEventListener('touchmove', paint);

function drawObject(obj) {
    if (obj.type === 'redaction') {
        obj.points.forEach(point => applyRedaction(point.x, point.y));
    } else if (obj.type === 'text') {
        drawText(obj);
    } else if (obj.type === 'filter' && obj.filter === 'grayscale') {
        applyGrayscaleFilter();
    }
}

function drawSelectionBox(obj) {
    if (obj.type !== 'text') return;

    ctx.font = `bold ${obj.size}px sans-serif`; // Ensure context is set for measurement
    const textMetrics = ctx.measureText(obj.content);
    const textWidth = textMetrics.width;
    const textHeight = obj.size; // Approximate height

    ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.strokeRect(obj.x - 5, obj.y - textHeight, textWidth + 10, textHeight + 10);
    ctx.setLineDash([]); // Reset to solid line
}

function applyRedaction(x, y) {
    const brushSize = 25; // The diameter of the redaction brush

    // Center the brush on the cursor/finger
    const startX = Math.floor(x - brushSize / 2);
    const startY = Math.floor(y - brushSize / 2);

    // --- New "Elegant" Redaction Effect ---

    // 1. Set up a subtle inner shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;

    // 2. Set the fill style to a dark gray
    ctx.fillStyle = '#333333';

    // 3. Draw the redaction rectangle
    ctx.fillRect(startX, startY, brushSize, brushSize);

    // 4. Reset shadow properties to avoid affecting other drawings
    ctx.shadowBlur = 0;
}

function undoLast() {
    if (history.length > 0) {
        history.pop(); // Remove the last object
        render(); // Re-render the canvas
    }

    // If history is now empty, hide the undo button
    if (history.length === 0) {
        // Also re-render to ensure the base image is shown if all filters are gone
        undoButton.style.display = 'none';
    }
}

undoButton.addEventListener('click', undoLast);

function convertToGrayscale() {
    if (!originalImage) return;

    // Add a filter object to the history
    history.push({ type: 'filter', filter: 'grayscale' });
    render();
    undoButton.style.display = 'inline-block';
}

function applyGrayscaleFilter() {
    if (!originalImage) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Use the luminosity formula for a more accurate grayscale conversion
        const luminosity = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = luminosity;     // Red
        data[i + 1] = luminosity; // Green
        data[i + 2] = luminosity; // Blue
    }

    // Put the modified image data back onto the canvas
    ctx.putImageData(imageData, 0, 0);
}

grayscaleButton.addEventListener('click', convertToGrayscale);

const addText = () => {
    if (!originalImage) return;

    const text = prompt(translations.addTextPrompt || "Enter the text to add:");
    if (!text) return; // User cancelled or entered no text

    // Show text controls and enter text mode
    textControls.style.display = 'flex';
    canvas.style.cursor = 'text';

    const textObject = {
        type: 'text',
        content: text,
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: document.getElementById('fontSize').value
    };

    const previewText = (e) => {
        e.preventDefault();

        const { x, y } = getCoords(e);
        textObject.x = x;
        textObject.y = y;
        textObject.size = document.getElementById('fontSize').value;

        drawText(textObject);

        render(); // Re-render the canvas to clear the last preview
        drawText(textObject); // Draw the new preview on top
    };

    const placeText = (e) => {
        e.preventDefault();

        // Clean up event listeners
        cleanupTextEventListeners();

        // Hide controls and reset cursor
        textControls.style.display = 'none';
        canvas.style.cursor = 'crosshair';

        // Add the final text object to history and re-render
        history.push(textObject);
        render();
        deselectAll();
        undoButton.style.display = 'inline-block';
    };

    const cleanupTextEventListeners = () => {
        canvas.removeEventListener('mousemove', previewText);
        canvas.removeEventListener('touchmove', previewText);
        canvas.removeEventListener('click', placeText);
    };

    // Add listeners for previewing and placing
    canvas.addEventListener('mousemove', previewText);
    canvas.addEventListener('touchmove', previewText);
    canvas.addEventListener('click', placeText, { once: true });
};

function drawText(textObj) {
    ctx.font = `bold ${textObj.size}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = textObj.size / 10;
    ctx.strokeText(textObj.content, textObj.x, textObj.y);
    ctx.fillText(textObj.content, textObj.x, textObj.y);
}

addTextButton.addEventListener('click', addText);

function findClickedTextObject(x, y) {
    // Find if a text object was clicked (in reverse order to get the top one)
    return [...history].reverse().find(obj => {
        if (obj.type !== 'text') return false;

        // Simple bounding box collision detection
        ctx.font = `bold ${obj.size}px sans-serif`; // Must set font to measure correctly
        const textWidth = ctx.measureText(obj.content).width;
        return x >= obj.x && x <= obj.x + textWidth && y >= obj.y - obj.size && y <= obj.y;
    });
}

canvas.addEventListener('dblclick', (e) => {
    const { x, y } = getCoords(e);
    const clickedTextObject = findClickedTextObject(x, y);

    if (clickedTextObject) {
        const newText = prompt(translations.editTextPrompt || "Edit the text:", clickedTextObject.content);
        if (newText) {
            clickedTextObject.content = newText;
            render();
        }
    }
});

document.getElementById('fontSize').addEventListener('input', (e) => {
    if (selectedObject && selectedObject.type === 'text') {
        selectedObject.size = e.target.value;
        render();
    }
});

// 3. Download the final image
downloadButton.addEventListener('click', () => {
    const downloadFilename = translations.downloadFilename || 'anonymized-dni.png';
    const link = document.createElement('a');
    link.download = downloadFilename;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// 4. I18n (Internationalization) Logic

const i18n = {
    async setLanguage(lang) {
        // Fetch the translation file
        const cacheBust = `?v=${new Date().getTime()}`;
        const response = await fetch(`locales/${lang}.json${cacheBust}`);
        translations = await response.json();

        // Update all elements with a data-i18n-key
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.getAttribute('data-i18n-key');
            if (translations[key]) {
                // Use innerHTML to support the <strong> tag in the description
                el.innerHTML = translations[key];
            }
        });

        // Save language preference
        localStorage.setItem('language', lang);
    },

    initialize() {
        // Get saved language or detect browser language, default to 'en'
        const initialLang = localStorage.getItem('language') || navigator.language.split('-')[0] || 'en';
        // Support 'es' and 'en', otherwise default to 'en'
        const langToSet = ['en', 'es', 'ca'].includes(initialLang) ? initialLang : 'en';
        this.setLanguage(langToSet);
    }
};

langSwitcher.addEventListener('click', (e) => {
    const lang = e.target.dataset.lang;
    if (lang) {
        i18n.setLanguage(lang);
    }
});

// Initialize translations when the script loads
i18n.initialize();
