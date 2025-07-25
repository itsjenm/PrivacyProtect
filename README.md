# Privacy Shield - Image Privacy Protection Tool

## Overview

Privacy Shield is a Flask-based web application designed to protect user privacy by removing metadata and blurring faces in uploaded images. The application provides a simple, user-friendly interface for processing images to prevent AI recognition and metadata tracking. All processing occurs server-side with automatic cleanup to ensure user privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology**: Vanilla JavaScript with Bootstrap 5 (dark theme)
- **Design Pattern**: Single-page application with progressive disclosure
- **UI Framework**: Bootstrap with custom CSS for drag-and-drop functionality
- **Icons**: Font Awesome for consistent iconography
- **Interaction Model**: Drag-and-drop file upload with real-time preview and processing feedback
- **Face Detection**: Client-side face-api.js integration with visual detection overlays

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Architecture Pattern**: Simple MVC with route-based handlers
- **File Processing**: OpenCV for computer vision tasks, PIL for image manipulation
- **Session Management**: Flask sessions with configurable secret key
- **Error Handling**: Comprehensive logging and user-friendly error messages
- **Database**: PostgreSQL with SQLAlchemy ORM for analytics and session tracking
- **Analytics**: Real-time statistics dashboard with processing metrics

## Key Components

### Image Processing Pipeline
1. **File Validation**: Extension and size validation (max 16MB)
2. **Metadata Removal**: EXIF data stripping using PIL
3. **Face Detection**: OpenCV Haar cascades for face recognition
4. **Face Blurring**: Gaussian blur application to detected face regions
5. **Output Generation**: Processed image creation with automatic cleanup

### File Management System
- **Upload Directory**: Temporary storage for incoming files
- **Processed Directory**: Temporary storage for output files
- **Automatic Cleanup**: Files are deleted after processing to maintain privacy
- **Secure Filenames**: Werkzeug secure filename generation

### User Interface Components
- **Drag-and-Drop Upload**: Interactive file upload area with visual feedback
- **Processing Options**: Configurable blur strength settings
- **Progress Indicators**: Real-time processing status updates
- **Download Interface**: Secure file download with automatic cleanup

## Data Flow

1. **File Upload**: User drags/selects image file → Client-side validation → Server upload
2. **Processing Request**: User configures options → Form submission → Server-side processing
3. **Image Processing**: 
   - Metadata removal from original image
   - Face detection using OpenCV
   - Blur application to detected faces
   - Output file generation
4. **Result Delivery**: Processed image download → Automatic file cleanup
5. **Privacy Protection**: All temporary files deleted immediately after processing

## External Dependencies

### Python Libraries
- **Flask**: Web framework for request handling and routing
- **OpenCV (cv2)**: Computer vision library for face detection
- **PIL (Pillow)**: Image processing for metadata removal and manipulation
- **NumPy**: Numerical operations for image data processing
- **Werkzeug**: Security utilities for filename handling

### Frontend Dependencies
- **Bootstrap 5**: UI framework with dark theme support
- **Font Awesome**: Icon library for consistent visual elements
- **Vanilla JavaScript**: No framework dependencies for lightweight client-side functionality

### System Dependencies
- **File System**: Local storage for temporary file processing
- **Environment Variables**: Configuration through environment variables for security

## Deployment Strategy

### Environment Configuration
- **Development**: Local Flask development server with debug logging
- **Production**: Environment-based secret key configuration
- **File Storage**: Local file system with automatic cleanup policies
- **Security**: Secure filename handling and file type validation

### Privacy Considerations
- **No Persistent Storage**: All files deleted immediately after processing
- **Local Processing**: No external API calls or cloud processing
- **Metadata Stripping**: Complete EXIF data removal
- **Session Security**: Configurable session secret for security

### Scalability Approach
- **Stateless Design**: No database dependencies for easy horizontal scaling
- **File System**: Simple local storage suitable for single-instance deployment
- **Memory Management**: Efficient image processing with automatic cleanup
- **Error Recovery**: Comprehensive error handling with user feedback

The application prioritizes user privacy through local processing, automatic file cleanup, and comprehensive metadata removal while maintaining a simple, intuitive user experience.
