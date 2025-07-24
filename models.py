from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

class ProcessingSession(db.Model):
    """Track image processing sessions for analytics"""
    __tablename__ = 'processing_sessions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_ip = db.Column(db.String(45), nullable=False)
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Processing details
    original_filename = db.Column(db.String(255))
    original_file_size = db.Column(db.Integer)
    processed_file_size = db.Column(db.Integer)
    metadata_removed = db.Column(db.Boolean, default=False)
    faces_detected = db.Column(db.Integer, default=0)
    faces_blurred = db.Column(db.Boolean, default=False)
    blur_strength = db.Column(db.Integer)
    
    # Processing results
    processing_success = db.Column(db.Boolean, default=True)
    error_message = db.Column(db.Text)
    processing_time_ms = db.Column(db.Integer)
    
    def __repr__(self):
        return f'<ProcessingSession {self.id}: {self.faces_detected} faces>'

class ProcessingStats(db.Model):
    """Aggregate statistics for the application"""
    __tablename__ = 'processing_stats'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, default=datetime.utcnow().date, nullable=False, unique=True)
    
    # Daily counts
    total_images_processed = db.Column(db.Integer, default=0)
    total_faces_detected = db.Column(db.Integer, default=0)
    total_metadata_removals = db.Column(db.Integer, default=0)
    total_face_blurs = db.Column(db.Integer, default=0)
    
    # File size statistics
    total_original_size_mb = db.Column(db.Float, default=0.0)
    total_processed_size_mb = db.Column(db.Float, default=0.0)
    
    # Performance
    avg_processing_time_ms = db.Column(db.Float, default=0.0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<ProcessingStats {self.date}: {self.total_images_processed} images>'

class FaceDetection(db.Model):
    """Store detailed face detection data for analysis"""
    __tablename__ = 'face_detections'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = db.Column(db.String(36), db.ForeignKey('processing_sessions.id'), nullable=False)
    
    # Face detection details
    face_index = db.Column(db.Integer, nullable=False)  # Face number in image (1, 2, 3...)
    confidence_score = db.Column(db.Float, nullable=False)
    
    # Bounding box coordinates
    box_x = db.Column(db.Float, nullable=False)
    box_y = db.Column(db.Float, nullable=False)
    box_width = db.Column(db.Float, nullable=False)
    box_height = db.Column(db.Float, nullable=False)
    
    # Expression analysis (optional)
    dominant_expression = db.Column(db.String(50))
    expression_confidence = db.Column(db.Float)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    session = db.relationship('ProcessingSession', backref=db.backref('face_detections', lazy=True))
    
    def __repr__(self):
        return f'<FaceDetection {self.id}: {self.confidence_score:.2f} confidence>'