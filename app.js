const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const langSwitcher = document.getElementById('lang-switcher');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent getImageData calls
const undoButton = document.getElementById('undoButton');
const grayscaleButton = document.getElementById('grayscaleButton');
const downloadButton = document.getElementById('downloadButton');

let originalImage = null;
let isDrawing = false;
let lastPoint = null;

// Store a clean version of the image data to use for the blur effect
let originalImageData = null;
// Store canvas states for the undo functionality
let history = [];
// Store current language translations
let translations = {};

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
            // Store the raw image data for our blurring function
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

// 2. Unify event handling for mouse and touch
const startDrawing = (e) => {
    if (!originalImage) return;

    isDrawing = true;
    // Get the starting point, but don't draw a line yet
    lastPoint = getCoords(e);

    // Apply a single dab for a click/tap without movement
    applyRedaction(lastPoint.x, lastPoint.y);
};

const stopDrawing = () => {
    if (!isDrawing) return; // Don't save state if we weren't drawing
    isDrawing = false;
    lastPoint = null; // Reset the last point

    // Save the state *after* the drawing stroke is complete
    saveState();

    // Ensure the drawing buffer is flushed to the canvas if needed by the browser
    // (though not strictly necessary with our current implementation)
    ctx.beginPath();
};

const paint = (e) => {
    if (!isDrawing || !originalImage) return;

    // Prevent default behavior like scrolling on touch devices
    e.preventDefault();

    if (!lastPoint) return;

    const currentPoint = getCoords(e);

    // Calculate the distance and angle between the last point and the current point
    const dist = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
    const angle = Math.atan2(currentPoint.y - lastPoint.y, currentPoint.x - lastPoint.x);

    const brushSize = 25; // Must match the brush size in applyRedaction

    // Draw a line of redaction marks to fill the gap
    for (let i = 0; i < dist; i += brushSize / 4) { // Step by a fraction of the brush size
        const x = lastPoint.x + (Math.cos(angle) * i);
        const y = lastPoint.y + (Math.sin(angle) * i);
        applyRedaction(x, y);
    }

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
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing); // Stop if mouse leaves canvas
canvas.addEventListener('mousemove', paint);

canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchmove', paint);

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

function saveState() {
    // Save the current canvas content to our history stack
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    undoButton.style.display = 'inline-block'; // Show the undo button
}

function undoLast() {
    if (history.length > 0) {
        // Remove the last state from history and restore it to the canvas
        const lastState = history.pop();
        ctx.putImageData(lastState, 0, 0);
    }

    // If history is now empty, hide the undo button
    if (history.length === 0) {
        undoButton.style.display = 'none';
    }
}

undoButton.addEventListener('click', undoLast);

function convertToGrayscale() {
    if (!originalImage) return;

    // Save state before applying the filter, so it can be undone
    saveState();

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
