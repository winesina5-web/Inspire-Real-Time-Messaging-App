import { useState } from 'react';
import { workerApi, UploadMediaResponse } from '../lib/workerApi';
import { MessageType } from '../types';
import { validateMediaUpload } from '../utils/helpers';

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadMedia = async (
    file: File | Blob,
    type: MessageType | 'avatar',
    filename?: string
  ): Promise<UploadMediaResponse | null> => {
    setError(null);
    const validation = validateMediaUpload(type, file.size);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return null;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      setUploadProgress(60);
      const res = await workerApi.uploadMedia(file, type, filename);
      setUploadProgress(100);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const resolveDownloadUrl = async (objectKey: string): Promise<string> => {
    return await workerApi.getDownloadUrl(objectKey);
  };

  return {
    uploadMedia,
    resolveDownloadUrl,
    isUploading,
    uploadProgress,
    error,
  };
}
