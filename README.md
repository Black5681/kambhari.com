# Kambhari Gallery

A beautiful gallery website for managing and displaying videos and photos.

## Features

- Video gallery with YouTube and Google Drive support
- Photo gallery
- Password-protected upload and delete functions
- Responsive design
- Beautiful modern UI

## Setup Instructions

1. Prerequisites:
   - Install [Node.js](https://nodejs.org/) (version 14 or higher)
   - Install [Git](https://git-scm.com/) (optional, for version control)

2. Installation:
   ```bash
   # Clone or copy the project files to your computer
   
   # Navigate to the project directory
   cd kambhari-gallery
   
   # Install dependencies
   npm install
   ```

3. Running the Website:
   ```bash
   # Start the server
   npm start
   ```

4. Access the Website:
   - Open your web browser
   - Go to `http://localhost:3000`

## Important Passwords
- Add Video Password: 5681
- Delete Video Password: 9323

## Project Structure
- `server.js` - Main server file
- `index.html` - Home page
- `add_video.html` - Video upload page
- `data/` - Directory containing JSON files for data storage
  - `videos.json` - Video data
  - `photos.json` - Photo data

## Notes
- Make sure port 3000 is available
- The data directory will be created automatically
- Videos and photos are stored as links (not uploaded files)
