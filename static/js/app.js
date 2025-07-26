// Privacy Shield JavaScript
let faceApiLoaded = false;
let detectedFaces = [];

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const processBtn = document.getElementById('processBtn');
    const processingSection = document.getElementById('processingSection');
    const resultsSection = document.getElementById('resultsSection');

    // Drag and drop functionality
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

    // File input change handler
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Handle file selection
    function handleFileSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 16 * 1024 * 1024; // 16MB

        // Validate file type
        if (!allowedTypes.includes(file.type)) {
            showAlert('Please select a valid image file (JPG, PNG, or WEBP)', 'danger');
            resetFileInput();
            return;
        }

        // Validate file size
        if (file.size > maxSize) {
            showAlert('File size must be less than 16MB', 'danger');
            resetFileInput();
            return;
        }

        // Update UI to show selected file
        updateUploadArea(file);
        processBtn.disabled = false;
    }

    // Update upload area with file info
    function updateUploadArea(file) {
        const uploadContent = uploadArea.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-file-image fs-1 text-success mb-2"></i>
                <h5 class="text-success">File Selected</h5>
                <p class="mb-2"><strong>${file.name}</strong></p>
                <p class="text-muted">Size: ${formatFileSize(file.size)}</p>
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="resetUpload()">
                    <i class="fas fa-times me-1"></i>Choose Different File
                </button>
            </div>
        `;
        uploadArea.classList.add('upload-success');
    }

    // Reset upload area
    window.resetUpload = function() {
        resetFileInput();
        const uploadContent = uploadArea.querySelector('.upload-content');
        uploadContent.innerHTML = `
            <i class="fas fa-cloud-upload-alt fs-1 text-muted mb-3"></i>
            <h4>Drag & Drop or Click to Upload</h4>
            <p class="text-muted">Supports: JPG, PNG, WEBP (Max 16MB)</p>
            <button type="button" class="btn btn-outline-primary" onclick="document.getElementById('fileInput').click()">
                <i class="fas fa-folder-open me-2"></i>Choose File
            </button>
        `;
        uploadArea.classList.remove('upload-success', 'upload-error');
        processBtn.disabled = true;
    };

    // Reset file input
    function resetFileInput() {
        fileInput.value = '';
    }

    // Form submission handler
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!fileInput.files[0]) {
            showAlert('Please select a file first', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('remove_metadata', document.getElementById('removeMetadata').checked);
        formData.append('blur_faces', document.getElementById('blurFaces').checked);
        formData.append('blur_strength', document.getElementById('blurStrength').value);
        
        // Get selected detection method
        const detectionMethod = document.querySelector('input[name="detectionMethod"]:checked').value;
        formData.append('detection_method', detectionMethod);
        
        // If we have detected faces, send their coordinates
        if (detectedFaces.length > 0) {
            const img = document.getElementById('uploadedImage');
            if (img) {
                const faceCoordinates = detectedFaces.map(detection => ({
                    x: Math.round(detection.detection.box.x),
                    y: Math.round(detection.detection.box.y),
                    width: Math.round(detection.detection.box.width),
                    height: Math.round(detection.detection.box.height),
                    // Include image dimensions for coordinate validation
                    image_width: img.naturalWidth || img.width,
                    image_height: img.naturalHeight || img.height,
                    display_width: img.width,
                    display_height: img.height
                }));
                formData.append('face_coordinates', JSON.stringify(faceCoordinates));
                console.log('Sending face coordinates:', faceCoordinates);
            } else {
                formData.append('face_coordinates', '[]');
            }
        } else {
            formData.append('face_coordinates', '[]');
        }

        // Show processing section
        processingSection.style.display = 'block';
        resultsSection.style.display = 'none';
        processBtn.disabled = true;

        // Scroll to processing section
        processingSection.scrollIntoView({ behavior: 'smooth' });

        // Submit form
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            processingSection.style.display = 'none';
            
            if (data.success) {
                displayResults(data);
            } else {
                showAlert(data.error || 'Processing failed', 'danger');
                processBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            processingSection.style.display = 'none';
            showAlert('Network error occurred. Please try again.', 'danger');
            processBtn.disabled = false;
        });
    });

    // Display processing results
    function displayResults(data) {
        // Update summary
        const summary = document.getElementById('processSummary');
        let summaryText = '<strong>Image successfully protected!</strong><br>';
        
        if (data.faces_detected > 0) {
            summaryText += `<i class="fas fa-user-secret me-1"></i> ${data.faces_detected} face(s) detected and blurred<br>`;
        } else if (document.getElementById('blurFaces').checked) {
            summaryText += `<i class="fas fa-info-circle me-1"></i> No faces detected in the image<br>`;
        }
        
        if (document.getElementById('removeMetadata').checked) {
            summaryText += `<i class="fas fa-tags me-1"></i> All metadata removed<br>`;
        }
        
        summaryText += `<i class="fas fa-compress-alt me-1"></i> File size: ${formatFileSize(data.processed_size)}`;
        
        if (data.size_reduction > 0) {
            summaryText += ` (${data.size_reduction}% reduction)`;
        }
        
        summary.innerHTML = summaryText;

        // Update images
        document.getElementById('originalImage').src = `data:image/jpeg;base64,${data.original_image}`;
        document.getElementById('processedImage').src = `data:image/jpeg;base64,${data.processed_image}`;

        // Update metadata info
        const metadataInfo = document.getElementById('metadataInfo');
        if (Object.keys(data.original_metadata).length > 0) {
            let metadataHtml = '<div class="metadata-list">';
            const importantFields = ['DateTime', 'GPS GPSLatitude', 'GPS GPSLongitude', 'Make', 'Model', 'Software'];
            
            for (const [key, value] of Object.entries(data.original_metadata)) {
                if (importantFields.some(field => key.includes(field))) {
                    metadataHtml += `<div class="mb-1"><small><strong>${key}:</strong> ${value}</small></div>`;
                }
            }
            
            const otherCount = Object.keys(data.original_metadata).length - importantFields.length;
            if (otherCount > 0) {
                metadataHtml += `<div class="text-muted"><small>...and ${otherCount} other metadata fields</small></div>`;
            }
            
            metadataHtml += '</div>';
            metadataInfo.innerHTML = metadataHtml;
        } else {
            metadataInfo.innerHTML = '<p class="text-muted mb-0">No sensitive metadata found</p>';
        }

        // Update processing stats
        const processStats = document.getElementById('processStats');
        processStats.innerHTML = `
            <div class="mb-2">
                <i class="fas fa-shield-alt me-1 text-success"></i>
                <strong>Privacy Level:</strong> 
                ${document.getElementById('removeMetadata').checked && data.faces_detected > 0 ? 'Maximum' : 
                  document.getElementById('removeMetadata').checked || data.faces_detected > 0 ? 'High' : 'Basic'}
            </div>
            <div class="mb-2">
                <i class="fas fa-clock me-1"></i>
                <strong>Processing:</strong> Complete
            </div>
            <div class="mb-2">
                <i class="fas fa-file-alt me-1"></i>
                <strong>Original Size:</strong> ${formatFileSize(data.original_size)}
            </div>
            <div>
                <i class="fas fa-compress me-1"></i>
                <strong>Protected Size:</strong> ${formatFileSize(data.processed_size)}
            </div>
        `;

        // Update download button
        document.getElementById('downloadBtn').href = `/download/${data.processed_filename}`;

        // Show results section
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Utility functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showAlert(message, type) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at top of container
        const container = document.querySelector('.container');
        container.insertBefore(alertDiv, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Blur strength slider update
    document.getElementById('blurStrength').addEventListener('input', function(e) {
        const value = e.target.value;
        const label = e.target.nextElementSibling;
        label.textContent = `Blur level: ${value}% - Higher values = more blur`;
    });

    // Face blur toggle
    document.getElementById('blurFaces').addEventListener('change', function(e) {
        const blurControls = document.querySelector('.mb-2');
        if (e.target.checked) {
            blurControls.style.opacity = '1';
            document.getElementById('blurStrength').disabled = false;
        } else {
            blurControls.style.opacity = '0.5';
            document.getElementById('blurStrength').disabled = true;
        }
    });
    
    // Initialize Face API on page load
    initializeFaceApi();

    // Initialize Face API
    async function initializeFaceApi() {
        try {
            console.log('Loading face-api.js models...');
            // Load face-api.js models from CDN
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model');
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model');
            await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model');
            await faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model');
            await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model');
            
            faceApiLoaded = true;
            console.log('Face-api.js models loaded successfully');
        } catch (error) {
            console.error('Error loading face-api.js models:', error);
            showAlert('Face detection models failed to load. Face detection will be unavailable.', 'warning');
        }
    }

    // Detect faces in an image
    async function detectFaces(imageElement) {
        if (!faceApiLoaded) {
            console.warn('Face API not loaded yet');
            return [];
        }

        try {
            console.log('Detecting faces...');
            const detections = await faceapi
                .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions()
                .withFaceDescriptors();
            
            console.log(`Detected ${detections.length} faces`);
            return detections;
        } catch (error) {
            console.error('Error detecting faces:', error);
            return [];
        }
    }

    // Draw face detection boxes and labels
    function drawFaceDetections(imageElement, detections) {
        const canvas = document.getElementById('originalCanvas');
        const container = imageElement.parentElement;
        
        // Set canvas size to match image container
        const rect = imageElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        canvas.width = imageElement.offsetWidth;
        canvas.height = imageElement.offsetHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections.length === 0) {
            return;
        }

        // Calculate scale factors
        const scaleX = imageElement.offsetWidth / imageElement.naturalWidth;
        const scaleY = imageElement.offsetHeight / imageElement.naturalHeight;
        
        detections.forEach((detection, index) => {
            const box = detection.detection.box;
            
            // Scale the box coordinates
            const x = box.x * scaleX;
            const y = box.y * scaleY;
            const width = box.width * scaleX;
            const height = box.height * scaleY;
            
            // Draw detection box
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            
            // Draw semi-transparent overlay
            ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
            ctx.fillRect(x, y, width, height);
            
            // Draw label
            const confidence = Math.round(detection.detection.score * 100);
            const label = `Face ${index + 1} (${confidence}%)`;
            
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(x, y - 25, ctx.measureText(label).width + 16, 20);
            
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fontWeight = 'bold';
            ctx.fillText(label, x + 8, y - 10);
        });
    }

    // Display face detection information
    function displayFaceInfo(detections) {
        const faceInfoContainer = document.getElementById('faceDetectionInfo');
        
        if (detections.length === 0) {
            faceInfoContainer.innerHTML = `
                <div class="face-info-card">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-info-circle text-info me-2"></i>
                        <span><strong>No faces detected</strong></span>
                    </div>
                    <small class="text-muted">The image appears to contain no detectable faces.</small>
                </div>
            `;
            return;
        }

        let infoHtml = `
            <div class="face-info-card">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-user-secret text-danger me-2"></i>
                    <span><strong>${detections.length} Face(s) Detected</strong></span>
                </div>
        `;

        detections.forEach((detection, index) => {
            const confidence = Math.round(detection.detection.score * 100);
            const box = detection.detection.box;
            
            // Get dominant expression
            let dominantExpression = 'neutral';
            let maxConfidence = 0;

            if (detection.expressions) {
                Object.entries(detection.expressions).forEach(([expression, value]) => {
                    if (value > maxConfidence) {
                        maxConfidence = value;
                        dominantExpression = expression;
                    }
                });
            }

            infoHtml += `
                <div class="mb-2 pb-2 border-bottom">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold">Face ${index + 1}</span>
                        <span class="badge bg-danger">${confidence}% confidence</span>
                    </div>
                    <div class="row g-2">
                        <div class="col-6">
                            <small class="text-muted">Position:</small><br>
                            <small>X: ${Math.round(box.x)}, Y: ${Math.round(box.y)}</small>
                        </div>
                        <div class="col-6">
                            <small class="text-muted">Size:</small><br>
                            <small>${Math.round(box.width)} × ${Math.round(box.height)}px</small>
                        </div>
                    </div>
                    ${detection.expressions ? `
                        <div class="mt-1">
                            <small class="text-muted">Expression:</small>
                            <span class="badge bg-info ms-1">${dominantExpression}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        infoHtml += `
                <div class="mt-2">
                    <small class="text-warning">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        These faces will be blurred in the protected image to prevent AI recognition.
                    </small>
                </div>
            </div>
        `;

        

        faceInfoContainer.innerHTML = infoHtml;
    }

    // Enhanced display results function with face detection
    const originalDisplayResults = displayResults;
    displayResults = async function(data) {
        // Call original display results
        originalDisplayResults(data);
        
        // Wait for image to load, then detect faces
        const originalImage = document.getElementById('originalImage');
        originalImage.onload = async function() {
            if (faceApiLoaded) {
                try {
                    showAlert('Analyzing image for faces...', 'info');
                    detectedFaces = await detectFaces(originalImage);
                    drawFaceDetections(originalImage, detectedFaces);
                    displayFaceInfo(detectedFaces);
                    
                    // Remove the analysis alert
                    setTimeout(() => {
                        const alerts = document.querySelectorAll('.alert-info');
                        alerts.forEach(alert => {
                            if (alert.textContent.includes('Analyzing image')) {
                                alert.remove();
                            }
                        });
                    }, 2000);
                } catch (error) {
                    console.error('Error in face detection:', error);
                }
            }
        };
    };
});
