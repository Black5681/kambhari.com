const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

// Enable verbose logging
const logRequest = (req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
};

app.use(logRequest);

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Delete-Password');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler caught:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Serve static files with proper headers
app.use((req, res, next) => {
    if (req.url.startsWith('/uploads/') || req.url.startsWith('/images/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    next();
});

// Serve uploads and images directories
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve HTML files
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (path.extname(filePath) === '.html') {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Path to data files
const videosFile = path.join(__dirname, 'videos.json');
const photosFile = path.join(__dirname, 'photos.json');

// Create data files and uploads directory if they don't exist
async function ensureDirectoriesAndFiles() {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Create data files if they don't exist
    try {
        await fs.access(videosFile);
    } catch {
        await fs.writeFile(videosFile, '[]');
    }

    try {
        await fs.access(photosFile);
    } catch {
        await fs.writeFile(photosFile, '[]');
    }
}

// Ensure directories and files exist
ensureDirectoriesAndFiles().catch(console.error);

// Load videos helper function
async function loadVideos() {
    try {
        const data = await fs.readFile(videosFile, 'utf8');
        const videos = JSON.parse(data || '[]');
        
        // Normalize video objects to ensure consistent fields
        return videos.map(video => ({
            ...video,
            id: video.id ? video.id.toString() : generateId(),
            createdAt: video.createdAt || video.dateAdded || new Date().toISOString(),
            views: typeof video.views === 'number' ? video.views : parseInt(video.views) || 0
        }));
    } catch (error) {
        console.error('Error loading videos:', error);
        if (error.code === 'ENOENT') {
            await fs.writeFile(videosFile, '[]', 'utf8');
            return [];
        }
        throw error;
    }
}

// Save videos helper function
async function saveVideos(videos) {
    // Ensure all required fields are present and consistent
    const normalizedVideos = videos.map(video => ({
        id: video.id.toString(),
        title: video.title,
        views: typeof video.views === 'number' ? video.views : parseInt(video.views) || 0,
        embedUrl: video.embedUrl,
        viewUrl: video.viewUrl || video.embedUrl.replace('/preview', '/view'),
        thumbnailUrl: video.thumbnailUrl || `https://drive.google.com/thumbnail?id=${video.mediaId}`,
        mediaId: video.mediaId,
        createdAt: video.createdAt || video.dateAdded || new Date().toISOString()
    }));
    
    console.log('Saving normalized videos:', normalizedVideos);
    await fs.writeFile(videosFile, JSON.stringify(normalizedVideos, null, 2), 'utf8');
}

// Load photos helper function
async function loadPhotos() {
    try {
        const data = await fs.readFile(photosFile, 'utf8');
        let photos = JSON.parse(data || '[]');
        
        // Ensure all photos have string IDs and required fields
        photos = photos.map(photo => ({
            ...photo,
            id: photo.id ? photo.id.toString() : generateId(),
            createdAt: photo.createdAt || photo.timestamp || new Date().toISOString()
        }));

        return photos;
    } catch (error) {
        console.error('Error loading photos:', error);
        if (error.code === 'ENOENT') {
            await fs.writeFile(photosFile, '[]', 'utf8');
            return [];
        }
        throw error;
    }
}

// Save photos with updated format
async function savePhotos(photos) {
    // Ensure all photos have the new format
    photos = photos.map(photo => {
        if (!photo.mediaId || !photo.urls) {
            const mediaId = extractMediaId(photo.embedUrl || photo.embedCode);
            if (mediaId) {
                return {
                    ...photo,
                    mediaId,
                    urls: {
                        view: `https://drive.google.com/file/d/${mediaId}/view`,
                        preview: `https://drive.google.com/file/d/${mediaId}/preview`
                    }
                };
            }
        }
        return photo;
    });

    await fs.writeFile(photosFile, JSON.stringify(photos, null, 2), 'utf8');
}

// Extract photo/video ID from URL or embed code
function extractMediaId(input) {
    if (!input) return null;
    input = input.trim();
    
    // Check if it's a full embed code
    if (input.includes('<iframe')) {
        const srcMatch = input.match(/src=["'](.*?)["']/);
        if (srcMatch) {
            input = srcMatch[1];
        }
    }

    // Try different URL formats
    let match;
    
    // Format: https://drive.google.com/file/d/MEDIA_ID/view
    match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Format: https://drive.google.com/uc?id=MEDIA_ID
    match = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Format: https://drive.google.com/open?id=MEDIA_ID
    match = input.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // Format: Just the media ID
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) {
        return input;
    }

    return null;
}

// Normalize Google Drive URL
function normalizeGoogleDriveUrl(input) {
    const mediaId = extractMediaId(input);
    if (!mediaId) return null;
    
    return {
        viewUrl: `https://drive.google.com/file/d/${mediaId}/view`,
        embedUrl: `https://drive.google.com/file/d/${mediaId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${mediaId}`,
        mediaId: mediaId
    };
}

// Function to generate a unique ID
function generateId() {
    return Date.now().toString();
}

// API Routes
app.get('/api/videos', async (req, res) => {
    try {
        const videos = await loadVideos();
        videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log('Sending videos to client:', videos);
        res.json(videos);
    } catch (error) {
        console.error('Error reading videos:', error);
        res.status(500).json({ error: 'Error reading videos' });
    }
});

app.get('/api/photos', async (req, res) => {
    try {
        const photos = await loadPhotos();
        photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log('Sending photos to client:', photos);
        res.json(photos);
    } catch (error) {
        console.error('Error reading photos:', error);
        res.status(500).json({ error: 'Error reading photos' });
    }
});

app.post('/api/videos', async (req, res) => {
    try {
        const { title, views, embedUrl } = req.body;
        
        // Validate required fields
        if (!title || !views || !embedUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Normalize the URL
        const normalizedUrls = normalizeGoogleDriveUrl(embedUrl);
        if (!normalizedUrls) {
            return res.status(400).json({ error: 'Invalid Google Drive URL or embed code' });
        }

        // Load existing videos
        const videos = await loadVideos();
        
        // Create new video object
        const newVideo = {
            id: generateId(),
            title: title,
            views: parseInt(views),
            embedUrl: normalizedUrls.embedUrl,
            viewUrl: normalizedUrls.viewUrl,
            thumbnailUrl: normalizedUrls.thumbnailUrl,
            mediaId: normalizedUrls.mediaId,
            createdAt: new Date().toISOString()
        };

        // Add to videos array
        videos.push(newVideo);

        // Save updated videos
        await saveVideos(videos);

        res.json(newVideo);
    } catch (error) {
        console.error('Error adding video:', error);
        res.status(500).json({ error: 'Failed to add video' });
    }
});

app.post('/api/photos', async (req, res) => {
    try {
        const { title, views, embedUrl } = req.body;
        
        // Validate required fields
        if (!title || !views || !embedUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Extract media ID from URL or embed code
        const mediaId = extractMediaId(embedUrl);
        if (!mediaId) {
            return res.status(400).json({ error: 'Invalid Google Drive URL or embed code' });
        }

        // Create URLs for different purposes
        const urls = {
            view: `https://drive.google.com/file/d/${mediaId}/view`,
            preview: `https://drive.google.com/file/d/${mediaId}/preview`,
            thumbnail: `https://drive.google.com/thumbnail?id=${mediaId}&sz=w800`,
            download: `https://drive.google.com/uc?export=download&id=${mediaId}`
        };

        // Load existing photos
        const photos = await loadPhotos();
        
        // Create new photo object
        const newPhoto = {
            id: generateId(),
            title: title.trim(),
            views: parseInt(views),
            mediaId: mediaId,
            urls: urls,
            createdAt: new Date().toISOString()
        };

        // Add to photos array
        photos.push(newPhoto);

        // Save updated photos
        await savePhotos(photos);

        res.json(newPhoto);
    } catch (error) {
        console.error('Error adding photo:', error);
        res.status(500).json({ error: 'Failed to add photo' });
    }
});

app.post('/api/photos/upload', async (req, res) => {
    console.log('POST /api/photos/upload called');
    console.log('Request body:', req.body);
    
    try {
        const { title, imageData } = req.body;
        
        if (!title || !imageData) {
            console.log('Missing required fields:', { title, hasImageData: !!imageData });
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        // Extract the base64 data
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create a unique filename
        const filename = `photo_${Date.now()}.jpg`;
        const filepath = path.join(__dirname, 'uploads', filename);

        // Save the image file
        await fs.writeFile(filepath, buffer);

        // Read existing photos
        let photos = await loadPhotos();

        // Create new photo object
        const newPhoto = {
            id: generateId(),
            title: title.trim(),
            url: `/uploads/${filename}`,
            timestamp: new Date().toISOString(),
            views: 0
        };

        // Add to beginning of array
        photos.unshift(newPhoto);

        // Save to file
        await savePhotos(photos);
        console.log('Successfully saved photo:', newPhoto);

        // Return success response
        res.json({ 
            success: true, 
            message: 'Photo saved successfully',
            photo: newPhoto
        });
    } catch (error) {
        console.error('Error saving photo:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error saving photo: ' + error.message 
        });
    }
});

// Update photo view count
app.post('/api/photos/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        const photos = await loadPhotos();
        
        const photoIndex = photos.findIndex(p => p.id === id);
        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Increment view count
        photos[photoIndex].views = (photos[photoIndex].views || 0) + 1;
        
        // Save updated photos
        await savePhotos(photos);
        
        res.json({ views: photos[photoIndex].views });
    } catch (error) {
        console.error('Error updating view count:', error);
        res.status(500).json({ error: 'Failed to update view count' });
    }
});

// Password middleware for delete operation
const checkDeletePassword = (req, res, next) => {
    const headerPassword = req.headers['x-delete-password'];
    const bodyPassword = req.body && req.body.password;
    const password = headerPassword || bodyPassword;

    if (!password || password !== '9323') {
        return res.status(401).json({ 
            error: 'Incorrect password. Delete operation requires authentication.' 
        });
    }
    
    console.log('Password correct, proceeding with delete');
    next();
};

// Delete video endpoint
app.delete('/api/videos/:id', checkDeletePassword, async (req, res) => {
    const videoId = req.params.id.toString();
    console.log(`[${new Date().toISOString()}] Delete request for video ID:`, videoId);
    
    try {
        // Load and normalize videos
        const videos = await loadVideos();
        console.log('Current videos:', videos.map(v => ({ id: v.id, title: v.title })));
        
        // Find the video to delete
        const videoToDelete = videos.find(v => v.id.toString() === videoId);
        if (!videoToDelete) {
            console.log('Video not found. Available IDs:', videos.map(v => v.id));
            return res.status(404).json({ 
                error: 'Video not found',
                requestedId: videoId,
                availableIds: videos.map(v => v.id)
            });
        }
        
        // Filter out the video
        const updatedVideos = videos.filter(v => v.id.toString() !== videoId);
        console.log('Videos count: before =', videos.length, 'after =', updatedVideos.length);
        
        // Save the normalized list
        await saveVideos(updatedVideos);
        console.log('Successfully deleted video:', videoToDelete);
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Video deleted successfully',
            deletedVideo: videoToDelete
        });
    } catch (error) {
        console.error('Error in delete video endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to delete video',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Delete photo endpoint
app.delete('/api/photos/:id', checkDeletePassword, async (req, res) => {
    const photoId = req.params.id.toString();
    console.log('Received delete request for photo ID:', photoId);
    
    try {
        // Load current photos
        let photos = await loadPhotos();
        console.log('Current photos:', photos.map(p => ({ id: p.id, title: p.title })));
        console.log('Looking for photo with ID:', photoId);
        
        // Find the photo to delete
        const photoToDelete = photos.find(p => p.id.toString() === photoId);
        if (!photoToDelete) {
            console.log('Photo not found. Available IDs:', photos.map(p => p.id));
            return res.status(404).json({ error: 'Photo not found' });
        }
        
        // Filter out the photo
        const updatedPhotos = photos.filter(p => p.id.toString() !== photoId);
        console.log('Photos count: before =', photos.length, 'after =', updatedPhotos.length);
        
        // Save the updated list
        await savePhotos(updatedPhotos);
        console.log('Successfully deleted photo:', photoToDelete);
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Photo deleted successfully',
            deletedPhoto: photoToDelete
        });
    } catch (error) {
        console.error('Error in delete photo endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to delete photo',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/photos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'photos.html'));
});

app.get('/add_photo.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'add_photo.html'));
});

app.get('/add_video.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'add_video.html'));
});

app.get('/photo_viewer.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'photo_viewer.html'));
});

app.get('/video_player.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'video_player.html'));
});

// Server configuration
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`Server started at ${new Date().toISOString()}`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log('='.repeat(50));
}).on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
