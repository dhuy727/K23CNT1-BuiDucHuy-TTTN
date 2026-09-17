import React from 'react';
import {
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  File
} from 'lucide-react';

const FileIcon = ({ mimeType = '', extension = '', size = 24, className = '' }) => {
  const ext = (extension || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <Image size={size} className={className} style={{ color: '#06b6d4' }} />;
  }

  if (mime.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Film size={size} className={className} style={{ color: '#ec4899' }} />;
  }

  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <Music size={size} className={className} style={{ color: '#8b5cf6' }} />;
  }

  if (mime.includes('pdf') || ext === 'pdf') {
    return <FileText size={size} className={className} style={{ color: '#ef4444' }} />;
  }

  if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={size} className={className} style={{ color: '#10b981' }} />;
  }

  if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
    return <Presentation size={size} className={className} style={{ color: '#f59e0b' }} />;
  }

  if (mime.includes('zip') || mime.includes('tar') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive size={size} className={className} style={{ color: '#f97316' }} />;
  }

  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp'].includes(ext)) {
    return <Code size={size} className={className} style={{ color: '#3b82f6' }} />;
  }

  return <File size={size} className={className} style={{ color: '#64748b' }} />;
};

export default FileIcon;
