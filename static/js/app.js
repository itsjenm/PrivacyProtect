
let faceApiLoaded = false;
let detectedFaces = [];

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const processBtn = document.getElementById('processBtn');
    const processingSection = document.getElementById('processingSection');
    const resultsSection = document.getElementById('resultsSection');

    
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

    // handles file input change 
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });


    function handleFileSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 16 * 1024 * 1024; // 16MB


        if (!allowedTypes.includes(file.type)) {
            showAlert('Please select a valid image file (JPG, PNG, or WEBP)', 'danger');
            resetFileInput();
            return;
        }

       
        if (file.size > maxSize) {
            showAlert('File size must be less than 16MB', 'danger');
            resetFileInput();
            return;
        }

     
        updateUploadArea(file);
        processBtn.disabled = false;
    }


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

   
    function resetFileInput() {
        fileInput.value = '';
    }

   
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
        
        
        const detectionMethod = document.querySelector('input[name="detectionMethod"]:checked').value;
        formData.append('detection_method', detectionMethod);
        
      
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

       
        processingSection.style.display = 'block';
        resultsSection.style.display = 'none';
        processBtn.disabled = true;

       
        processingSection.scrollIntoView({ behavior: 'smooth' });

      
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


    function displayResults(data) {
        // Update summary
        const summary = document.getElementById('processSummary');
        let summaryText = '<strong>Image successfully protected!</strong><br>';
        
        // Use the actual number of faces that were processed by the server
        const actualFacesProcessed = data.faces_detected || 0;
        
        if (actualFacesProcessed > 0) {
            summaryText += `<i class="fas fa-user-secret me-1"></i> ${actualFacesProcessed} face(s) detected and blurred<br>`;
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

        
        document.getElementById('originalImage').src = `data:image/jpeg;base64,${data.original_image}`;
        document.getElementById('processedImage').src = `data:image/jpeg;base64,${data.processed_image}`;

        
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

     
        const processStats = document.getElementById('processStats');
        processStats.innerHTML = `
            <div class="mb-2">
                <i class="fas fa-shield-alt me-1 text-success"></i>
                <strong>Privacy Level:</strong> 
                ${document.getElementById('removeMetadata').checked && actualFacesProcessed > 0 ? 'Maximum' : 
                  document.getElementById('removeMetadata').checked || actualFacesProcessed > 0 ? 'High' : 'Basic'}
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

 
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showAlert(message, type) {
       
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

       
        const container = document.querySelector('.container');
        container.insertBefore(alertDiv, container.firstChild);

      
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

   
    document.getElementById('blurStrength').addEventListener('input', function(e) {
        const value = e.target.value;
        const label = e.target.nextElementSibling;
        label.textContent = `Blur level: ${value}% - Higher values = more blur`;
    });

    
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

    // Draw face detection boxes and labels (supports both client and server detections)
    function drawFaceDetections(imageElement, clientDetections = [], serverDetections = []) {
        const canvas = document.getElementById('originalCanvas');
        if (!canvas) {
            console.warn('Canvas element not found');
            return;
        }
        
        const container = imageElement.parentElement;
        
        // Set canvas size to match image element
        canvas.width = imageElement.offsetWidth;
        canvas.height = imageElement.offsetHeight;
        
        // Position canvas to overlay the image
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scale factors from natural image size to displayed size
        const scaleX = imageElement.offsetWidth / imageElement.naturalWidth;
        const scaleY = imageElement.offsetHeight / imageElement.naturalHeight;
        
        // Draw server detections (OpenCV results) - these are authoritative
        if (serverDetections && serverDetections.length > 0) {
            serverDetections.forEach((detection, index) => {
                const x = detection.x * scaleX;
                const y = detection.y * scaleY;
                const width = detection.width * scaleX;
                const height = detection.height * scaleY;
                
                // Draw server detection box (green for server authority)
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                
                // Draw semi-transparent overlay
                ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
                ctx.fillRect(x, y, width, height);
                
                // Draw label
                const label = `Server Face ${index + 1}`;
                const textWidth = ctx.measureText(label).width;
                
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(x, y - 25, textWidth + 16, 20);
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(label, x + 8, y - 10);
            });
        }
        
        // Draw client detections (face-api.js) - supplementary info
        if (clientDetections && clientDetections.length > 0) {
            clientDetections.forEach((detection, index) => {
                const box = detection.detection.box;
                
                // Scale the box coordinates
                const x = box.x * scaleX;
                const y = box.y * scaleY;
                const width = box.width * scaleX;
                const height = box.height * scaleY;
                
                // Check if this overlaps with server detection (avoid duplicate boxes)
                let overlapsServer = false;
                if (serverDetections && serverDetections.length > 0) {
                    overlapsServer = serverDetections.some(serverBox => {
                        const serverX = serverBox.x * scaleX;
                        const serverY = serverBox.y * scaleY;
                        const serverW = serverBox.width * scaleX;
                        const serverH = serverBox.height * scaleY;
                        
                        // Check for overlap (simple bounding box intersection)
                        return !(x > serverX + serverW || 
                                x + width < serverX || 
                                y > serverY + serverH || 
                                y + height < serverY);
                    });
                }
                
                if (!overlapsServer) {
                    // Draw client detection box (blue for supplementary)
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]); // Dashed line to distinguish from server
                    ctx.strokeRect(x, y, width, height);
                    ctx.setLineDash([]); // Reset line dash
                    
                    // Draw semi-transparent overlay
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
                    ctx.fillRect(x, y, width, height);
                    
                    // Draw label
                    const confidence = Math.round(detection.detection.score * 100);
                    const label = `Client Face ${index + 1} (${confidence}%)`;
                    const textWidth = ctx.measureText(label).width;
                    
                    ctx.fillStyle = '#3b82f6';
                    ctx.fillRect(x, y - 25, textWidth + 16, 20);
                    
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 11px Arial';
                    ctx.fillText(label, x + 8, y - 10);
                }
            });
        }
        
        // If no detections at all, clear the canvas
        if ((!serverDetections || serverDetections.length === 0) && 
            (!clientDetections || clientDetections.length === 0)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Display face detection information (integrates server and client results)
    function displayFaceInfo(clientDetections = [], serverData = null) {
        const faceInfoContainer = document.getElementById('faceDetectionInfo');
        
        // Use server data if available for accuracy
        const serverFaceCount = serverData ? (serverData.faces_detected || 0) : 0;
        const clientFaceCount = clientDetections ? clientDetections.length : 0;
        const serverDetections = serverData ? (serverData.face_coordinates || []) : [];
        
        // Total unique faces (server is authoritative)
        const totalFaces = Math.max(serverFaceCount, clientFaceCount);
        
        if (totalFaces === 0) {
            faceInfoContainer.innerHTML = `
                <div class="face-info-card">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-info-circle text-info me-2"></i>
                        <span><strong>No faces detected</strong></span>
                    </div>
                    <small class="text-muted">No faces were found in the image by either server or client detection.</small>
                </div>
            `;
            return;
        }

        let infoHtml = `
            <div class="face-info-card">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-user-secret text-danger me-2"></i>
                        <span><strong>${totalFaces} Face(s) Detected</strong></span>
                    </div>
                    <div class="d-flex gap-2">
                        ${serverFaceCount > 0 ? '<span class="badge bg-success">Server: ' + serverFaceCount + '</span>' : ''}
                        ${clientFaceCount > 0 ? '<span class="badge bg-info">Client: ' + clientFaceCount + '</span>' : ''}
                    </div>
                </div>
        `;

        // Show detection method comparison
        if (serverFaceCount > 0 && clientFaceCount > 0) {
            const accuracy = serverFaceCount === clientFaceCount ? 'Perfect Match' : 
                           Math.abs(serverFaceCount - clientFaceCount) === 1 ? 'Close Match' : 'Different Results';
            const accuracyColor = accuracy === 'Perfect Match' ? 'success' : 
                                 accuracy === 'Close Match' ? 'warning' : 'danger';
            
            infoHtml += `
                <div class="mb-3 p-2 bg-dark rounded">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Detection Accuracy:</small>
                        <span class="badge bg-${accuracyColor}">${accuracy}</span>
                    </div>
                    <small class="text-muted">
                        Server (OpenCV): ${serverFaceCount} faces | Client (face-api.js): ${clientFaceCount} faces
                    </small>
                </div>
            `;
        }

        // Show server detections first (authoritative)
        if (serverDetections && serverDetections.length > 0) {
            infoHtml += `<div class="mb-2"><strong class="text-success">Server Detections (OpenCV):</strong></div>`;
            serverDetections.forEach((detection, index) => {
                infoHtml += `
                    <div class="mb-2 pb-2 border-bottom border-success">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-success">Server Face ${index + 1}</span>
                            <span class="badge bg-success">Processed</span>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <small class="text-muted">Position:</small><br>
                                <small>X: ${Math.round(detection.x)}, Y: ${Math.round(detection.y)}</small>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Size:</small><br>
                                <small>${Math.round(detection.width)} × ${Math.round(detection.height)}px</small>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // Show client-side detection details if available
        if (clientDetections && clientDetections.length > 0) {
            infoHtml += `<div class="mb-2 mt-3"><strong class="text-info">Client Detections (face-api.js):</strong></div>`;
            clientDetections.forEach((detection, index) => {
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
                    <div class="mb-2 pb-2 border-bottom border-info">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold text-info">Client Face ${index + 1}</span>
                            <span class="badge bg-info">${confidence}% confidence</span>
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
                                <span class="badge bg-secondary ms-1">${dominantExpression}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        infoHtml += `
                <div class="mt-3 p-2 bg-warning bg-opacity-10 rounded">
                    <small class="text-warning">
                        <i class="fas fa-shield-alt me-1"></i>
                        <strong>Privacy Protection:</strong> ${serverFaceCount > 0 ? 'Server-detected faces have been blurred using OpenCV.' : 'No server-side face blurring applied.'}
                        ${clientFaceCount > 0 && serverFaceCount === 0 ? ' Client detected faces but server processing was not applied.' : ''}
                    </small>
                </div>
            </div>
        `;

        faceInfoContainer.innerHTML = infoHtml;
    }

    // Enhanced display results function with integrated face detection
    const originalDisplayResults = displayResults;
    displayResults = async function(data) {
        // Call original display results
        originalDisplayResults(data);
        
        // Extract server face coordinates if available
        const serverDetections = data.face_coordinates || [];
        
        // Wait for image to load, then detect faces and draw overlays
        const originalImage = document.getElementById('originalImage');
        originalImage.onload = async function() {
            // Ensure canvas is properly positioned
            const canvas = document.getElementById('originalCanvas');
            if (canvas) {
                const container = originalImage.parentElement;
                canvas.style.position = 'absolute';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.zIndex = '10';
            }
            
            let clientDetections = [];
            
            if (faceApiLoaded) {
                try {
                    showAlert('Analyzing image with face-api.js...', 'info');
                    clientDetections = await detectFaces(originalImage);
                    
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
            
            // Draw face detections (both server and client)
            drawFaceDetections(originalImage, clientDetections, serverDetections);
            
            // Display integrated face information
            displayFaceInfo(clientDetections, data);
            
            // Store detections for form submission
            detectedFaces = clientDetections;
        };
    };
});
