# Privacy Shield

A client-side image privacy protection tool that runs entirely in your browser. Protect your images from AI recognition and metadata tracking without uploading them to any server.

## Features

- **Face Detection & Blurring**: Automatically detect and blur faces in images
- **Metadata Removal**: Strip EXIF data including GPS location, device info, and timestamps
- **Client-Side Processing**: All processing happens locally in your browser
- **Privacy First**: Images never leave your device

## Live Demo

Visit the live demo at: [https://itsjenm.github.io/PrivacyProtect/](https://itsjenm.github.io/PrivacyProtect/)

## Usage

1. Open the application in your web browser
2. Upload an image by dragging and dropping or clicking to select
3. Choose your privacy protection options:
   - **Metadata Removal**: Remove EXIF data and other metadata
   - **Face Protection**: Blur detected faces with adjustable strength
4. Click "Protect My Image" to process
5. Download your protected image

## Technology

- **Face Detection**: face-api.js for browser-based AI face detection
- **Metadata Handling**: exif-js for reading and removing EXIF data
- **Image Processing**: HTML5 Canvas for image manipulation
- **UI Framework**: Bootstrap 5 with Font Awesome icons

## Privacy

- **No Server Upload**: Images are processed entirely in your browser
- **No Data Collection**: No analytics, tracking, or data collection
- **Local Storage**: Only basic usage statistics stored locally
- **Open Source**: Full source code available for review

## Setup for GitHub Pages

1. Fork this repository
2. Go to repository Settings → Pages
3. Set source to "Deploy from a branch"
4. Select "main" branch and "/ (root)" folder
5. Your site will be available at `https://yourusername.github.io/PrivacyProtect/`

## Local Development

1. Clone the repository
2. Open `index-static.html` in a web browser
3. Or serve with a local web server:
   ```bash
   python -m http.server 8000
   ```

## Browser Compatibility

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

*Note: Requires a modern browser with support for HTML5 Canvas, WebGL, and ES6 modules.*

## License

MIT License - see LICENSE file for details.
