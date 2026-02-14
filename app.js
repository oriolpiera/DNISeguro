const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const downloadButton = document.getElementById('downloadButton');

let originalImage = null;
let isDrawing = false;
let startX, startY;

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
            downloadButton.style.display = 'block'; // Show the download button
        };
        originalImage.src = event.target.result;
    };
    // Read the uploaded file as a URL
    reader.readAsDataURL(e.target.files[0]);
});

// 2. Handle manual blurring by drawing rectangles
canvas.addEventListener('mousedown', (e) => {
    if (!originalImage) return;
    isDrawing = true;
    // Get starting coordinates relative to the canvas
    startX = e.offsetX;
    startY = e.offsetY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !originalImage) return;
    
    // Redraw the original image to clear previous temporary rectangles
    ctx.drawImage(originalImage, 0, 0);
    
    const currentX = e.offsetX;
    const currentY = e.offsetY;
    const width = currentX - startX;
    const height = currentY - startY;

    // Draw a semi-transparent rectangle to show the user what they are selecting
    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.fillRect(startX, startY, width, height);
});

canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing || !originalImage) return;
    isDrawing = false;

    const endX = e.offsetX;
    const endY = e.offsetY;
    const width = endX - startX;
    const height = endY - startY;

    // Apply the blur effect to the selected area
    applyBlur(startX, startY, width, height);
});

function applyBlur(x, y, width, height) {
    // A simple "pixelation" blur effect
    const pixelSize = 15; // Adjust for more or less blur
    
    // Get the image data for the selected rectangle
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;

    for (let j = 0; j < height; j += pixelSize) {
        for (let i = 0; i < width; i += pixelSize) {
            // Get the color of the top-left pixel in the block
            const pixelIndex = (j * width + i) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];

            // Fill the entire block with that color
            ctx.fillStyle = `rgb(${r}, , )`;
            ctx.fillRect(x + i, y + j, pixelSize, pixelSize);
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
