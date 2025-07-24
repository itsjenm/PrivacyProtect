// Privacy Shield JavaScript
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
});
