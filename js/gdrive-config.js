// Google Drive API configuration
const GOOGLE_DRIVE_CONFIG = {
    API_KEY: 'YOUR_API_KEY',
    CLIENT_ID: 'YOUR_CLIENT_ID',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    FOLDER_NAME: 'KambhariGallery'
};

let gdriveAuth = null;
let gdriveFolder = null;

// Initialize Google Drive API
function initGDrive() {
    return new Promise((resolve, reject) => {
        gapi.load('client:auth2', async () => {
            try {
                await gapi.client.init({
                    apiKey: GOOGLE_DRIVE_CONFIG.API_KEY,
                    clientId: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
                    scope: GOOGLE_DRIVE_CONFIG.SCOPES
                });

                gdriveAuth = gapi.auth2.getAuthInstance();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Sign in to Google Drive
async function signInToGDrive() {
    if (!gdriveAuth.isSignedIn.get()) {
        await gdriveAuth.signIn();
    }
}

// Create or get the app folder
async function getAppFolder() {
    if (gdriveFolder) return gdriveFolder;

    // Search for existing folder
    const response = await gapi.client.drive.files.list({
        q: `name='${GOOGLE_DRIVE_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)'
    });

    if (response.result.files.length > 0) {
        gdriveFolder = response.result.files[0].id;
    } else {
        // Create new folder
        const fileMetadata = {
            name: GOOGLE_DRIVE_CONFIG.FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        gdriveFolder = folder.result.id;
    }

    return gdriveFolder;
}

// Upload file to Google Drive
async function uploadToGDrive(file, fileName, type) {
    const folderId = await getAppFolder();
    
    const metadata = {
        name: fileName,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const upload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
        body: form
    });

    const response = await upload.json();
    return response.id;
}

// Delete file from Google Drive
async function deleteFromGDrive(fileId) {
    await gapi.client.drive.files.delete({
        fileId: fileId
    });
}
