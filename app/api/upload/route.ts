import { NextRequest, NextResponse } from 'next/server';
import { uploadToDrive, GOOGLE_DRIVE_FOLDERS } from '@/lib/drive';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
const DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALL_TYPES = [...IMAGE_TYPES, ...AUDIO_TYPES, ...DOC_TYPES];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('type') as string || 'delegation'; // delegation, user, chat

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    // Allowing all file types as per user request
    // if (!ALL_TYPES.includes(file.type)) {
    //   console.error('Invalid file type:', file.type);
    //   return NextResponse.json(
    //     { error: 'Invalid file type. Allowed: images, audio, pdf/doc' },
    //     { status: 400 }
    //   );
    // }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Determine which folder to use based on upload type
    let folderId = GOOGLE_DRIVE_FOLDERS.DELEGATION_DOCS; // default

    if (uploadType === 'user' || uploadType === 'user_image') {
      folderId = GOOGLE_DRIVE_FOLDERS.USER_IMAGES;
    } else if (uploadType === 'chat' || uploadType === 'chat_doc') {
      folderId = GOOGLE_DRIVE_FOLDERS.CHAT_DOCS;
    } else if (uploadType === 'delegation' || uploadType === 'delegation_doc') {
      folderId = GOOGLE_DRIVE_FOLDERS.DELEGATION_DOCS;
    } else if (uploadType === 'checklist' || uploadType === 'checklist_attachment') {
      folderId = GOOGLE_DRIVE_FOLDERS.CHECKLIST_ATTACHMENTS;
    } else if (uploadType === 'order' || uploadType === 'inventory') {
      folderId = GOOGLE_DRIVE_FOLDERS.ORDERS;
    } else if (uploadType === 'dealer_kit') {
      folderId = GOOGLE_DRIVE_FOLDERS.DEALER_KIT;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${originalName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Google Drive
    const result = await uploadToDrive(buffer, fileName, file.type, folderId);

    return NextResponse.json({
      success: true,
      url: result.publicUrl,
      downloadUrl: result.downloadUrl,
      fileId: result.fileId,
      fileName: result.fileName,
      mimeType: file.type,
      uploadType: uploadType,
      message: 'File uploaded successfully to Google Drive'
    });

  } catch (error: any) {
    console.error('Error uploading file to Google Drive:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Failed to upload file to Google Drive',
        details: error.message || String(error),
        hint: 'Please ensure the service account has been added to the Google Drive folders with Editor permissions'
      },
      { status: 500 }
    );
  }
}
