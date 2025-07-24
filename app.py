import os
import logging
import uuid
import cv2
import numpy as np
from PIL import Image, ExifTags
from PIL.ExifTags import TAGS
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for
from werkzeug.utils import secure_filename
import io
import base64

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-key-change-in-production")

# Configuration
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def remove_metadata(image_path):
    """Remove EXIF metadata from image"""
    try:
        # Open image
        image = Image.open(image_path)
        
        # Create a new image without EXIF data
        data = list(image.getdata())
        image_without_exif = Image.new(image.mode, image.size)
        image_without_exif.putdata(data)
        
        return image_without_exif
    except Exception as e:
        logging.error(f"Error removing metadata: {str(e)}")
        raise

def detect_and_blur_faces(image_path, blur_strength=50):
    """Detect faces and apply blur/mask"""
    try:
        # Load the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not load image")
        
        # Convert to RGB for face detection
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Load face cascade classifier
        try:
            # Try common locations for the cascade file
            cascade_paths = [
                '/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml',
                '/usr/local/share/OpenCV/haarcascades/haarcascade_frontalface_default.xml'
            ]
            
            face_cascade = None
            for path in cascade_paths:
                if os.path.exists(path):
                    face_cascade = cv2.CascadeClassifier(path)
                    if not face_cascade.empty():
                        break
            
            # If not found in standard locations, skip face detection
            if face_cascade is None or face_cascade.empty():
                logging.warning("Face cascade classifier not found, skipping face detection")
                return img, 0
                
        except Exception as e:
            logging.warning(f"Error loading face cascade: {str(e)}, skipping face detection")
            return img, 0
        
        # Detect faces
        faces = face_cascade.detectMultiScale(rgb_img, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        faces_detected = len(faces)
        logging.info(f"Detected {faces_detected} faces")
        
        # Apply blur to detected faces
        for (x, y, w, h) in faces:
            # Extract face region
            face_region = img[y:y+h, x:x+w]
            
            # Apply Gaussian blur
            blurred_face = cv2.GaussianBlur(face_region, (blur_strength, blur_strength), 0)
            
            # Replace original face with blurred version
            img[y:y+h, x:x+w] = blurred_face
        
        return img, faces_detected
    except Exception as e:
        logging.error(f"Error in face detection: {str(e)}")
        raise

def get_image_metadata(image_path):
    """Extract metadata information from image"""
    try:
        image = Image.open(image_path)
        exifdata = image.getexif()
        
        metadata = {}
        if exifdata is not None:
            for tag_id in exifdata:
                tag = TAGS.get(tag_id, tag_id)
                data = exifdata.get(tag_id)
                if isinstance(data, bytes):
                    data = data.decode()
                metadata[tag] = data
        
        return metadata
    except Exception as e:
        logging.error(f"Error extracting metadata: {str(e)}")
        return {}

def image_to_base64(image_path):
    """Convert image to base64 for display"""
    try:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode()
    except Exception as e:
        logging.error(f"Error converting image to base64: {str(e)}")
        return None

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and processing"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file selected'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed. Please use PNG, JPG, JPEG, or WEBP'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size is 16MB'}), 400
        
        # Generate unique filename
        if file.filename is None:
            return jsonify({'error': 'Invalid filename'}), 400
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        # Save uploaded file
        file.save(file_path)
        
        # Extract original metadata
        original_metadata = get_image_metadata(file_path)
        
        # Process options
        remove_meta = request.form.get('remove_metadata', 'true') == 'true'
        blur_faces = request.form.get('blur_faces', 'true') == 'true'
        blur_strength = int(request.form.get('blur_strength', 50))
        
        # Process the image
        processed_filename = f"processed_{unique_filename}"
        processed_path = os.path.join(PROCESSED_FOLDER, processed_filename)
        
        faces_detected = 0
        
        if blur_faces:
            # Apply face blurring
            processed_img, faces_detected = detect_and_blur_faces(file_path, blur_strength)
            cv2.imwrite(processed_path, processed_img)
        else:
            # Just copy the original if no face blurring
            import shutil
            shutil.copy2(file_path, processed_path)
        
        if remove_meta:
            # Remove metadata
            clean_image = remove_metadata(processed_path)
            # Save with appropriate format and quality
            if filename.lower().endswith(('.jpg', '.jpeg')):
                clean_image.save(processed_path, 'JPEG', quality=95, optimize=True)
            elif filename.lower().endswith('.png'):
                clean_image.save(processed_path, 'PNG', optimize=True)
            elif filename.lower().endswith('.webp'):
                clean_image.save(processed_path, 'WEBP', quality=95, optimize=True)
        
        # Get file sizes
        original_size = os.path.getsize(file_path)
        processed_size = os.path.getsize(processed_path)
        
        # Convert images to base64 for preview
        original_b64 = image_to_base64(file_path)
        processed_b64 = image_to_base64(processed_path)
        
        # Clean up original file
        os.remove(file_path)
        
        return jsonify({
            'success': True,
            'processed_filename': processed_filename,
            'original_metadata': original_metadata,
            'faces_detected': faces_detected,
            'original_size': original_size,
            'processed_size': processed_size,
            'size_reduction': round(((original_size - processed_size) / original_size) * 100, 1),
            'original_image': original_b64,
            'processed_image': processed_b64
        })
        
    except Exception as e:
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Download processed file"""
    try:
        file_path = os.path.join(PROCESSED_FOLDER, filename)
        if not os.path.exists(file_path):
            flash('File not found', 'error')
            return redirect(url_for('index'))
        
        return send_file(file_path, as_attachment=True, download_name=f"privacy_protected_{filename[10:]}")
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        flash('Download failed', 'error')
        return redirect(url_for('index'))

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large'}), 413

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
