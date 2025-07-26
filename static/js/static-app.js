// Privacy Shield - Static Version JavaScript
// This script handles the client-side functionality for the Privacy Shield web app


let faceApiLoaded = false;
let detectedFaces = [];
let stats = JSON.parse(localStorage.getItem('privacyShieldStats')) || {
    totalProcessed: 0,
    facesDetected: 0,
    metadataRemoved: 0
};

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const processBtn = document.getElementById('processBtn');

    // Load face-api.js models
    await loadFaceApiModels();

    // Drag and drop functionality
    setupDragAndDrop(uploadArea, fileInput);

    // File input change handler
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Form submission
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        processImage();
    });
}

function setupDragAndDrop(uploadArea, fileInput) {
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect(files[0]);
        }
    });
}

async function loadFaceApiModels() {
    try {
        document.getElementById('processingStatus').textContent = 'Loading AI models...';
        
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        faceApiLoaded = true;
        console.log('Face-api.js models loaded successfully');
    } catch (error) {
        console.error('Error loading face-api.js models:', error);
        // Continue without face detection if models fail to load
    }
}

function handleFileSelect(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 16 * 1024 * 1024; // 16MB

    if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, WEBP)');
        return;
    }

    if (file.size > maxSize) {
        alert('File size must be less than 16MB');
        return;
    }

    // Enable process button
    document.getElementById('processBtn').disabled = false;
    
    // Update upload area to show selected file
    const uploadContent = document.querySelector('.upload-content');
    uploadContent.innerHTML = `
        <i class="fas fa-file-image fs-1 text-success mb-3"></i>
        <h5>${file.name}</h5>
        <p class="text-muted">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
        <button type="button" class="btn btn-outline-secondary" onclick="document.getElementById('fileInput').click()">
            <i class="fas fa-exchange-alt me-2"></i>Change File
        </button>
    `;
}

async function processImage() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select an image first');
        return;
    }

    // Show processing section
    document.getElementById('processingSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';

    try {
        // Load image
        const imageDataUrl = await fileToDataUrl(file);
        const img = await loadImage(imageDataUrl);
        
        // Extract metadata
        const metadata = await extractMetadata(file);
        
        // Detect faces if enabled
        let faces = [];
        if (document.getElementById('blurFaces').checked && faceApiLoaded) {
            document.getElementById('processingStatus').textContent = 'Detecting faces...';
            faces = await detectFaces(img);
        }
        
        // Process image
        document.getElementById('processingStatus').textContent = 'Processing image...';
        const processedImageUrl = await processImageWithOptions(img, faces, {
            removeMetadata: document.getElementById('removeMetadata').checked,
            blurFaces: document.getElementById('blurFaces').checked,
            blurStrength: parseInt(document.getElementById('blurStrength').value)
        });

        // Update stats
        updateStats(faces.length, metadata);

        // Show results
        showResults(imageDataUrl, processedImageUrl, faces, metadata);

    } catch (error) {
        console.error('Error processing image:', error);
        alert('An error occurred while processing the image. Please try again.');
    } finally {
        document.getElementById('processingSection').style.display = 'none';
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function extractMetadata(file) {
    return new Promise((resolve) => {
        try {
            EXIF.getData(file, function() {
                const exifData = EXIF.getAllTags(this);
                const metadata = {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    lastModified: new Date(file.lastModified),
                    exif: exifData
                };
                resolve(metadata);
            });
        } catch (error) {
            console.error('Error extracting metadata:', error);
            resolve({
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                lastModified: new Date(file.lastModified),
                exif: {}
            });
        }
    });
}

async function detectFaces(img) {
    if (!faceApiLoaded) return [];
    
    try {
        const detections = await faceapi.detectAllFaces(img);
        return detections.map(detection => ({
            x: detection.box.x,
            y: detection.box.y,
            width: detection.box.width,
            height: detection.box.height,
            confidence: detection.score
        }));
    } catch (error) {
        console.error('Error detecting faces:', error);
        return [];
    }
}

async function processImageWithOptions(img, faces, options) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw original image
    ctx.drawImage(img, 0, 0);
    
    // Blur faces if enabled
    if (options.blurFaces && faces.length > 0) {
        for (const face of faces) {
            blurFaceRegion(ctx, face, options.blurStrength);
        }
    }
    
    // Convert to blob (this removes metadata automatically)
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            resolve(url);
        }, 'image/jpeg', 0.9);
    });
}

function blurFaceRegion(ctx, face, blurStrength) {
    const imageData = ctx.getImageData(face.x, face.y, face.width, face.height);
    const blurredData = applyGaussianBlur(imageData, blurStrength / 5);
    ctx.putImageData(blurredData, face.x, face.y);
}

function applyGaussianBlur(imageData, radius) {
    // Simple box blur approximation of Gaussian blur
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const copy = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            let count = 0;
            
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        const idx = (ny * width + nx) * 4;
                        r += copy[idx];
                        g += copy[idx + 1];
                        b += copy[idx + 2];
                        a += copy[idx + 3];
                        count++;
                    }
                }
            }
            
            const idx = (y * width + x) * 4;
            data[idx] = r / count;
            data[idx + 1] = g / count;
            data[idx + 2] = b / count;
            data[idx + 3] = a / count;
        }
    }
    
    return imageData;
}

