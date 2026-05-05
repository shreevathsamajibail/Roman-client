
export interface ContentPrompt {
  id: string;
  name: string;
  content: string;
}

export interface StylePrompt {
  id: string;
  name: string;
  content: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  timestamp: number;
  logoUrl?: string;
  systemPromptId?: string; // Content prompt
  stylePromptId?: string;  // Image style prompt
}

export interface ImageFile {
  id: string;
  assetId?: number;
  url: string;
  prompt: string;
  timestamp: number;
  folderId: string | null;
  overlayText?: string;
  fbDescription?: string;
  isCompleted?: boolean;
}

export interface Manifest {
  images: ImageFile[];
  folders: Folder[];
  contentPrompts?: ContentPrompt[];
  stylePrompts?: StylePrompt[];
}
