import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  Send,
  Loader2,
  Maximize2,
  Github,
  Cloud,
  CloudOff,
  FolderOpen,
  FolderPlus,
  Folder as FolderIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  ArrowLeft,
  LayoutGrid,
  Layers,
  ClipboardCheck,
  Link as LinkIcon,
  ImagePlus,
  FileText,
  Settings,
  X,
  Check
} from 'lucide-react';
import * as github from './services/githubService';
import { Folder, ImageFile, Manifest, ContentPrompt, StylePrompt } from './types';

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [contentPrompts, setContentPrompts] = useState<ContentPrompt[]>([]);
  const [stylePrompts, setStylePrompts] = useState<StylePrompt[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [showGallery, setShowGallery] = useState(true);
  const [imagePrompt, setImagePrompt] = useState("");
  const [bulkCount, setBulkCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [fileLibrary, setFileLibrary] = useState<{name: string, data: string[]}[]>(() => {
    const saved = localStorage.getItem('neural_file_library');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [showFileLibrary, setShowFileLibrary] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('neural_file_library', JSON.stringify(fileLibrary));
  }, [fileLibrary]);
  
  const [dataSource, setDataSource] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [systemPromptName, setSystemPromptName] = useState("");
  const [systemPromptContent, setSystemPromptContent] = useState("");
  
  const [stylePromptName, setStylePromptName] = useState("");
  const [stylePromptContent, setStylePromptContent] = useState("");

  const createContentPrompt = () => {
    if (!systemPromptName.trim() || !systemPromptContent.trim()) return;
    const newPrompt: ContentPrompt = {
      id: Math.random().toString(36).substring(7),
      name: systemPromptName.trim(),
      content: systemPromptContent.trim(),
    };
    const updated = [...contentPrompts, newPrompt];
    setContentPrompts(updated);
    saveToGithub(images, folders, updated, stylePrompts);
    setSystemPromptName("");
    setSystemPromptContent("");
  };

  const createStylePrompt = () => {
    if (!stylePromptName.trim() || !stylePromptContent.trim()) return;
    const newPrompt: StylePrompt = {
      id: Math.random().toString(36).substring(7),
      name: stylePromptName.trim(),
      content: stylePromptContent.trim(),
    };
    const updated = [...stylePrompts, newPrompt];
    setStylePrompts(updated);
    saveToGithub(images, folders, contentPrompts, updated);
    setStylePromptName("");
    setStylePromptContent("");
  };

  const deleteContentPrompt = (id: string) => {
    const updated = contentPrompts.filter(p => p.id !== id);
    setContentPrompts(updated);
    saveToGithub(images, folders, updated, stylePrompts);
  };

  const deleteStylePrompt = (id: string) => {
    const updated = stylePrompts.filter(p => p.id !== id);
    setStylePrompts(updated);
    saveToGithub(images, folders, contentPrompts, updated);
  };

  const linkFolderToContentPrompt = (folderId: string, promptId: string) => {
    const updated = folders.map(f => f.id === folderId ? { ...f, systemPromptId: promptId } : f);
    setFolders(updated);
    saveToGithub(images, updated, contentPrompts, stylePrompts);
  };

  const linkFolderToStylePrompt = (folderId: string, promptId: string) => {
    const updated = folders.map(f => f.id === folderId ? { ...f, stylePromptId: promptId } : f);
    setFolders(updated);
    saveToGithub(images, updated, contentPrompts, stylePrompts);
  };

  const [githubConfig, setGithubConfig] = useState({
    isConnected: false,
    releaseId: null as number | null,
    manifestAssetId: null as number | null
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const githubConfigRef = useRef(githubConfig);

  const aiRef = useRef<GoogleGenAI | null>(null);

  // Initialize AI
  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }, []);

  // Initialize GitHub
  useEffect(() => {
    async function initGithub() {
      const env = (import.meta as any).env;
      const owner = env.VITE_GITHUB_REPO_OWNER;
      const repo = env.VITE_GITHUB_REPO_NAME;
      const proxy = env.VITE_GITHUB_PROXY_URL;

      if (!owner || !repo || !proxy) {
        console.warn("GitHub configuration missing in .env");
        return;
      }
      
      setIsSyncing(true);
      try {
        const release = await github.getRelease();
        const manifestAsset = release.assets.find(a => a.name === 'manifest.json');
        
        let initialData: Manifest = { images: [], folders: [] };
        if (manifestAsset) {
          const response = await fetch(manifestAsset.browser_download_url);
          if (response.ok) {
            initialData = await response.json();
          }
        }

        setImages(initialData.images || []);
        setFolders(initialData.folders || []);
        setContentPrompts(initialData.contentPrompts || []);
        setStylePrompts(initialData.stylePrompts || []);
        setGithubConfig({
          isConnected: true,
          releaseId: release.id,
          manifestAssetId: manifestAsset?.id || null
        });
      } catch (err) {
        console.error("GitHub Sync Failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    initGithub();
  }, []);

  const saveToGithub = async (
    updatedImages: ImageFile[], 
    updatedFolders: Folder[], 
    updatedContentPrompts: ContentPrompt[] = contentPrompts,
    updatedStylePrompts: StylePrompt[] = stylePrompts
  ) => {
    if (!githubConfig.isConnected || githubConfig.releaseId === null) return;
    try {
      const manifest: Manifest = { 
        images: updatedImages, 
        folders: updatedFolders, 
        contentPrompts: updatedContentPrompts,
        stylePrompts: updatedStylePrompts
      };
      const manifestAsset = await github.updateManifest(
        manifest, 
        githubConfig.releaseId, 
        githubConfig.manifestAssetId || undefined
      );
      setGithubConfig(prev => ({ ...prev, manifestAssetId: manifestAsset.id }));
    } catch (err) {
      console.error("Failed to sync manifest:", err);
    }
  };

  const compositeLogo = (base64Img: string, logoUrl?: string, overlayText?: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Overlay Height is ~20% for text
        const overlayHeight = overlayText ? Math.round(img.height * 0.22) : 0;
        canvas.width = img.width;
        canvas.height = img.height + overlayHeight;
        
        if (!ctx) return resolve(base64Img);

        // Draw Black Base
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw main image (1:1 portion)
        ctx.drawImage(img, 0, 0);
        
        // Draw Logo if exists (Top Right)
        const finalize = () => {
          if (overlayText) {
            drawOverlayText(ctx, canvas.width, canvas.height, overlayHeight, overlayText);
          }
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        };

        if (logoUrl) {
          const logo = new Image();
          logo.crossOrigin = "anonymous";
          logo.onload = () => {
            const logoSize = Math.min(img.width, img.height) * 0.12;
            const padding = img.width * 0.04;
            // Draw subtle drop shadow for logo visibility
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.drawImage(logo, img.width - logoSize - padding, padding, logoSize, logoSize);
            ctx.shadowBlur = 0;
            finalize();
          };
          logo.onerror = finalize;
          logo.src = logoUrl;
        } else {
          finalize();
        }
      };
      img.onerror = () => resolve(base64Img);
      img.src = `data:image/png;base64,${base64Img}`;
    });
  };

  const drawOverlayText = (ctx: CanvasRenderingContext2D, width: number, height: number, overlayHeight: number, text: string) => {
    // Solid Deep Black Base - Ensure it's large enough for the text
    const increasedOverlayHeight = Math.round(overlayHeight * 1.5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, height - increasedOverlayHeight, width, increasedOverlayHeight);
    
    if (!text) return;

    // Professional White Neutral BOLD Typography (Non-italic)
    let fontSize = Math.round(increasedOverlayHeight * 0.12);
    ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const words = text.split(' ');
    const maxWidth = width * 0.94;
    
    // Simple wrapping and scaling if needed
    const getLines = (fSize: number) => {
      ctx.font = `bold ${fSize}px "Inter", sans-serif`;
      const result: string[][] = [];
      let currentLine: string[] = [];
      words.forEach(word => {
        const testLine = [...currentLine, word].join(' ');
        if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
          result.push(currentLine);
          currentLine = [word];
        } else {
          currentLine.push(word);
        }
      });
      result.push(currentLine);
      return result;
    };

    let lines = getLines(fontSize);
    let totalTextHeight = lines.length * (fontSize * 1.4);

    // Scale down if text is too tall for the overlay
    while (totalTextHeight > increasedOverlayHeight * 0.85 && fontSize > 10) {
      fontSize -= 1;
      lines = getLines(fontSize);
      totalTextHeight = lines.length * (fontSize * 1.4);
    }

    const startY = (height - increasedOverlayHeight) + (increasedOverlayHeight / 2) - (totalTextHeight / 2) + (fontSize * 0.7);

    ctx.fillStyle = '#ffffff';
    lines.forEach((lineWords, lineIndex) => {
      const lineText = lineWords.join(' ');
      const y = startY + (lineIndex * fontSize * 1.4);
      ctx.fillText(lineText, width / 2, y);
    });
  };

  const toggleImageCompletion = (id: string, forceValue?: boolean) => {
    const updated = images.map(img => img.id === id ? { ...img, isCompleted: forceValue !== undefined ? forceValue : !img.isCompleted } : img);
    setImages(updated);
    saveToGithub(updated, folders);
    if (selectedImage?.id === id) {
      setSelectedImage(prev => prev ? { ...prev, isCompleted: forceValue !== undefined ? forceValue : !prev.isCompleted } : null);
    }
  };

  const copyImageToClipboard = async (img: ImageFile) => {
    try {
      setCopyingId(img.id);
      const response = await fetch(img.url);
      const blob = await response.blob();
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const tempImg = new Image();
      tempImg.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        tempImg.onload = () => {
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          ctx?.drawImage(tempImg, 0, 0);
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const data = [
                new ClipboardItem({
                  'image/png': pngBlob,
                  'text/plain': new Blob([img.fbDescription || img.prompt], { type: 'text/plain' }),
                })
              ];
              navigator.clipboard.write(data).then(resolve).catch(reject);
            } else reject();
          }, 'image/png');
        };
        tempImg.onerror = reject;
        tempImg.src = img.url;
      });

      // Auto-set completion
      if (!img.isCompleted) {
        toggleImageCompletion(img.id, true);
      }

      // Visual feedback
      setTimeout(() => setCopyingId(null), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      // Fallback
      try {
        await navigator.clipboard.writeText(img.fbDescription || img.prompt);
        if (!img.isCompleted) toggleImageCompletion(img.id, true);
      } catch (e) {}
      setCopyingId(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentFolderId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const updatedFolders = folders.map(f => f.id === currentFolderId ? { ...f, logoUrl: dataUrl } : f);
      setFolders(updatedFolders);
      saveToGithub(images, updatedFolders);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    let rows: string[] = [];
    
    const saveToLibrary = (name: string, data: string[]) => {
      const newEntry = { name, data };
      setFileLibrary(prev => [newEntry, ...prev]);
      setDataSource(data);
      setActiveFileIndex(0);
    };

    try {
      if (extension === 'csv') {
        const text = await file.text();
        Papa.parse(text, {
          complete: (results) => {
            rows = results.data.map((row: any) => Object.values(row).join(' ')).filter(r => r.trim());
            saveToLibrary(file.name, rows);
          }
        });
      } else if (extension === 'xlsx' || extension === 'xls') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          rows = data.map((row: any) => row.join(' ')).filter(r => r.trim());
          saveToLibrary(file.name, rows);
        };
        reader.readAsBinaryString(file);
      } else {
        const text = await file.text();
        rows = text.split('\n').filter(r => r.trim());
        saveToLibrary(file.name, rows);
      }
    } catch (err) {
      console.error("File upload failed:", err);
      alert("Encryption error: Could not process the data matrix.");
    }
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;

    const newFolder: Folder = {
      id: Math.random().toString(36).substring(7),
      name: newFolderName.trim(),
      parentId: currentFolderId,
      timestamp: Date.now()
    };

    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    saveToGithub(images, updatedFolders);
    setNewFolderName("");
    setShowFolderModal(false);
  };

  const deleteFolder = (id: string) => {
    if (!confirm("Delete this folder and all its contents?")) return;
    
    const foldersToDelete = new Set([id]);
    const findChildren = (pid: string) => {
      folders.forEach(f => {
        if (f.parentId === pid) {
          foldersToDelete.add(f.id);
          findChildren(f.id);
        }
      });
    };
    findChildren(id);

    const updatedFolders = folders.filter(f => !foldersToDelete.has(f.id));
    const imagesInDeletedFolders = images.filter(img => img.folderId && foldersToDelete.has(img.folderId));
    
    imagesInDeletedFolders.forEach(img => {
      if (img.assetId) github.deleteAsset(img.assetId);
    });

    const updatedImages = images.filter(img => !img.folderId || !foldersToDelete.has(img.folderId));
    
    setFolders(updatedFolders);
    setImages(updatedImages);
    saveToGithub(updatedImages, updatedFolders);
  };

  const generateImage = async (e?: React.FormEvent, isBulk = false) => {
    e?.preventDefault();
    const isDataMode = dataSource.length > 0;
    if ((!imagePrompt.trim() && !isDataMode) || isLoading) return;

    setIsLoading(true);
    const count = isBulk ? bulkCount : 1;
    setProgress({ current: 0, total: count });
    
    const currentPrompt = imagePrompt;
    setImagePrompt(""); // Clear for better mobile UX
    
    const newGeneratedImages: ImageFile[] = [];

    try {
      if (!aiRef.current) throw new Error("AI Controller missing. Please check API configuration.");

      const currentFolder = folders.find(f => f.id === currentFolderId);
      const linkedContentPrompt = contentPrompts.find(p => p.id === currentFolder?.systemPromptId);
      const linkedStylePrompt = stylePrompts.find(p => p.id === currentFolder?.stylePromptId);
      
      const systemPrompt = linkedContentPrompt?.content || "";
      const imageSystemPrompt = linkedStylePrompt?.content || "";

      for (let i = 0; i < count; i++) {
        try {
          setProgress(prev => ({ ...prev, current: i + 1 }));
          
          // Pick a DIFFERENT random row for every iteration
          let sourceText = currentPrompt;
          if (dataSource.length > 0) {
            const randomIndex = Math.floor(Math.random() * dataSource.length);
            sourceText = dataSource[randomIndex];
            console.log(`Processing Row ${randomIndex}: ${sourceText.substring(0, 30)}...`);
          }

        // Use Gemini to generate the specialized metadata
        const metadataResult = await aiRef.current.models.generateContent({
          model: "gemini-flash-latest",
          contents: [
            { role: 'user', parts: [
              { text: `System Instructions: ${systemPrompt}` },
              { text: `Image Style Guide: ${imageSystemPrompt}` },
              { text: `Source Context: ${sourceText}` },
              { text: `You are a professional historical artist and classical art historian. Based on the source context and style guide, generate exactly 3 items:
              1. imagePrompt: A 4K HYPER-REALISTIC HISTORICAL prompt. MANDATORY STYLE: Photorealistic historical realism, cinematic 8k resolution, authentic textures and period-accurate lighting. Style of a high-end history channel documentary visual or hyper-detailed historical museum exhibit. NO digital graphics, NO flat colors, NO simple paintings. Focus on historical gravitas and photorealistic fine detail (max 40 words).
              2. overlay: A concise, powerful, and inspirational text for a visual overlay. It MUST be exactly 28 words long.
              3. fbDescription: A compelling, long-form Facebook post description (approx. 200 words) with professional formatting. NO EMOJIS ALLOWED.
              Return ONLY JSON: { "imagePrompt": "...", "overlay": "...", "fbDescription": "..." }` }
            ]}
          ],
          config: { responseMimeType: "application/json" }
        });
      
      let metadata = { imagePrompt: sourceText, overlay: "", fbDescription: "" };
      try {
        const text = metadataResult.text || "";
        metadata = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse Gemini metadata, using defaults", e);
      }

      const imageResult = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: `High-quality 1:1 artistic image: ${metadata.imagePrompt}` }] }],
        config: { imageConfig: { aspectRatio: "1:1" } }
      });

      let base64Data = "";
      const imageCandidate = imageResult.candidates?.[0];
      const imagePart = imageCandidate?.content?.parts?.find(p => 'inlineData' in p);
      if (imagePart && 'inlineData' in imagePart && imagePart.inlineData) {
        base64Data = imagePart.inlineData.data;
      }

        if (base64Data) {
          // Apply Watermark and Overlay
          base64Data = await compositeLogo(base64Data, currentFolder?.logoUrl, metadata.overlay);

          const id = Math.random().toString(36).substring(7);
          const fileName = `img-${id}.png`;
          
          const res = await fetch(`data:image/png;base64,${base64Data}`);
          const blob = await res.blob();

          let githubUrl = `data:image/png;base64,${base64Data}`;
          let assetId: number | undefined;

          if (githubConfig.isConnected && githubConfig.releaseId !== null) {
            try {
              const asset = await github.uploadAsset(fileName, blob, githubConfig.releaseId);
              githubUrl = asset.browser_download_url;
              assetId = asset.id;
            } catch (err) {
              console.error("GitHub Upload failed:", err);
            }
          }

          newGeneratedImages.push({
            id,
            assetId,
            url: githubUrl,
            prompt: metadata.imagePrompt,
            timestamp: Date.now(),
            folderId: currentFolderId,
            overlayText: metadata.overlay,
            fbDescription: metadata.fbDescription
          });
        } else {
          console.error("No image data received from model", imageResult);
          if (count === 1) alert("Neural Core Error: No visual data was synthesized.");
        }
        } catch (err) {
          console.error("Individual generation step failed:", err);
          if (count === 1) alert("Neural Failure: " + (err instanceof Error ? err.message : String(err)));
        }
      }

      if (newGeneratedImages.length > 0) {
        const updatedImages = [...newGeneratedImages, ...images];
        setImages(updatedImages);
        if (isBulk) setImagePrompt("");
        saveToGithub(updatedImages, folders);
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("Neural core failure: " + (error instanceof Error ? error.message : "Quota exceeded or connection lost."));
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const deleteImage = async (id: string) => {
    const imgToDelete = images.find(img => img.id === id);
    if (!imgToDelete) return;

    if (imgToDelete.assetId) {
      try {
        await github.deleteAsset(imgToDelete.assetId);
      } catch (err) {
        console.error("Failed to delete asset:", err);
      }
    }

    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    if (selectedImage?.id === id) setSelectedImage(null);
    saveToGithub(updatedImages, folders);
  };

  const downloadImage = (img: ImageFile) => {
    const link = document.createElement("a");
    link.href = img.url;
    link.download = `image-studio-${img.id}.png`;
    link.click();
  };

  const currentFolders = useMemo(() => 
    folders.filter(f => f.parentId === currentFolderId),
  [folders, currentFolderId]);

  const currentImagesByDate = useMemo(() => {
    const imagesInFolder = images.filter(img => img.folderId === currentFolderId);
    const groups: { [date: string]: ImageFile[] } = {};
    imagesInFolder.forEach(img => {
      const d = new Date(img.timestamp);
      const isToday = new Date().toDateString() === d.toDateString();
      const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
      
      let dateStr = d.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });

      if (isToday) dateStr = `TODAY`;
      else if (isYesterday) dateStr = `YESTERDAY`;
      else dateStr = dateStr.toUpperCase();

      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(img);
    });
    return Object.entries(groups).sort((a, b) => 
      new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime()
    );
  }, [images, currentFolderId]);

  const breadcrumbs = useMemo(() => {
    const trail: Folder[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    while (current) {
      trail.unshift(current);
      current = folders.find(f => f.id === current.parentId);
    }
    return trail;
  }, [folders, currentFolderId]);

  return (
    <div className="h-[100svh] w-full flex flex-col font-sans bg-[#030303] text-zinc-300 relative overflow-hidden">
      <div className="atmosphere" />

      {/* Responsive Header */}
      <header className="flex-none z-50 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 backdrop-blur-3xl">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => { setCurrentFolderId(null); setShowGallery(true); }}
        >
          <div className="w-8 h-8 glass-card flex items-center justify-center bg-white/5">
            <Layers size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase italic leading-none">Studio Drive</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
               <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest font-bold">
                 {githubConfig.isConnected ? "Cloud" : "Local"}
               </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {currentFolderId && (
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                <FolderOpen size={12} className="text-zinc-500" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase truncate max-w-[100px]">
                  {folders.find(f => f.id === currentFolderId)?.name}
                </span>
             </div>
           )}
           <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
              <button 
                onClick={() => setShowGallery(true)}
                className={`p-1.5 rounded-md transition-all ${showGallery ? 'bg-white text-black' : 'text-zinc-600'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button 
                onClick={() => setShowGallery(false)}
                className={`p-1.5 rounded-md transition-all ${!showGallery ? 'bg-white text-black' : 'text-zinc-600'}`}
              >
                <Sparkles size={14} />
              </button>
           </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        
        {/* Header Bar */}
        <div className="flex-none px-4 py-2 sm:px-6 sm:py-3 bg-black/40 backdrop-blur-3xl border-b border-white/5 flex items-center justify-between z-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <h1 className="text-xs sm:text-lg font-bold tracking-tighter italic uppercase text-white shrink-0">Neural Core</h1>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[100px] sm:max-w-none">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className={`text-[6px] sm:text-[8px] font-mono uppercase tracking-widest px-2 py-1 rounded border ${currentFolderId === null ? 'bg-white text-black border-white' : 'border-white/5 text-zinc-600 hover:text-white'}`}
              >
                Root
              </button>
              {breadcrumbs.map((f) => (
                <button 
                  key={f.id}
                  onClick={() => setCurrentFolderId(f.id)}
                  className={`text-[6px] sm:text-[8px] font-mono uppercase tracking-widest px-2 py-1 rounded border whitespace-nowrap ${currentFolderId === f.id ? 'bg-white text-black border-white' : 'border-white/5 text-zinc-600 hover:text-white'}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentFolderId && (
              <>
                <div className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors cursor-pointer" onClick={() => setShowPromptModal(true)}>
                  <Settings size={12} />
                  <span className="text-[7px] font-mono uppercase hidden xs:block">Config</span>
                </div>
                <button 
                  onClick={() => logoInputRef.current?.click()}
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/5 border border-white/10 p-0.5 flex items-center justify-center overflow-hidden"
                >
                  {folders.find(f => f.id === currentFolderId)?.logoUrl ? (
                    <img src={folders.find(f => f.id === currentFolderId)?.logoUrl} className="w-full h-full object-contain" alt="Logo" />
                  ) : (
                    <ImagePlus size={12} className="text-zinc-600" />
                  )}
                </button>
              </>
            )}
            <button 
              onClick={() => setShowFolderModal(true)}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-500/10 text-emerald-500 rounded-lg text-[7px] sm:text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
            >
              Sector+
            </button>
          </div>
        </div>

        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileUpload} />

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide no-scrollbar ${currentFolderId ? 'pb-32' : 'pb-6'}`}>
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {!currentFolderId ? (
                folders.filter(f => !f.parentId).length === 0 ? (
                   <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <FolderPlus size={40} className="text-emerald-500" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-2xl font-bold tracking-tighter text-white uppercase italic">Neural Void</h2>
                      <p className="text-zinc-500 max-w-xs mx-auto text-xs font-mono uppercase tracking-widest">Initialize a Sector to begin synchronization</p>
                    </div>
                    <button 
                      onClick={() => setShowFolderModal(true)}
                      className="px-8 py-3 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-[10px] hover:scale-105 transition-transform shadow-xl"
                    >
                      Initialize System Sector
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="root-folders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {folders.filter(f => !f.parentId).map(folder => (
                      <div 
                        key={folder.id} 
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="group relative aspect-square bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all overflow-hidden"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                          {folder.logoUrl ? <img src={folder.logoUrl} className="w-10 h-10 object-contain" alt="" /> : <FolderIcon size={32} className="text-zinc-600" />}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest text-center">{folder.name}</span>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setShowFolderModal(true)}
                      className="aspect-square border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3 text-zinc-600 hover:text-white hover:border-white/30 transition-all font-mono text-[8px] uppercase tracking-widest"
                    >
                      <Plus size={24} />
                      New Sector
                    </button>
                  </motion.div>
                )
              ) : (
                showGallery ? (
                <motion.div 
                  key="gallery" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {/* Directories Section - Compact and subtle */}
                  {currentFolders.length > 0 && (
                    <section className="space-y-2">
                       <div className="flex items-center gap-2 px-2">
                          <FolderOpen size={10} className="text-zinc-700" />
                          <h3 className="font-mono text-[7px] tracking-[0.2em] uppercase text-zinc-700 font-bold">Sub-Sectors</h3>
                          <div className="flex-1 h-px bg-white/5" />
                       </div>
                       <div className="flex flex-wrap gap-1.5 px-1">
                          {currentFolders.map(folder => (
                             <button 
                                key={folder.id} 
                                onClick={() => setCurrentFolderId(folder.id)}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.05] transition-all flex items-center gap-2 group"
                             >
                                <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase font-mono tracking-wider">{folder.name}</span>
                                <ChevronRight size={10} className="text-zinc-800" />
                             </button>
                          ))}
                       </div>
                    </section>
                  )}

                  {/* Grouped Images Section */}
                  {currentImagesByDate.length > 0 ? (
                    currentImagesByDate.map(([date, imgs]) => (
                      <section key={date} className="space-y-2">
                        <div className="sticky top-0 z-20 py-2 bg-[#030303]/60 backdrop-blur-xl flex items-center gap-3">
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em] font-black">{date}</span>
                          <div className="flex-1 h-[1px] bg-white/[0.03]" />
                          <span className="text-[7px] font-mono text-zinc-800 uppercase tracking-widest">{imgs.length} UNITS</span>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 sm:gap-2">
                          {imgs.map((img) => (
                            <motion.div 
                              key={img.id} 
                              layout 
                              onClick={() => setSelectedImage(img)}
                              className="group relative aspect-[4/5] bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all cursor-pointer"
                            >
                              <img 
                                src={img.url} 
                                alt={img.prompt} 
                                className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${img.isCompleted ? 'opacity-30 grayscale' : ''}`} 
                                referrerPolicy="no-referrer"
                              />
                              
                              {/* Completion Tick Indicator */}
                              {img.isCompleted && (
                                <div className="absolute top-2 left-2 z-10 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                                  <Check size={12} className="text-black font-extrabold" />
                                </div>
                              )}

                              {/* Hover Metadata Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                 <p className="text-[9px] text-zinc-300 line-clamp-2 leading-relaxed font-light italic mb-3">
                                   {img.fbDescription || img.prompt}
                                 </p>
                                 <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                    <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-black">
                                      {img.isCompleted ? 'ARCHIVED' : 'ACTIVE UNIT'}
                                    </span>
                                    <Maximize2 size={12} className="text-zinc-600" />
                                 </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : currentFolders.length === 0 && (
                    <div className="py-32 flex flex-col items-center justify-center opacity-10 text-center gap-4">
                      <ImageIcon size={48} className="stroke-[0.3]" />
                      <p className="text-[9px] font-mono uppercase tracking-[0.4em]">Neural Core Empty</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="studio" 
                  initial={{ opacity: 0, scale: 0.98 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.95 }} 
                  className="w-full h-[60vh] flex flex-col items-center justify-center p-4"
                >
                  <div className="w-full relative aspect-square max-w-[320px] rounded-[2rem] overflow-hidden glass-card shadow-2xl group border-white/10 bg-black/40">
                    <AnimatePresence mode="wait">
                      {selectedImage ? (
                        <motion.div key={selectedImage.id} className="w-full h-full p-4">
                          <img src={selectedImage.url} alt="Generated" className="w-full h-full object-contain rounded-2xl" referrerPolicy="no-referrer" />
                        </motion.div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 text-center p-12">
                           <Layers size={48} className="mb-6 stroke-[0.3]" />
                           <p className="text-sm font-light italic tracking-[0.4em] uppercase">Neural Console</p>
                           <p className="text-[9px] font-mono mt-4 tracking-widest uppercase opacity-60 italic">
                             Target: /{breadcrumbs.map(b => b.name).join('/') || 'root'}
                           </p>
                        </div>
                      )}
                    </AnimatePresence>
                    
                    {isLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-black/80 backdrop-blur-3xl"
                      >
                        <div className="relative">
                          <div className="w-16 h-16 border-2 border-white/10 rounded-full" />
                          <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-white">
                            {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <p className="font-mono text-[9px] tracking-[0.6em] text-white uppercase animate-pulse">Synthesizing</p>
                          <p className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest">{progress.current} / {progress.total}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))
}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modern Android-Ready Chat Console - ONLY show if in a sector */}
      {currentFolderId && (
        <div className="fixed bottom-0 left-0 right-0 z-[150] flex flex-col pb-safe-area bg-[#030303]/95 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-3xl mx-auto w-full px-3 py-2 sm:px-4 sm:py-3 space-y-2">
           
           {/* Batch & Status Area */}
           <div className="flex items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5 flex-1 max-w-[200px] sm:max-w-[340px]">
                 <span className="text-[7px] sm:text-[9px] font-mono text-zinc-500 uppercase tracking-widest italic">Yield:</span>
                 <select 
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value))}
                    className="flex-1 bg-transparent text-white font-mono text-[9px] sm:text-xs focus:outline-none cursor-pointer appearance-none text-center"
                 >
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n} className="bg-black text-white">{n} Continuous Units</option>
                    ))}
                 </select>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 pr-1">
                  <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isSyncing ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="text-[7px] sm:text-[8px] font-mono uppercase tracking-widest text-zinc-600">
                    {isSyncing ? "Live" : "Idle"}
                  </span>
              </div>
           </div>

           {/* Mobile-Optimized Chat Field */}
           <div className="glass-card shadow-2xl border-white/10 bg-black/80 backdrop-blur-3xl rounded-2xl sm:rounded-[1.5rem] p-1 relative mt-[72px] sm:mt-12">
             {showFileLibrary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-white/10 rounded-2xl p-3 shadow-2xl z-[200] space-y-2"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Neural Memory</span>
                    <button onClick={() => setShowFileLibrary(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 no-scrollbar">
                    {fileLibrary.length === 0 ? (
                      <p className="text-[9px] font-mono text-zinc-700 p-4 text-center">Memory Banks Empty</p>
                    ) : (
                      fileLibrary.map((file, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setDataSource(file.data);
                            setActiveFileIndex(idx);
                            setShowFileLibrary(false);
                          }}
                          className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${activeFileIndex === idx ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                        >
                          <div className="flex items-center gap-3">
                             <FileText size={14} className={activeFileIndex === idx ? 'text-emerald-500' : 'text-zinc-500'} />
                             <span className={`text-xs font-mono truncate max-w-[200px] ${activeFileIndex === idx ? 'text-emerald-500' : 'text-white'}`}>{file.name}</span>
                          </div>
                          <span className="text-[8px] font-mono text-zinc-600 italic">{file.data.length} units</span>
                        </button>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={() => { fileInputRef.current?.click(); setShowFileLibrary(false); }}
                    className="w-full py-3 bg-white/5 border border-white/5 rounded-xl text-[9px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={12} />
                    Import from local
                  </button>
                </motion.div>
             )}
             
             <form 
              onSubmit={(e) => { e.preventDefault(); generateImage(e, true); }}
              className="flex items-center gap-1.5"
             >
                <div className="flex flex-col flex-1 relative">
                  {dataSource.length > 0 && (
                    <div className="absolute -top-14 left-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-black text-[8px] font-mono uppercase font-black rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer" onClick={() => setShowFileLibrary(true)}>
                       <FileText size={10} />
                       <span>{activeFileIndex !== null ? fileLibrary[activeFileIndex]?.name : 'Neural Vector'} Loaded</span>
                       <button onClick={(e) => { e.stopPropagation(); setDataSource([]); setActiveFileIndex(null); }} className="ml-3 hover:bg-black/10 rounded p-0.5"><X size={10} /></button>
                    </div>
                  )}
                  <div className="flex items-center bg-white/5 rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setShowFileLibrary(!showFileLibrary)}
                      className="p-2.5 sm:p-3 text-zinc-500 hover:text-white transition-colors border-r border-white/5"
                    >
                      <Plus size={16} className={dataSource.length > 0 ? "text-emerald-500" : ""} />
                    </button>
                    <textarea 
                      rows={1}
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder={dataSource.length > 0 ? "Neural override..." : "Neural script..."}
                      className="flex-1 py-2 sm:py-3.5 px-3 bg-transparent text-[11px] sm:text-sm text-white focus:outline-none placeholder:text-zinc-800 resize-none max-h-12 sm:max-h-32"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          generateImage(undefined, true);
                        }
                      }}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading || (!imagePrompt.trim() && dataSource.length === 0)}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-black rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-emerald-50 active:scale-95 disabled:opacity-10 transition-all flex-none"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
             </form>
           </div>
        </div>
        <div className="h-4 bg-[#030303] safe-area-bottom" />
      </div>
      )}

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black flex flex-col p-4 sm:p-8 overflow-y-auto no-scrollbar"
          >
             <button 
               onClick={() => setSelectedImage(null)}
               className="absolute top-6 right-6 z-[400] text-white/50 hover:text-white transition-colors p-4"
             >
               <Maximize2 size={24} className="rotate-45" />
             </button>

             {/* Navigation Controls */}
             <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-between px-4 sm:px-8 z-[350] pointer-events-none">
                <button 
                  onClick={() => {
                    const filtered = images.filter(img => img.folderId === currentFolderId);
                    const idx = filtered.findIndex(img => img.id === selectedImage.id);
                    if (idx > 0) setSelectedImage(filtered[idx - 1]);
                  }}
                  className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all pointer-events-auto active:scale-95"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => {
                    const filtered = images.filter(img => img.folderId === currentFolderId);
                    const idx = filtered.findIndex(img => img.id === selectedImage.id);
                    if (idx < filtered.length - 1) setSelectedImage(filtered[idx + 1]);
                  }}
                  className="w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all pointer-events-auto active:scale-95"
                >
                  <ChevronRight size={24} />
                </button>
             </div>
             
             <div className="max-w-[1400px] mx-auto w-full flex flex-col items-center pt-20">
                <div className="w-full aspect-square max-w-[800px] relative bg-black/40 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5">
                   <img 
                      src={selectedImage.url} 
                      alt="Fullscreen" 
                      className="w-full h-full object-contain" 
                      referrerPolicy="no-referrer"
                   />
                </div>

                <div className="w-full max-w-[800px] mt-12 space-y-10">
                   <div className="flex flex-col sm:flex-row items-stretch gap-4 border-b border-white/10 pb-6 mb-6">
                      <button 
                         onClick={() => copyImageToClipboard(selectedImage)} 
                         className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-[0.2em] transition-all ${copyingId === selectedImage.id ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 shadow-lg'}`}
                      >
                        {copyingId === selectedImage.id ? <ClipboardCheck size={20} /> : <ImageIcon size={20} />}
                        {copyingId === selectedImage.id ? 'Copied' : 'Copy Visual'}
                      </button>
                      <button 
                         onClick={async () => {
                           if (selectedImage.fbDescription) {
                             await navigator.clipboard.writeText(selectedImage.fbDescription);
                             setCopyingId(selectedImage.id + '_txt');
                             if (!selectedImage.isCompleted) {
                               toggleImageCompletion(selectedImage.id, true);
                             }
                             setTimeout(() => setCopyingId(null), 2000);
                           }
                         }} 
                         className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-[0.1em] transition-all ${copyingId === selectedImage.id + '_txt' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 shadow-lg'}`}
                      >
                        {copyingId === selectedImage.id + '_txt' ? <ClipboardCheck size={20} /> : <FileText size={20} />}
                        {copyingId === selectedImage.id + '_txt' ? 'Copied' : 'Copy Script'}
                      </button>
                   </div>

                   <div className="flex items-center justify-center gap-4 py-4 px-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Mark as Processed:</span>
                      <button 
                        onClick={() => toggleImageCompletion(selectedImage.id)}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${selectedImage.isCompleted ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${selectedImage.isCompleted ? 'left-7 shadow-sm' : 'left-1 opacity-40'}`} />
                        {selectedImage.isCompleted && <Check size={10} className="absolute left-2.5 top-2 text-black font-bold" />}
                      </button>
                   </div>

                   <div className="space-y-4 border-l-2 border-emerald-500/50 pl-6 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.4em] font-black italic">Transmission Manifest</span>
                        <div className="flex items-center gap-3 ml-auto">
                           <button onClick={() => downloadImage(selectedImage)} className="text-zinc-600 hover:text-white transition-colors"><Download size={16} /></button>
                           <button onClick={() => deleteImage(selectedImage.id)} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <p className="text-base sm:text-lg text-zinc-400 leading-relaxed font-light first-letter:text-emerald-500 first-letter:text-3xl first-letter:font-bold first-letter:mr-1">
                        {selectedImage.fbDescription || "Processing metadata stream..."}
                      </p>
                      <div className="pt-4 flex items-center justify-between border-t border-white/5 opacity-20">
                        <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">{selectedImage.id.toUpperCase()}</span>
                        <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">{new Date(selectedImage.timestamp).toLocaleDateString()}</span>
                      </div>
                   </div>

                   {/* Navigation */}
                   <div className="flex items-center justify-between pt-10 border-t border-white/5 pb-20">
                      <button 
                        onClick={() => {
                          const filtered = images.filter(img => img.folderId === currentFolderId);
                          const idx = filtered.findIndex(img => img.id === selectedImage.id);
                          if (idx > 0) setSelectedImage(filtered[idx - 1]);
                        }}
                        className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 text-sm uppercase font-mono tracking-widest text-zinc-500 hover:text-white"
                      >
                        <ChevronLeft size={20} />
                        Prev
                      </button>
                      <button 
                        onClick={() => {
                          const filtered = images.filter(img => img.folderId === currentFolderId);
                          const idx = filtered.findIndex(img => img.id === selectedImage.id);
                          if (idx < filtered.length - 1) setSelectedImage(filtered[idx + 1]);
                        }}
                        className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 text-sm uppercase font-mono tracking-widest text-zinc-500 hover:text-white"
                      >
                        Next
                        <ChevronRight size={20} />
                      </button>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPromptModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl glass-card border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">Neural Command Center</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Architect your Content & Style Matrix</p>
                </div>
                <button onClick={() => setShowPromptModal(false)} className="p-3 text-zinc-600 hover:text-white transition-colors"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-12 no-scrollbar">
                {/* Independent Content Matrix */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.4em] font-black italic">Content Script Matrices</h4>
                    <span className="text-[8px] font-mono text-zinc-700 uppercase">{contentPrompts.length} ACTIVE</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 bg-white/[0.03] p-5 rounded-2xl border border-white/5">
                       <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest font-bold mb-2 block">Initialize Matrix</span>
                       <input 
                         type="text" placeholder="Matrix Identifier (e.g. History Narrative)" value={systemPromptName}
                         onChange={(e) => setSystemPromptName(e.target.value)}
                         className="w-full h-11 glass-input px-4 text-xs text-white"
                       />
                       <textarea 
                         placeholder="Define narrative constraints, voice, and rules..." value={systemPromptContent}
                         onChange={(e) => setSystemPromptContent(e.target.value)}
                         className="w-full h-32 glass-input p-4 text-xs text-white resize-none"
                       />
                       <button 
                         onClick={createContentPrompt}
                         className="w-full h-11 bg-white text-black rounded-lg text-[9px] font-mono font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all"
                       >
                         Save Matrix
                       </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                       {contentPrompts.map(p => (
                         <div 
                           key={p.id} 
                           onClick={() => currentFolderId && linkFolderToContentPrompt(currentFolderId, p.id)}
                           className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${folders.find(f => f.id === currentFolderId)?.systemPromptId === p.id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                         >
                           <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${folders.find(f => f.id === currentFolderId)?.systemPromptId === p.id ? 'text-emerald-500' : 'text-white/60'}`}>{p.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); deleteContentPrompt(p.id); }} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                           </div>
                           <p className="text-[8px] text-zinc-600 line-clamp-2 italic">{p.content}</p>
                         </div>
                       ))}
                    </div>
                  </div>
                </section>

                {/* Independent Style Matrix */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.4em] font-black italic">Visual Style Protocols</h4>
                    <span className="text-[8px] font-mono text-zinc-700 uppercase">{stylePrompts.length} READY</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 bg-white/[0.03] p-5 rounded-2xl border border-white/5">
                       <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest font-bold mb-2 block">Register Protocol</span>
                       <input 
                         type="text" placeholder="Protocol Name (e.g. Photorealistic)" value={stylePromptName}
                         onChange={(e) => setStylePromptName(e.target.value)}
                         className="w-full h-11 glass-input px-4 text-xs text-white"
                       />
                       <textarea 
                         placeholder="Define visual rules, aesthetic bounds, and rendering style..." value={stylePromptContent}
                         onChange={(e) => setStylePromptContent(e.target.value)}
                         className="w-full h-32 glass-input p-4 text-xs text-white resize-none"
                       />
                       <button 
                         onClick={createStylePrompt}
                         className="w-full h-11 bg-white text-black rounded-lg text-[9px] font-mono font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all"
                       >
                         Save Protocol
                       </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                       {stylePrompts.map(p => (
                         <div 
                           key={p.id} 
                           onClick={() => currentFolderId && linkFolderToStylePrompt(currentFolderId, p.id)}
                           className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${folders.find(f => f.id === currentFolderId)?.stylePromptId === p.id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                         >
                           <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${folders.find(f => f.id === currentFolderId)?.stylePromptId === p.id ? 'text-emerald-500' : 'text-white/60'}`}>{p.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); deleteStylePrompt(p.id); }} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                           </div>
                           <p className="text-[8px] text-zinc-600 line-clamp-2 italic">{p.content}</p>
                         </div>
                       ))}
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-sm glass-card border-white/10 p-8 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">New Directory</h3>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Select a name for your neural bucket</p>
              </div>
              <input 
                autoFocus
                type="text" 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Bucket Name"
                className="w-full h-14 glass-input px-5 text-sm text-white focus:bg-white/[0.08]"
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 h-12 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={createFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 h-12 bg-white text-black rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-20 transition-all shadow-lg active:scale-95"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        [data-hidden] { display: none; }
      `}} />
    </div>
  );
}
