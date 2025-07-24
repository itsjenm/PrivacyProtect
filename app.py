import os
import logging
import uuid
import cv2
import numpy as np
import json
import time
from datetime import datetime, date
from PIL import Image, ExifTags
from PIL.ExifTags import TAGS
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import io
import base64

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-key-change-in-production")

# Database configuration
database_url = os.environ.get("DATABASE_URL")
database_enabled = False
db = None
ProcessingSession = None
ProcessingStats = None
FaceDetection = None

if database_url:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    # Initialize database
    try:
        from models import db, ProcessingSession, ProcessingStats, FaceDetection
        db.init_app(app)
        database_enabled = True
        logging.info(f"Database configured with URL: {database_url[:50]}...")
    except ImportError as e:
        logging.error(f"Database import error: {str(e)}")
        database_enabled = False
else:
    logging.warning("No DATABASE_URL found - running without database functionality")

# Configuration
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

# Create database tables
if database_enabled:
    with app.app_context():
        try:
            db.create_all()
            logging.info("Database tables created successfully")
        except Exception as e:
            logging.error(f"Database initialization error: {str(e)}")
            database_enabled = False

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

def blur_faces_from_coordinates(image_path, face_coordinates, blur_strength=50):
    """Apply blur to specific face coordinates"""
    try:
        # Load the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not load image")
        
        faces_processed = 0
        
        if face_coordinates:
            logging.info(f"Processing {len(face_coordinates)} face coordinates for blurring")
            
            # Apply blur to each face region
            for i, face in enumerate(face_coordinates):
                try:
                    x = int(face['x'])
                    y = int(face['y']) 
                    w = int(face['width'])
                    h = int(face['height'])
                    
                    logging.info(f"Face {i+1}: x={x}, y={y}, w={w}, h={h} (image size: {img.shape[1]}x{img.shape[0]})")
                    
                    # Ensure coordinates are within image bounds
                    x = max(0, min(x, img.shape[1] - 1))
                    y = max(0, min(y, img.shape[0] - 1))
                    w = max(1, min(w, img.shape[1] - x))
                    h = max(1, min(h, img.shape[0] - y))
                    
                    # Add some padding around the face for better coverage
                    padding = max(5, min(w, h) // 10)
                    x = max(0, x - padding)
                    y = max(0, y - padding)
                    w = min(img.shape[1] - x, w + 2 * padding)
                    h = min(img.shape[0] - y, h + 2 * padding)
                    
                    logging.info(f"Face {i+1} adjusted: x={x}, y={y}, w={w}, h={h}")
                    
                    # Extract face region
                    face_region = img[y:y+h, x:x+w]
                    
                    if face_region.size > 0 and face_region.shape[0] > 0 and face_region.shape[1] > 0:
                        # Apply Gaussian blur (ensure odd blur values)
                        blur_val = max(5, blur_strength if blur_strength % 2 == 1 else blur_strength + 1)
                        blurred_face = cv2.GaussianBlur(face_region, (blur_val, blur_val), 0)
                        
                        # Replace original face with blurred version
                        img[y:y+h, x:x+w] = blurred_face
                        faces_processed += 1
                        logging.info(f"Successfully blurred face {i+1}")
                    else:
                        logging.warning(f"Face {i+1} region is empty or invalid")
                        
                except (KeyError, ValueError, TypeError) as e:
                    logging.error(f"Invalid face coordinates for face {i+1}: {e}")
                    continue
        
        logging.info(f"Processed {faces_processed} out of {len(face_coordinates)} faces for blurring")
        return img, faces_processed
    except Exception as e:
        logging.error(f"Error in face blurring: {str(e)}")
        raise

def detect_and_blur_faces_opencv(image_path, blur_strength=50):
    """Detect and blur faces using OpenCV Haar cascades"""
    try:
        # Load the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not load image")
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Initialize face cascade classifier
        # Try multiple cascade files for better detection
        cascade_files = [
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml',
            cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml',
            cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'
        ]
        
        all_faces = []
        
        for cascade_file in cascade_files:
            try:
                face_cascade = cv2.CascadeClassifier(cascade_file)
                if face_cascade.empty():
                    continue
                    
                # Detect faces with multiple parameters for better accuracy
                faces = face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(30, 30),
                    maxSize=(300, 300)
                )
                
                # Add detected faces to the list
                for (x, y, w, h) in faces:
                    # Check if this face overlaps significantly with existing faces
                    is_duplicate = False
                    for existing_face in all_faces:
                        ex, ey, ew, eh = existing_face
                        # Calculate overlap
                        overlap_x = max(0, min(x + w, ex + ew) - max(x, ex))
                        overlap_y = max(0, min(y + h, ey + eh) - max(y, ey))
                        overlap_area = overlap_x * overlap_y
                        face_area = w * h
                        
                        if overlap_area > 0.5 * face_area:  # More than 50% overlap
                            is_duplicate = True
                            break
                    
                    if not is_duplicate:
                        all_faces.append((x, y, w, h))
                        
            except Exception as e:
                logging.warning(f"Error with cascade {cascade_file}: {str(e)}")
                continue
        
        # Apply blur to detected faces
        faces_processed = 0
        
        for (x, y, w, h) in all_faces:
            # Add padding around face for better coverage
            padding = max(5, min(w, h) // 10)
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(img.shape[1] - x, w + 2 * padding)
            h = min(img.shape[0] - y, h + 2 * padding)
            
            # Extract face region
            face_region = img[y:y+h, x:x+w]
            
            if face_region.size > 0:
                # Apply Gaussian blur
                blur_val = max(5, blur_strength if blur_strength % 2 == 1 else blur_strength + 1)
                blurred_face = cv2.GaussianBlur(face_region, (blur_val, blur_val), 0)
                
                # Replace original face with blurred version
                img[y:y+h, x:x+w] = blurred_face
                faces_processed += 1
        
        logging.info(f"OpenCV detected and blurred {faces_processed} faces using {len(cascade_files)} cascades")
        return img, faces_processed
        
    except Exception as e:
        logging.error(f"Error in OpenCV face detection: {str(e)}")
        raise

def detect_and_blur_faces(image_path, blur_strength=50):
    """Legacy function - fallback to OpenCV detection"""
    try:
        logging.info("Using OpenCV face detection as fallback")
        return detect_and_blur_faces_opencv(image_path, blur_strength)
    except Exception as e:
        logging.error(f"Error in fallback face detection: {str(e)}")
        # Return original image if detection fails
        img = cv2.imread(image_path)
        return img, 0

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

def log_processing_session(user_ip, user_agent, original_filename, original_size, processed_size, 
                          metadata_removed, faces_detected, faces_blurred, blur_strength, 
                          face_coordinates, processing_time_ms, success=True, error_msg=None):
    """Log processing session to database"""
    if not database_enabled:
        return None
    
    try:
        # Create processing session
        session = ProcessingSession(
            user_ip=user_ip,
            user_agent=user_agent,
            original_filename=original_filename,
            original_file_size=original_size,
            processed_file_size=processed_size,
            metadata_removed=metadata_removed,
            faces_detected=faces_detected,
            faces_blurred=faces_blurred,
            blur_strength=blur_strength,
            processing_success=success,
            error_message=error_msg,
            processing_time_ms=processing_time_ms
        )
        
        db.session.add(session)
        db.session.flush()  # Get the session ID
        
        # Log individual face detections
        if face_coordinates and success:
            for i, face in enumerate(face_coordinates):
                face_detection = FaceDetection(
                    session_id=session.id,
                    face_index=i + 1,
                    confidence_score=face.get('confidence', 0.0),
                    box_x=face['x'],
                    box_y=face['y'],
                    box_width=face['width'],
                    box_height=face['height'],
                    dominant_expression=face.get('expression', 'unknown'),
                    expression_confidence=face.get('expression_confidence', 0.0)
                )
                db.session.add(face_detection)
        
        # Update daily stats
        update_daily_stats(original_size, processed_size, metadata_removed, 
                          faces_detected, faces_blurred, processing_time_ms)
        
        db.session.commit()
        logging.info(f"Processing session logged: {session.id}")
        return session.id
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error logging processing session: {str(e)}")
        return None

def update_daily_stats(original_size, processed_size, metadata_removed, 
                      faces_detected, faces_blurred, processing_time_ms):
    """Update daily processing statistics"""
    try:
        today = date.today()
        stats = ProcessingStats.query.filter_by(date=today).first()
        
        if not stats:
            stats = ProcessingStats(date=today)
            db.session.add(stats)
        
        # Update counters
        stats.total_images_processed = (stats.total_images_processed or 0) + 1
        stats.total_faces_detected = (stats.total_faces_detected or 0) + faces_detected
        if metadata_removed:
            stats.total_metadata_removals = (stats.total_metadata_removals or 0) + 1
        if faces_blurred:
            stats.total_face_blurs = (stats.total_face_blurs or 0) + 1
        
        # Update file sizes (convert to MB)
        stats.total_original_size_mb = (stats.total_original_size_mb or 0.0) + (original_size / (1024 * 1024))
        stats.total_processed_size_mb = (stats.total_processed_size_mb or 0.0) + (processed_size / (1024 * 1024))
        
        # Update average processing time
        current_total_time = (stats.avg_processing_time_ms or 0.0) * ((stats.total_images_processed or 1) - 1)
        stats.avg_processing_time_ms = (current_total_time + processing_time_ms) / (stats.total_images_processed or 1)
        
        stats.updated_at = datetime.utcnow()
        
    except Exception as e:
        logging.error(f"Error updating daily stats: {str(e)}")

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and processing"""
    start_time = time.time()
    user_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))
    user_agent = request.environ.get('HTTP_USER_AGENT', 'unknown')
    
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
        detection_method = request.form.get('detection_method', 'client')
        
        # Get face coordinates from frontend (JSON string)
        face_coordinates_str = request.form.get('face_coordinates', '[]')
        try:
            face_coordinates = json.loads(face_coordinates_str)
            logging.info(f"Received face coordinates: {face_coordinates}")
        except (json.JSONDecodeError, TypeError):
            face_coordinates = []
            logging.warning("Failed to parse face coordinates")
        
        # Process the image
        processed_filename = f"processed_{unique_filename}"
        processed_path = os.path.join(PROCESSED_FOLDER, processed_filename)
        
        faces_detected = 0
        
        if blur_faces:
            if detection_method == 'server':
                # Force server-side OpenCV detection
                logging.info("Using OpenCV server-side face detection (forced)")
                processed_img, faces_detected = detect_and_blur_faces_opencv(file_path, blur_strength)
                cv2.imwrite(processed_path, processed_img)
            elif detection_method == 'hybrid':
                # Use both client and server detection for maximum coverage
                logging.info("Using hybrid face detection (client + server)")
                client_faces = 0
                server_faces = 0
                
                # Start with client-side coordinates if available
                if face_coordinates:
                    processed_img, client_faces = blur_faces_from_coordinates(file_path, face_coordinates, blur_strength)
                    cv2.imwrite(processed_path, processed_img)
                    
                    # Then run server-side detection on the same image for additional faces
                    additional_img, server_faces = detect_and_blur_faces_opencv(processed_path, blur_strength)
                    cv2.imwrite(processed_path, additional_img)
                else:
                    # Only server-side if no client coordinates
                    processed_img, server_faces = detect_and_blur_faces_opencv(file_path, blur_strength)
                    cv2.imwrite(processed_path, processed_img)
                
                faces_detected = client_faces + server_faces
                logging.info(f"Hybrid detection: {client_faces} client faces + {server_faces} server faces = {faces_detected} total")
            else:
                # Default: client-side with server fallback
                if face_coordinates:
                    logging.info("Using client-side face detection coordinates")
                    processed_img, faces_detected = blur_faces_from_coordinates(file_path, face_coordinates, blur_strength)
                    cv2.imwrite(processed_path, processed_img)
                else:
                    logging.info("No client-side faces found, using OpenCV server-side detection")
                    processed_img, faces_detected = detect_and_blur_faces_opencv(file_path, blur_strength)
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
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Log to database
        if database_enabled:
            log_processing_session(
                user_ip=user_ip,
                user_agent=user_agent,
                original_filename=filename,
                original_size=original_size,
                processed_size=processed_size,
                metadata_removed=remove_meta,
                faces_detected=faces_detected,
                faces_blurred=blur_faces and faces_detected > 0,
                blur_strength=blur_strength if blur_faces else None,
                face_coordinates=face_coordinates,
                processing_time_ms=processing_time_ms,
                success=True
            )
        
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
            'processed_image': processed_b64,
            'processing_time_ms': processing_time_ms
        })
        
    except Exception as e:
        # Calculate processing time for failed requests
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Log failed processing attempt
        if database_enabled:
            log_processing_session(
                user_ip=user_ip,
                user_agent=user_agent,
                original_filename=getattr(file, 'filename', 'unknown'),
                original_size=0,
                processed_size=0,
                metadata_removed=False,
                faces_detected=0,
                faces_blurred=False,
                blur_strength=None,
                face_coordinates=[],
                processing_time_ms=processing_time_ms,
                success=False,
                error_msg=str(e)
            )
        
        logging.error(f"Upload error: {str(e)}")
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/stats')
def stats_dashboard():
    """Display processing statistics dashboard"""
    if not database_enabled:
        return render_template('stats.html', database_enabled=False, stats=None, recent_sessions=None)
    
    try:
        # Get today's stats
        today = date.today()
        today_stats = ProcessingStats.query.filter_by(date=today).first()
        
        # Get all-time totals
        all_time_stats = db.session.query(
            db.func.sum(ProcessingStats.total_images_processed).label('total_images'),
            db.func.sum(ProcessingStats.total_faces_detected).label('total_faces'),
            db.func.sum(ProcessingStats.total_metadata_removals).label('total_metadata'),
            db.func.sum(ProcessingStats.total_face_blurs).label('total_blurs'),
            db.func.sum(ProcessingStats.total_original_size_mb).label('total_original_mb'),
            db.func.sum(ProcessingStats.total_processed_size_mb).label('total_processed_mb'),
            db.func.avg(ProcessingStats.avg_processing_time_ms).label('avg_processing_time')
        ).first()
        
        # Get recent processing sessions
        recent_sessions = ProcessingSession.query.order_by(
            ProcessingSession.created_at.desc()
        ).limit(10).all()
        
        # Get last 7 days stats
        from datetime import timedelta
        week_ago = today - timedelta(days=7)
        weekly_stats = ProcessingStats.query.filter(
            ProcessingStats.date >= week_ago
        ).order_by(ProcessingStats.date.desc()).all()
        
        stats_data = {
            'today': today_stats,
            'all_time': all_time_stats,
            'weekly': weekly_stats,
            'today_date': today
        }
        
        return render_template('stats.html', 
                             database_enabled=True, 
                             stats=stats_data, 
                             recent_sessions=recent_sessions)
        
    except Exception as e:
        logging.error(f"Error loading stats: {str(e)}")
        return render_template('stats.html', database_enabled=False, stats=None, recent_sessions=None)

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
