const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent getImageData calls
const downloadButton = document.getElementById('downloadButton');

let originalImage = null;
let isDrawing = false;

// Store a clean version of the image data to use for the blur effect
let originalImageData = null;

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
            downloadButton.style.display = 'block'; // Show the download button
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
    paint(e); // Allow blurring on a single click or tap
};

const stopDrawing = () => {
    isDrawing = false;
};

const paint = (e) => {
    if (!isDrawing || !originalImage) return;

    // Prevent default behavior like scrolling on touch devices
    e.preventDefault();

    const { x, y } = getCoords(e);
    applyBlur(x, y);
};

// Helper to get coordinates for both mouse and touch events
const getCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        // Touch event
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    // Mouse event
    return { x: e.offsetX, y: e.offsetY };
};

// Add event listeners for both mouse and touch
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing); // Stop if mouse leaves canvas
canvas.addEventListener('mousemove', paint);

canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchmove', paint);

function applyBlur(x, y) {
    const brushSize = 30; // The diameter of the blur brush
    const pixelSize = 10; // The size of the pixelation blocks

    // Center the brush on the cursor/finger
    const startX = Math.floor(x - brushSize / 2);
    const startY = Math.floor(y - brushSize / 2);

    for (let j = 0; j < brushSize; j += pixelSize) {
        for (let i = 0; i < brushSize; i += pixelSize) {
            // Get the color from the original, un-blurred image data
            const pixelIndex = ((startY + j) * canvas.width + (startX + i)) * 4;
            const r = originalImageData.data[pixelIndex];
            const g = originalImageData.data[pixelIndex + 1];
            const b = originalImageData.data[pixelIndex + 2];

            // Fill a block on the canvas with the sampled color
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(startX + i, startY + j, pixelSize, pixelSize);
        }
    }
}

// 3. Download the final image
downloadButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'anonymized-dni.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});
