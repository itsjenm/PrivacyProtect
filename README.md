# Privacy Shield - Image Privacy Protection Tool

## Overview

Privacy Shield is a Flask-based web application designed to protect user privacy by removing metadata and blurring faces in uploaded images. The application provides a simple, user-friendly interface for processing images to prevent AI recognition and metadata tracking. All processing occurs server-side with automatic cleanup to ensure user privacy.

## Getting Started

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/itsjenm/PrivacyProtect.git
   cd PrivacyProtect
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   
   If you prefer using a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Start the application:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

### Environment Variables (Optional)
- `DATABASE_URL`: Configure database connection (PostgreSQL recommended)
- `SESSION_SECRET`: Custom secret key for session security

## Usage Guide with Screenshots



### 1. Face Detection
![Face Detection](uploads/Face-Detection_Example.jpg)
*Automatic face detection with overlay boxes*

### 2. Metadata View (Before)
![Metadata View](uploads/meta-data-before.jpg)

### 2. Metadata View (After)
![Metadata View](uploads/meta-data-after.jpg)
*Display of removed metadata information*

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
- **Flask-SQLAlchemy**: ORM for database operations (if using analytics)

### Frontend Dependencies
- **Bootstrap 5**: UI framework with dark theme support
- **Font Awesome**: Icon library for consistent visual elements
- **face-api.js**: Client-side face detection library
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

## Contributing

Contributions to improve Privacy Shield are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Image not uploading**
   - Check file size (max 16MB)
   - Ensure file format is supported (PNG, JPG, JPEG, WEBP)

2. **Face detection not working**
   - Try adjusting the detection method (server, client, or hybrid)
   - Some faces may not be detected due to angles, lighting, or occlusion

3. **Database connection errors**
   - Verify DATABASE_URL environment variable is correctly set
   - Check PostgreSQL server is running

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Last updated: July 26, 2025*
