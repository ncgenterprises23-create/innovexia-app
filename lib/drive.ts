import { google } from 'googleapis';
import { Readable } from 'stream';
import { getGoogleDriveClient as getOAuthDriveClient } from './oauth';

// Google Drive folder IDs for different features
export const GOOGLE_DRIVE_FOLDERS = {
  DELEGATION_DOCS: '1VE5RZ-9pOO1VBTrErBmnaaW2664Z5nDQ',
  USER_IMAGES: '1hgx7Na2C49OWr9zD1vcA3TcFhaTx19T-',
  CHAT_DOCS: '1pTqk7Xhe5GgObe327nGT7U22xkL3KWnB',
  CHECKLIST_ATTACHMENTS: '1avQ12kObGYLjWasZfCNteA0g89vCHrA2',
  ORDERS: '1SQjykvSQbG_xYYOoAxNn1NLFnv8yNQhi',
};

// Default folder (delegation)
export const GOOGLE_DRIVE_FOLDER_ID = GOOGLE_DRIVE_FOLDERS.DELEGATION_DOCS;

// Initialize Google Drive API client with OAuth
export async function getGoogleDriveClient() {
  return await getOAuthDriveClient();
}

// Upload file to Google Drive
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string = GOOGLE_DRIVE_FOLDERS.DELEGATION_DOCS
): Promise<{
  fileId: string;
  publicUrl: string;
  downloadUrl: string;
  fileName: string;
}> {
  try {

    const drive = await getGoogleDriveClient();

    // Convert buffer to readable stream
    const stream = Readable.from(buffer);

    // Upload file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true, // Support for shared drives
    });

    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true, // Support for shared drives
    });

    const fileId = response.data.id!;

    // Use different URL formats based on file type
    // Thumbnail URL for images, direct view URL for audio/video and documents
    let publicUrl: string;
    if (mimeType.startsWith('image/')) {
      publicUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    } else {
      // For documents and other files
      publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      fileId,
      publicUrl,
      downloadUrl,
      fileName: response.data.name!,
    };
  } catch (error: any) {
    console.error('Error uploading to Google Drive:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.code === 403) {
      throw new Error('Permission denied. Service account does not have access to the folder. Please add sohan-595@clean-yew-483214-s7.iam.gserviceaccount.com as Editor to folder: ' + folderId);
    } else if (error.code === 404) {
      throw new Error('Folder not found: ' + folderId + '. Please verify the folder ID is correct.');
    }

    throw new Error('Google Drive upload failed: ' + (error.message || String(error)));
  }
}

// Delete file from Google Drive
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    const drive = await getGoogleDriveClient();
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true, // Support for shared drives
    });
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    throw error;
  }
}

// List files in a folder
export async function listDriveFiles(folderId: string = GOOGLE_DRIVE_FOLDERS.DELEGATION_DOCS): Promise<any[]> {
  try {
    const drive = await getGoogleDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, createdTime, size, webViewLink)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true, // Support for shared drives
      includeItemsFromAllDrives: true, // Include files from shared drives
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error listing Drive files:', error);
    throw error;
  }
}

// Get file metadata by ID
export async function getFileMetadata(fileId: string): Promise<any> {
  try {
    const drive = await getGoogleDriveClient();
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink',
      supportsAllDrives: true,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw error;
  }
}

// Update file (replace content)
export async function updateFile(
  fileId: string,
  buffer: Buffer,
  mimeType: string
): Promise<any> {
  try {
    const drive = await getGoogleDriveClient();
    const stream = Readable.from(buffer);

    const response = await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    return response.data;
  } catch (error) {
    console.error('Error updating file:', error);
    throw error;
  }
}

// Copy file
export async function copyFile(
  fileId: string,
  newName: string,
  destinationFolderId?: string
): Promise<any> {
  try {
    const drive = await getGoogleDriveClient();
    const response = await drive.files.copy({
      fileId: fileId,
      requestBody: {
        name: newName,
        ...(destinationFolderId && { parents: [destinationFolderId] }),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    return response.data;
  } catch (error) {
    console.error('Error copying file:', error);
    throw error;
  }
}

// Move file to trash (soft delete)
export async function trashFile(fileId: string): Promise<void> {
  try {
    const drive = await getGoogleDriveClient();
    await drive.files.update({
      fileId: fileId,
      requestBody: {
        trashed: true,
      },
      supportsAllDrives: true,
    });
  } catch (error) {
    console.error('Error trashing file:', error);
    throw error;
  }
}

// Download file content
export async function downloadFile(fileId: string): Promise<Buffer> {
  try {
    const drive = await getGoogleDriveClient();
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'arraybuffer' }
    );

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