function updateStats(facesDetected, metadata) {
    stats.totalProcessed++;
    stats.facesDetected += facesDetected;
    if (Object.keys(metadata.exif).length > 0) {
        stats.metadataRemoved++;
    }
    localStorage.setItem('privacyShieldStats', JSON.stringify(stats));
}

function showResults(originalUrl, processedUrl, faces, metadata) {
    // Show original image
    const originalImg = document.getElementById('originalImage');
    originalImg.src = originalUrl;
    
    // Show processed image
    const processedImg = document.getElementById('processedImage');
    processedImg.src = processedUrl;
    
    // Update processing summary
    const summary = document.getElementById('processSummary');
    summary.innerHTML = `
        <strong>Processing Complete!</strong><br>
        • ${faces.length} face(s) detected and protected<br>
        • ${Object.keys(metadata.exif).length} metadata fields removed<br>
        • Image processed locally in your browser
    `;
    
    // Show face detection info
    const faceInfo = document.getElementById('faceDetectionInfo');
    if (faces.length > 0) {
        faceInfo.innerHTML = `
            <div class="alert alert-info">
                <small><i class="fas fa-user-friends me-1"></i>
                Detected ${faces.length} face(s) with confidence scores: 
                ${faces.map(f => (f.confidence * 100).toFixed(1) + '%').join(', ')}
                </small>
            </div>
        `;
        
        // Draw face detection boxes
        drawFaceBoxes(originalImg, faces);
    } else {
        faceInfo.innerHTML = '<small class="text-muted">No faces detected</small>';
    }
    
    // Show metadata info
    showMetadataInfo(metadata);
    
    // Show processing stats
    showProcessingStats(faces.length);
    
    // Setup download button
    setupDownloadButton(processedUrl, metadata.fileName);
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

function drawFaceBoxes(img, faces) {
    img.onload = function() {
        const canvas = document.getElementById('faceDetectionCanvas');
        const rect = img.getBoundingClientRect();
        
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        const ctx = canvas.getContext('2d');
        const scaleX = rect.width / img.naturalWidth;
        const scaleY = rect.height / img.naturalHeight;
        
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        
        faces.forEach(face => {
            ctx.strokeRect(
                face.x * scaleX,
                face.y * scaleY,
                face.width * scaleX,
                face.height * scaleY
            );
        });
    };
}

function showMetadataInfo(metadata) {
    const metadataDiv = document.getElementById('metadataInfo');
    const exifKeys = Object.keys(metadata.exif);
    
    if (exifKeys.length === 0) {
        metadataDiv.innerHTML = '<small class="text-muted">No EXIF metadata found</small>';
        return;
    }
    
    let html = '<div class="small">';
    const importantFields = ['Make', 'Model', 'DateTime', 'GPS', 'Software'];
    
    exifKeys.slice(0, 10).forEach(key => {
        const value = metadata.exif[key];
        const isImportant = importantFields.some(field => key.includes(field));
        html += `<div class="${isImportant ? 'text-warning' : ''}">
            <strong>${key}:</strong> ${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}
        </div>`;
    });
    
    if (exifKeys.length > 10) {
        html += `<div class="text-muted">... and ${exifKeys.length - 10} more fields</div>`;
    }
    html += '</div>';
    
    metadataDiv.innerHTML = html;
}

function showProcessingStats(facesDetected) {
    const statsDiv = document.getElementById('processStats');
    statsDiv.innerHTML = `
        <div class="small">
            <div><strong>This Session:</strong> ${facesDetected} faces protected</div>
            <div><strong>Total Processed:</strong> ${stats.totalProcessed} images</div>
            <div><strong>Total Faces Protected:</strong> ${stats.facesDetected}</div>
            <div><strong>Metadata Stripped:</strong> ${stats.metadataRemoved} images</div>
        </div>
    `;
}

function setupDownloadButton(processedUrl, originalFileName) {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.onclick = function() {
        const link = document.createElement('a');
        link.href = processedUrl;
        link.download = 'protected_' + originalFileName;
        link.click();
    };
}

function showStats() {
    alert(`Privacy Shield Statistics:
    
Total Images Processed: ${stats.totalProcessed}
Total Faces Protected: ${stats.facesDetected}
Images with Metadata Removed: ${stats.metadataRemoved}

Note: Statistics are stored locally in your browser.`);
}

// CSS for drag and drop styling
const style = document.createElement('style');
style.textContent = `
    .upload-area {
        border: 2px dashed #6c757d;
        border-radius: 8px;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .upload-area:hover,
    .upload-area.dragover {
        border-color: #0d6efd;
        background-color: rgba(13, 110, 253, 0.1);
    }
    
    .image-container {
        position: relative;
        display: inline-block;
    }
    
    #faceDetectionCanvas {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }
`;
document.head.appendChild(style);
