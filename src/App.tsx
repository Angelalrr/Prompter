import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2, Copy, Check, Sparkles, PenLine, FileJson, Link as LinkIcon, Share, LayoutGrid, Plus, Focus, User, Shirt, Map, CloudSun, Sun, Palette, Camera, Heart, Globe, Lock, RotateCcw, RotateCw, Undo2, Redo2, ShieldCheck, ShieldAlert, Bookmark, Clock, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Feed } from './Feed';
import { db } from './firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { compressImage } from './utils/image';
import { useLanguage, Language, useTranslatedText } from './i18n';
import { LanguageSelector } from './components/LanguageSelector';
import { LiquidGlassTabBar, TabId } from './components/LiquidGlassTabBar';
import { PromptChatAssistant, ChatMessage } from './components/PromptChatAssistant';
import { SavedPrompts, SavedPromptItem } from './components/SavedPrompts';
import { checkTextSecurity } from './utils/security';

type ImageData = {
  data: string;
  mimeType: string;
  previewUrl: string;
};

type DetectedObject = {
  label: string;
  box_2d: [number, number, number, number];
  position_description?: string;
};

type PromptResponse = {
  detected_objects?: DetectedObject[];
  spanish_description?: string;
  category?: string;
  subject_positioning_and_framing: string;
  pose_and_action: string;
  clothing_and_textures: string;
  environment_and_background: string;
  time_of_day_and_weather: string;
  lighting_and_shadows: string;
  color_palette_and_grading: string;
  camera_lens_and_tech_specs: string;
  emotional_tone_and_vibe: string;
  final_combined_prompt: string;
  negative_prompt: string;
};

type PromptHistoryEntry = {
  prompt: string;
  jsonOutput: string;
  originalSnippet: string | null;
  newSnippet: string | null;
};

const SAMPLE_PRESETS = [
  {
    titleEs: 'Retrato editorial',
    titleEn: 'Editorial Portrait',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
  },
  {
    titleEs: 'Paisaje épico',
    titleEn: 'Epic Landscape',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
  },
  {
    titleEs: 'Ciudad nocturna',
    titleEn: 'Night Cityscape',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80',
  },
];

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('inicio');

  const [referenceImage, setReferenceImage] = useState<ImageData | null>(null);
  const [jsonOutput, setJsonOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromptResponse | null>(null);
  const { translated: translatedResultDescription } = useTranslatedText(result?.spanish_description);
  
  // History stack for Undo and Redo
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lastChange, setLastChange] = useState<{ originalSnippet: string | null; newSnippet: string | null } | null>(null);

  // Latency & Generation timer state
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);
  const generationTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (generationTimerRef.current) clearInterval(generationTimerRef.current);
    };
  }, []);

  // Chat conversation state for saving and restoring
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [savingSession, setSavingSession] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [savedFirestoreDocId, setSavedFirestoreDocId] = useState<string | null>(null);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('saved_prompts_list');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list.length;
      }
    } catch {}
    return 0;
  });

  // Keep saved count in sync with storage
  useEffect(() => {
    let isMounted = true;
    const syncCount = async () => {
      let localCount = 0;
      try {
        const raw = localStorage.getItem('saved_prompts_list');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) localCount = list.length;
        }
      } catch {}

      try {
        const q = query(collection(db, 'saved_prompts'), limit(50));
        const snap = await getDocs(q);
        if (isMounted) {
          const fireCount = snap.docs.length;
          setSavedCount(Math.max(localCount, fireCount));
        }
      } catch {
        if (isMounted) setSavedCount(localCount);
      }
    };

    syncCount();
  }, [activeTab, isSaved]);

  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCombined, setCopiedCombined] = useState(false);
  
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [fetchingPinterest, setFetchingPinterest] = useState(false);
  const [pinterestError, setPinterestError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishedPostId, setPublishedPostId] = useState<string | null>(null);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<ImageData | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      const [prefix, data] = base64String.split(',');
      const mimeType = prefix.match(/:(.*?);/)?.[1] || file.type;

      setter({
        data,
        mimeType,
        previewUrl: base64String,
      });
      setError(null);
      setPublished(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePinterestSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pinterestUrl.trim()) return;
    
    setFetchingPinterest(true);
    setPinterestError(null);
    setPublished(false);
    
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pinterestUrl.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (language === 'es' ? "No se pudo extraer la imagen del enlace" : "Failed to fetch image"));
      }
      
      setReferenceImage({
        data: data.data,
        mimeType: data.mimeType,
        previewUrl: data.previewUrl
      });
      setPinterestUrl(""); 
      setError(null); 
    } catch (err: any) {
      setPinterestError(err.message || (language === 'es' ? "No se pudo extraer la imagen del enlace" : "Could not load image from link"));
    } finally {
      setFetchingPinterest(false);
    }
  };

  const handleLoadPreset = async (url: string) => {
    try {
      setLoading(false);
      setError(null);
      setResult(null);
      const res = await fetch(url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const [prefix, data] = base64.split(',');
        const mimeType = prefix.match(/:(.*?);/)?.[1] || 'image/jpeg';
        setReferenceImage({
          data,
          mimeType,
          previewUrl: base64,
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error loading preset image:', err);
    }
  };

  const handleGenerate = async () => {
    if (!referenceImage) {
      setError("Please upload a reference photo.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setHistory([]);
    setHistoryIndex(-1);
    setLastChange(null);
    setChatMessages([]);
    setSavedNotification(null);
    setPublished(false);
    setPublishedPostId(null);
    setIsSaved(false);
    setSavedSessionId(null);
    setSavedFirestoreDocId(null);
    setGenerationDuration(null);
    setElapsedSeconds(0);

    const startTime = Date.now();
    if (generationTimerRef.current) clearInterval(generationTimerRef.current);
    generationTimerRef.current = setInterval(() => {
      setElapsedSeconds(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
    }, 100);

    try {
      let existingCategories: string[] = [];
      try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        existingCategories = Array.from(new Set(snapshot.docs.map(d => d.data().category).filter(Boolean)));
      } catch(e) {
        console.error("Error fetching categories:", e);
      }

      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referenceImage, customInstructions: "", existingCategories }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate prompt. Please try again.");
      }

      const data = await response.json();
      const totalDuration = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
      setGenerationDuration(totalDuration);
      setResult(data);
      
      const displayJson = { ...data };
      delete displayJson.spanish_description;
      delete displayJson.category;
      
      const formattedJson = JSON.stringify(displayJson, null, 2);
      setJsonOutput(formattedJson);

      const initialEntry: PromptHistoryEntry = {
        prompt: data.final_combined_prompt || "",
        jsonOutput: formattedJson,
        originalSnippet: null,
        newSnippet: null,
      };
      setHistory([initialEntry]);
      setHistoryIndex(0);
      setLastChange(null);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setLoading(false);
    }
  };

  const handlePromptUpdated = (newPrompt: string, originalSnippet?: string | null, newSnippet?: string | null) => {
    if (!result) return;

    let updatedJson = jsonOutput;
    try {
      const parsed = JSON.parse(jsonOutput);
      parsed.final_combined_prompt = newPrompt;

      if (originalSnippet && newSnippet && originalSnippet.trim().length > 3) {
        for (const key of Object.keys(parsed)) {
          if (typeof parsed[key] === 'string' && key !== 'final_combined_prompt') {
            const val = parsed[key];
            if (val.toLowerCase().includes(originalSnippet.trim().toLowerCase())) {
              const escaped = originalSnippet.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              parsed[key] = val.replace(new RegExp(escaped, 'gi'), newSnippet.trim());
            }
          }
        }
      }
      updatedJson = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // ignore
    }

    const newEntry: PromptHistoryEntry = {
      prompt: newPrompt,
      jsonOutput: updatedJson,
      originalSnippet: originalSnippet || null,
      newSnippet: newSnippet || null,
    };

    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newEntry);

    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    setLastChange({
      originalSnippet: originalSnippet || null,
      newSnippet: newSnippet || null,
    });

    setResult({
      ...result,
      final_combined_prompt: newPrompt,
    });
    setJsonOutput(updatedJson);
    setIsSaved(false);
    setSavedSessionId(null);
    setSavedFirestoreDocId(null);
    setPublished(false);
    setPublishedPostId(null);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  const handleUndo = () => {
    if (!canUndo || !result) return;
    const targetIndex = historyIndex - 1;
    const targetEntry = history[targetIndex];
    if (!targetEntry) return;

    setHistoryIndex(targetIndex);
    setResult({
      ...result,
      final_combined_prompt: targetEntry.prompt,
    });
    setJsonOutput(targetEntry.jsonOutput);

    if (targetIndex === 0) {
      setLastChange(null);
    } else {
      setLastChange({
        originalSnippet: targetEntry.originalSnippet,
        newSnippet: targetEntry.newSnippet,
      });
    }
  };

  const handleRedo = () => {
    if (!canRedo || !result) return;
    const targetIndex = historyIndex + 1;
    const targetEntry = history[targetIndex];
    if (!targetEntry) return;

    setHistoryIndex(targetIndex);
    setResult({
      ...result,
      final_combined_prompt: targetEntry.prompt,
    });
    setJsonOutput(targetEntry.jsonOutput);

    setLastChange({
      originalSnippet: targetEntry.originalSnippet,
      newSnippet: targetEntry.newSnippet,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || 
         activeEl.tagName === 'TEXTAREA' || 
         (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, historyIndex, history, result]);

  const handlePublish = async () => {
    if (!result || !referenceImage) return;

    if (published) {
      setPublishing(true);
      try {
        if (publishedPostId) {
          await deleteDoc(doc(db, 'posts', publishedPostId));
        }
        setPublished(false);
        setPublishedPostId(null);
        setSavedNotification(
          language === 'es' ? 'Publicación eliminada del feed' : 'Post removed from feed'
        );
        setTimeout(() => setSavedNotification(null), 3500);
      } catch (err) {
        console.error("Failed to unpublish:", err);
      } finally {
        setPublishing(false);
      }
      return;
    }

    const promptSecurity = checkTextSecurity(result.final_combined_prompt || "");
    if (!promptSecurity.isSafe) {
      setError(`Publicación denegada por seguridad: ${promptSecurity.warningMessage}`);
      return;
    }
    const jsonSecurity = checkTextSecurity(jsonOutput || "");
    if (!jsonSecurity.isSafe) {
      setError(`Publicación denegada por seguridad: ${jsonSecurity.warningMessage}`);
      return;
    }

    setPublishing(true);
    
    try {
      const compressedImage = await compressImage(referenceImage.previewUrl, 600, 0.7);
      
      const docRef = await addDoc(collection(db, 'posts'), {
        imageUrl: compressedImage,
        combinedPrompt: result.final_combined_prompt || "",
        jsonPrompt: jsonOutput,
        detectedObjects: result.detected_objects || [],
        spanishDescription: result.spanish_description || "",
        category: result.category || "Uncategorized",
        likes: 0,
        createdAt: Date.now()
      });
      setPublished(true);
      setPublishedPostId(docRef.id);
      setSavedNotification(
        language === 'es' ? '¡Publicado en el Feed!' : 'Published to Feed!'
      );
      setTimeout(() => setSavedNotification(null), 4000);
    } catch (err) {
      console.error("Failed to publish:", err);
      alert("Failed to publish. Check console.");
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveSession = async () => {
    if (!result || !referenceImage) return;

    if (isSaved) {
      setSavingSession(true);
      try {
        try {
          const raw = localStorage.getItem('saved_prompts_list');
          if (raw) {
            const list: SavedPromptItem[] = JSON.parse(raw);
            const updated = list.filter(
              (i) => i.id !== savedSessionId && i.combinedPrompt !== result.final_combined_prompt
            );
            localStorage.setItem('saved_prompts_list', JSON.stringify(updated));
            setSavedCount(updated.length);
          }
        } catch (localErr) {
          console.warn("Could not update localStorage:", localErr);
        }

        if (savedFirestoreDocId) {
          try {
            await deleteDoc(doc(db, 'saved_prompts', savedFirestoreDocId));
          } catch (fireErr) {
            console.warn("Could not delete from Firestore:", fireErr);
          }
        }

        setIsSaved(false);
        setSavedSessionId(null);
        setSavedFirestoreDocId(null);
        setSavedNotification(
          language === 'es' ? 'Eliminado de guardados' : 'Removed from saved'
        );
        setTimeout(() => setSavedNotification(null), 3500);
      } catch (err) {
        console.error("Failed to unsave:", err);
      } finally {
        setSavingSession(false);
      }
      return;
    }

    setSavingSession(true);
    setSavedNotification(null);

    try {
      const compressedImage = await compressImage(referenceImage.previewUrl, 600, 0.7);
      const newSavedItem: SavedPromptItem = {
        id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        imageUrl: compressedImage,
        combinedPrompt: result.final_combined_prompt || "",
        jsonPrompt: jsonOutput || "",
        spanishDescription: result.spanish_description || "",
        category: result.category || "General",
        detectedObjects: result.detected_objects || [],
        chatMessages: chatMessages || [],
        createdAt: Date.now(),
        generationDuration: generationDuration !== null ? generationDuration : undefined,
      };

      try {
        const raw = localStorage.getItem('saved_prompts_list');
        const list: SavedPromptItem[] = raw ? JSON.parse(raw) : [];
        const updated = [newSavedItem, ...list.filter((i) => i.id !== newSavedItem.id && i.combinedPrompt !== newSavedItem.combinedPrompt)];
        localStorage.setItem('saved_prompts_list', JSON.stringify(updated));
        setSavedCount(updated.length);
      } catch (localErr) {
        console.warn("Could not save to localStorage:", localErr);
      }

      let fireDocId = null;
      try {
        const docRef = await addDoc(collection(db, 'saved_prompts'), {
          imageUrl: newSavedItem.imageUrl,
          combinedPrompt: newSavedItem.combinedPrompt,
          jsonPrompt: newSavedItem.jsonPrompt,
          spanishDescription: newSavedItem.spanishDescription,
          category: newSavedItem.category,
          detectedObjects: newSavedItem.detectedObjects,
          chatMessages: JSON.stringify(newSavedItem.chatMessages),
          createdAt: newSavedItem.createdAt,
          generationDuration: newSavedItem.generationDuration ?? null,
        });
        fireDocId = docRef.id;
      } catch (fireErr) {
        console.warn("Could not save to Firestore:", fireErr);
      }

      setIsSaved(true);
      setSavedSessionId(newSavedItem.id);
      setSavedFirestoreDocId(fireDocId);
      setSavedNotification(
        language === 'es' ? '¡Guardado con éxito!' : 'Saved successfully!'
      );
      setTimeout(() => setSavedNotification(null), 4000);
    } catch (err: any) {
      console.error("Failed to save session:", err);
      alert(language === 'es' ? 'Error al guardar la sesión.' : 'Failed to save session.');
    } finally {
      setSavingSession(false);
    }
  };

  const handleOpenSavedInEditor = (item: SavedPromptItem) => {
    setReferenceImage({
      data: '',
      mimeType: 'image/jpeg',
      previewUrl: item.imageUrl,
    });

    const restoredResult: PromptResponse = {
      detected_objects: item.detectedObjects || [],
      spanish_description: item.spanishDescription || '',
      category: item.category || 'General',
      subject_positioning_and_framing: '',
      pose_and_action: '',
      clothing_and_textures: '',
      environment_and_background: '',
      time_of_day_and_weather: '',
      lighting_and_shadows: '',
      color_palette_and_grading: '',
      camera_lens_and_tech_specs: '',
      emotional_tone_and_vibe: '',
      final_combined_prompt: item.combinedPrompt,
      negative_prompt: '',
    };
    setResult(restoredResult);
    setJsonOutput(item.jsonPrompt);
    setIsSaved(true);
    setSavedSessionId(item.id);
    setPublished(false);
    setPublishedPostId(null);
    setGenerationDuration(item.generationDuration ?? null);
    setChatMessages(item.chatMessages || []);

    const initialEntry: PromptHistoryEntry = {
      prompt: item.combinedPrompt,
      jsonOutput: item.jsonPrompt,
      originalSnippet: null,
      newSnippet: null,
    };
    setHistory([initialEntry]);
    setHistoryIndex(0);
    setLastChange(null);

    setActiveTab('inicio');

    setSavedNotification(
      language === 'es'
        ? 'Prompt y conversación restaurados en el editor'
        : 'Prompt and conversation restored in editor'
    );
    setTimeout(() => setSavedNotification(null), 4000);
  };

  const copyToClipboard = (text: string, type: 'json' | 'combined') => {
    navigator.clipboard.writeText(text);
    if (type === 'json') {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else {
      setCopiedCombined(true);
      setTimeout(() => setCopiedCombined(false), 2000);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#2D201C] text-[#F2E9DD] font-sans selection:bg-[#E0B94F]/30 selection:text-[#F2E9DD] pb-24">
      {/* Clean Top Header: Branding + Language Selector */}
      <header className="relative z-30 pt-4 pb-2 px-4 sm:px-8 max-w-4xl mx-auto flex items-center justify-between gap-4 w-full">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#382823] border border-[#564039] flex items-center justify-center text-[#E0B94F] shadow-sm">
            <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <span className="font-semibold text-sm text-[#F2E9DD] tracking-tight">
            Prompt Studio
          </span>
        </div>

        {/* Right Language Selector */}
        <div className="shrink-0 flex items-center justify-end">
          <LanguageSelector />
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-4 flex-1 w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'favoritos' ? (
            <motion.div
              key={`favoritos-${language}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <SavedPrompts
                onOpenInEditor={handleOpenSavedInEditor}
                onGoToCreate={() => setActiveTab('inicio')}
                onItemsCountChange={(c) => setSavedCount(c)}
              />
            </motion.div>
          ) : activeTab === 'buscar' ? (
            <motion.div
              key={`buscar-${language}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <Feed />
            </motion.div>
          ) : (
            <motion.div
              key={`inicio-${language}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <header className="mb-6 text-center space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F2E9DD]">
                  {t('appTitle')}
                </h1>
                <p className="text-xs sm:text-sm text-[#B7AAA0] max-w-md mx-auto leading-relaxed">
                  {t('appDescription')}
                </p>
              </header>

              <div className="max-w-xl mx-auto mb-6 space-y-4">
                <section>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h2 className="text-xs font-medium text-[#B7AAA0]">
                      {language === 'es' ? 'Imagen de referencia' : 'Reference image'}
                    </h2>
                  </div>
                  <ImageUploadBox
                    title={t('uploadYourReference')}
                    description={t('dragDrop')}
                    image={referenceImage}
                    onChange={(e) => handleImageUpload(e, setReferenceImage)}
                    id="reference-upload"
                  />
                  
                  <div className="mt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-px bg-[#564039]"></div>
                      <span className="text-[10px] font-semibold text-[#B7AAA0] uppercase tracking-wider">{t('or')}</span>
                      <div className="flex-1 h-px bg-[#564039]"></div>
                    </div>
                    
                    <form onSubmit={handlePinterestSubmit} className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                        <LinkIcon className="w-3.5 h-3.5 text-[#B7AAA0]" strokeWidth={1.75} />
                      </div>
                      <input
                        type="text"
                        value={pinterestUrl}
                        onChange={(e) => setPinterestUrl(e.target.value)}
                        placeholder={t('pasteUrlPlaceholder')}
                        className="w-full pl-10 pr-24 py-2.5 bg-[#382823] border border-[#564039] focus:border-[#E0B94F] rounded-xl text-xs sm:text-sm text-[#F2E9DD] placeholder:text-[#B7AAA0]/60 focus:outline-none transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={fetchingPinterest || !pinterestUrl.trim()}
                        className="btn-secondary absolute inset-y-1 right-1 px-3 py-1 text-xs font-medium rounded-lg disabled:opacity-40"
                      >
                        {fetchingPinterest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('fetch')}
                      </button>
                    </form>
                    {pinterestError && (
                      <p className="text-xs font-medium mt-2 ml-1 text-[#B7AAA0] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A8556B]" />
                        <span className="text-[#F2E9DD]">{pinterestError}</span>
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-xl mx-auto bg-[#382823] text-[#F2E9DD] px-4 py-2.5 rounded-xl mb-4 text-xs font-medium border border-[#A8556B]/40 flex items-center"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A8556B] mr-2.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="flex justify-center mb-6">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !referenceImage}
                  className={`inline-flex items-center justify-center px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                    loading || !referenceImage
                      ? 'bg-[#382823] text-[#B7AAA0] border border-[#564039] cursor-not-allowed opacity-50'
                      : 'btn-primary shadow-sm'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#2D201C]" />
                      {t('analyzingImage')}
                    </>
                  ) : (
                    <>
                      {t('generatePrompt')}
                      <Sparkles className="w-4 h-4 ml-2" strokeWidth={1.75} />
                    </>
                  )}
                </button>
              </div>

              {!loading && !result && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.15 }}
                  className="max-w-xl mx-auto w-full pt-1"
                >
                  <div className="flex items-center justify-between px-1 mb-2.5">
                    <span className="text-xs font-medium text-[#B7AAA0]">
                      {language === 'es' ? 'Imágenes de ejemplo' : 'Sample images'}
                    </span>
                    <button
                      onClick={() => setActiveTab('buscar')}
                      className="text-xs text-[#E0B94F] hover:underline cursor-pointer font-medium"
                    >
                      {language === 'es' ? 'Ver comunidad' : 'Browse feed'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {SAMPLE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleLoadPreset(preset.url)}
                        className="group relative rounded-xl overflow-hidden bg-[#382823] border border-[#564039] hover:border-[#E0B94F]/60 p-1.5 text-left transition-colors cursor-pointer active:scale-[0.97]"
                      >
                        <div className="aspect-4/3 rounded-lg overflow-hidden bg-[#2D201C] mb-1.5 relative">
                          <img src={preset.url} alt={language === 'es' ? preset.titleEs : preset.titleEn} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200" />
                        </div>
                        <p className="text-[11px] font-medium text-[#F2E9DD] truncate px-0.5">
                          {language === 'es' ? preset.titleEs : preset.titleEn}
                        </p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {loading ? (
                  <AnalysisLoader key="loader" elapsedSeconds={elapsedSeconds} />
                ) : result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="max-w-3xl mx-auto space-y-4 mb-16"
                  >
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                      {savedNotification ? (
                        <div className="px-3 py-1.5 bg-[#382823] border border-[#72B6A4]/50 text-[#F2E9DD] text-xs font-medium rounded-lg flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#72B6A4]" strokeWidth={2} />
                          <span>{savedNotification}</span>
                          <button
                            onClick={() => setActiveTab('favoritos')}
                            className="ml-2 underline text-[#E0B94F] font-semibold cursor-pointer"
                          >
                            {language === 'es' ? 'Ver guardados' : 'View saved'}
                          </button>
                        </div>
                      ) : (
                        <div />
                      )}

                      {generationDuration !== null && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#382823] border border-[#564039] text-[#B7AAA0] text-xs font-mono">
                          <Clock className="w-3 h-3 text-[#E0B94F]" strokeWidth={1.75} />
                          <span>{generationDuration}s</span>
                        </div>
                      )}
                    </div>

                    {referenceImage && result.detected_objects && result.detected_objects.length > 0 && (
                      <ImageAnalyzer imageUrl={referenceImage.previewUrl} objects={result.detected_objects} />
                    )}

                    {/* Combined Prompt */}
                    <div className="bg-[#382823] border border-[#564039] rounded-2xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#F2E9DD] text-base">
                            {t('combinedFinalPrompt')}
                          </h3>
                          {history.length > 1 && (
                            <span className="text-[10px] font-medium text-[#B7AAA0] bg-[#43302A] px-2 py-0.5 rounded border border-[#564039]">
                              v{historyIndex + 1} / {history.length}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(result.final_combined_prompt || "", 'combined')}
                            className="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                          >
                            {copiedCombined ? <Check className="w-3.5 h-3.5 text-[#72B6A4]" strokeWidth={2} /> : <Copy className="w-3.5 h-3.5 text-[#B7AAA0]" strokeWidth={1.75} />}
                            <span>{copiedCombined ? (language === 'es' ? 'Copiado' : 'Copied') : t('copy')}</span>
                          </button>
                        </div>
                      </div>

                      {result.spanish_description && (
                        <div className="p-3 bg-[#43302A] rounded-xl border border-[#564039]">
                          <p className="text-xs text-[#F2E9DD] leading-relaxed">
                            <span className="font-semibold block mb-0.5 text-[#E0B94F]">
                              {t('description')}
                            </span>
                            {translatedResultDescription || result.spanish_description}
                          </p>
                        </div>
                      )}

                      <div className="p-4 bg-[#2D201C] rounded-xl border border-[#564039] text-xs sm:text-sm leading-relaxed text-[#F2E9DD] font-mono select-text">
                        <HighlightedPromptText
                          prompt={result.final_combined_prompt}
                          highlightSnippet={lastChange?.newSnippet}
                        />
                      </div>

                      {lastChange?.newSnippet && (
                        <div className="p-2.5 bg-[#43302A] border border-[#E0B94F]/35 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#E0B94F] font-medium">
                              {t('lastChangeHighlighted')}:
                            </span>
                            <span className="font-medium text-[#F2E9DD] bg-[#564039] px-2 py-0.5 rounded">
                              "{lastChange.newSnippet}"
                            </span>
                            {lastChange.originalSnippet && (
                              <span className="text-[#B7AAA0] line-through text-[11px]">
                                (Antes: "{lastChange.originalSnippet}")
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* JSON Prompt Box */}
                    <div className="bg-[#382823] border border-[#564039] rounded-2xl p-4 space-y-3">
                      <div className="px-1 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center text-[#B7AAA0] gap-2">
                          <FileJson className="w-4 h-4 text-[#E0B94F]" strokeWidth={1.75} />
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#B7AAA0]">
                            {t('jsonPromptProtected')}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(jsonOutput, 'json')}
                          className="btn-secondary text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                        >
                          {copiedJson ? <Check className="w-3.5 h-3.5 text-[#72B6A4]" strokeWidth={2} /> : <Copy className="w-3.5 h-3.5 text-[#B7AAA0]" strokeWidth={1.75} />}
                          <span>{copiedJson ? (language === 'es' ? 'Copiado' : 'Copied') : t('copyJson')}</span>
                        </button>
                      </div>
                      
                      <div className="relative">
                        <HighlightedJsonPrompt
                          jsonString={jsonOutput}
                          highlightSnippet={lastChange?.newSnippet}
                        />
                      </div>
                    </div>

                    {/* Assistant */}
                    <div className="pt-1">
                      <PromptChatAssistant
                        currentPrompt={result.final_combined_prompt}
                        onPromptUpdated={handlePromptUpdated}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        initialMessages={chatMessages}
                        onMessagesChange={setChatMessages}
                      />
                    </div>

                    {/* Bottom action buttons */}
                    <div className="pt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <button
                          id="btn-save-bottom"
                          onClick={handleSaveSession}
                          disabled={savingSession}
                          className="btn-secondary w-full py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {savingSession ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#B7AAA0]" />
                          ) : (
                            <Bookmark className={`w-4 h-4 ${isSaved ? 'text-[#E0B94F] fill-[#E0B94F]' : 'text-[#B7AAA0]'}`} strokeWidth={1.75} />
                          )}
                          <span>{isSaved ? (language === 'es' ? 'Guardado' : 'Saved') : (language === 'es' ? 'Guardar' : 'Save')}</span>
                        </button>

                        <button
                          id="btn-publish-bottom"
                          onClick={handlePublish}
                          disabled={publishing}
                          className="btn-primary w-full py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {publishing ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#2D201C]" />
                          ) : published ? (
                            <Check className="w-4 h-4 text-[#2D201C]" strokeWidth={2} />
                          ) : (
                            <Share className="w-4 h-4 text-[#2D201C]" strokeWidth={1.75} />
                          )}
                          <span>{published ? (language === 'es' ? 'Publicado' : 'Published') : (language === 'es' ? 'Publicar' : 'Publish')}</span>
                        </button>
                      </div>

                      {/* Status feedback alerts */}
                      <AnimatePresence>
                        {savedNotification && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="p-3 bg-[#382823] text-[#F2E9DD] text-xs font-medium rounded-xl flex items-center justify-between border border-[#72B6A4]/40"
                          >
                            <div className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-[#72B6A4] shrink-0" strokeWidth={2} />
                              <span>{savedNotification}</span>
                            </div>
                            <button
                              onClick={() => setActiveTab(isSaved ? 'favoritos' : 'buscar')}
                              className="ml-3 underline text-[#E0B94F] font-medium shrink-0 cursor-pointer text-xs"
                            >
                              {isSaved ? (language === 'es' ? 'Ver guardados' : 'View saved') : (language === 'es' ? 'Ir al feed' : 'Go to feed')}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compact Liquid Glass Tab Bar */}
      <LiquidGlassTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}

function HighlightedPromptText({
  prompt,
  highlightSnippet,
}: {
  prompt: string;
  highlightSnippet?: string | null;
}) {
  const paragraphs = useMemo(() => {
    if (!prompt) return [];
    // Split by newlines while preserving paragraph structure
    const rawParagraphs = prompt.split(/\n\n+/);
    return rawParagraphs.map(p => p.trim()).filter(Boolean);
  }, [prompt]);

  const renderSegment = (text: string) => {
    if (!highlightSnippet || !highlightSnippet.trim()) {
      return text;
    }

    const cleanSnippet = highlightSnippet.trim();
    const lowerText = text.toLowerCase();
    const lowerSnippet = cleanSnippet.toLowerCase();

    if (!lowerText.includes(lowerSnippet)) {
      return text;
    }

    const elements: React.ReactNode[] = [];
    let start = 0;
    let idx = lowerText.indexOf(lowerSnippet, start);

    while (idx !== -1) {
      if (idx > start) {
        elements.push(text.substring(start, idx));
      }
      const matched = text.substring(idx, idx + cleanSnippet.length);
      elements.push(
        <mark
          key={`mark-${idx}`}
          className="bg-[#E0B94F]/25 text-[#F2E9DD] font-semibold px-1.5 py-0.5 rounded border border-[#E0B94F]/50 mx-0.5 inline-block"
        >
          {matched}
        </mark>
      );
      start = idx + cleanSnippet.length;
      idx = lowerText.indexOf(lowerSnippet, start);
    }

    if (start < text.length) {
      elements.push(text.substring(start));
    }

    return elements;
  };

  if (paragraphs.length <= 1) {
    return (
      <div className="whitespace-pre-wrap break-words leading-relaxed text-[#F2E9DD] font-mono">
        {renderSegment(prompt)}
      </div>
    );
  }

  return (
    <div className="space-y-4 whitespace-pre-wrap break-words text-[#F2E9DD] font-mono">
      {paragraphs.map((para, i) => (
        <p key={i} className="leading-relaxed text-xs sm:text-sm pl-2 border-l-2 border-[#564039] hover:border-[#E0B94F]/60 transition-colors">
          {renderSegment(para)}
        </p>
      ))}
    </div>
  );
}

function HighlightedJsonPrompt({
  jsonString,
  highlightSnippet,
}: {
  jsonString: string;
  highlightSnippet?: string | null;
}) {
  const lines = useMemo(() => {
    return jsonString.split('\n');
  }, [jsonString]);

  const renderHighlightedContent = (text: string) => {
    if (!highlightSnippet || !highlightSnippet.trim()) {
      return text;
    }
    const cleanSnippet = highlightSnippet.trim();
    const lowerText = text.toLowerCase();
    const lowerSnippet = cleanSnippet.toLowerCase();

    if (!lowerText.includes(lowerSnippet)) {
      return text;
    }

    const elements: React.ReactNode[] = [];
    let start = 0;
    let idx = lowerText.indexOf(lowerSnippet, start);

    while (idx !== -1) {
      if (idx > start) {
        elements.push(text.substring(start, idx));
      }
      const matched = text.substring(idx, idx + cleanSnippet.length);
      elements.push(
        <mark
          key={`mark-${idx}`}
          className="bg-[#E0B94F]/25 text-[#F2E9DD] font-semibold px-1.5 py-0.5 rounded border border-[#E0B94F]/50 mx-0.5 inline-block"
        >
          {matched}
        </mark>
      );
      start = idx + cleanSnippet.length;
      idx = lowerText.indexOf(lowerSnippet, start);
    }

    if (start < text.length) {
      elements.push(text.substring(start));
    }

    return elements;
  };

  return (
    <div className="p-4 sm:p-5 overflow-x-auto text-xs font-mono leading-relaxed bg-[#2D201C] rounded-xl text-[#F2E9DD] max-h-[420px] border border-[#564039]">
      <div className="table w-full">
        {lines.map((line, lineIdx) => {
          const isHighlighted = highlightSnippet && line.toLowerCase().includes(highlightSnippet.trim().toLowerCase());
          return (
            <div
              key={`json-line-${lineIdx}`}
              className={`table-row transition-colors ${
                isHighlighted ? 'bg-[#E0B94F]/15 font-semibold' : 'hover:bg-white/[0.02]'
              }`}
            >
              <span className="table-cell pr-4 text-right select-none text-[#B7AAA0] w-8 font-sans text-[11px]">
                {lineIdx + 1}
              </span>
              <span className="table-cell whitespace-pre">
                {renderHighlightedContent(line)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageAnalyzer({ imageUrl, objects }: { imageUrl: string; objects: DetectedObject[] }) {
  const { t, language } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="bg-[#382823] p-4 sm:p-5 rounded-2xl border border-[#564039] mb-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center">
          <Focus className="w-4 h-4 mr-2 text-[#E0B94F]" strokeWidth={1.75} />
          <h3 className="font-semibold text-[#F2E9DD] text-sm sm:text-base">{t('aiVisionExtraction')}</h3>
        </div>
        <span className="text-[11px] text-[#B7AAA0]">
          {objects.length} {language === 'es' ? 'elementos detectados' : 'detected elements'}
        </span>
      </div>

      <div className="relative inline-block w-full rounded-xl overflow-hidden bg-[#2D201C] border border-[#564039]">
        <img src={imageUrl} className="w-full h-auto block" alt="Analyzed" />
        {objects.map((obj, i) => {
          if (!obj.box_2d || obj.box_2d.length !== 4) return null;
          const [ymin, xmin, ymax, xmax] = obj.box_2d;
          const top = `${(ymin / 1000) * 100}%`;
          const left = `${(xmin / 1000) * 100}%`;
          const height = `${((ymax - ymin) / 1000) * 100}%`;
          const width = `${((xmax - xmin) / 1000) * 100}%`;
          const isHovered = hoveredIdx === i;
          
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.15 }}
              className={`absolute transition-all duration-150 ${
                isHovered
                  ? 'border-2 border-[#E0B94F] bg-[#E0B94F]/30 z-20 shadow-lg'
                  : 'border border-[#E0B94F] bg-[#E0B94F]/15 z-10'
              }`}
              style={{ top, left, width, height }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="absolute -top-5 left-[-1px] bg-[#E0B94F] text-[#2D201C] text-[10px] font-semibold px-1.5 py-0.5 rounded-t rounded-br whitespace-nowrap shadow-sm pointer-events-none">
                {obj.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Clean detected objects list without coordinate numbers */}
      {objects.length > 0 && (
        <div className="pt-1 flex flex-wrap gap-1.5">
          {objects.map((obj, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <button
                type="button"
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  isHovered
                    ? 'bg-[#E0B94F] text-[#2D201C] border-[#E0B94F]'
                    : 'bg-[#43302A] text-[#F2E9DD] border-[#564039] hover:border-[#E0B94F]/60'
                }`}
              >
                {obj.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalysisLoader({ elapsedSeconds = 0 }: { elapsedSeconds?: number; key?: React.Key }) {
  const { t, language } = useLanguage();
  return (
    <motion.div 
      key="loader"
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -12 }}
      className="max-w-3xl mx-auto space-y-4 mb-16"
    >
      <div className="text-center mb-6 space-y-2">
        <h3 className="text-base sm:text-lg font-medium text-[#F2E9DD] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#E0B94F]" />
          <span>{t('aiWritingPrompt')}</span>
        </h3>
        <p className="text-xs text-[#B7AAA0]">{t('analyzingLayers')}</p>

        <div className="pt-1 flex flex-col items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#382823] border border-[#564039] text-[#B7AAA0] text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
            <span>{elapsedSeconds.toFixed(1)}s</span>
          </div>

          <AnimatePresence>
            {elapsedSeconds >= 5.0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-md w-full mx-auto p-3 bg-[#43302A] border border-[#564039] rounded-xl flex items-center gap-2.5 text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-[#382823] flex items-center justify-center shrink-0 text-[#E0B94F]">
                  <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-[#F2E9DD]">
                      {t('highDemandTitle')}
                    </span>
                    <span className="text-xs text-[#B7AAA0]">
                      • {t('highDemandNotice')}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Skeleton card for AI Vision */}
      <div className="bg-[#382823] p-4 rounded-2xl border border-[#564039] space-y-3">
         <div className="flex items-center gap-2">
           <Focus className="w-4 h-4 text-[#E0B94F]" strokeWidth={1.75} />
           <div className="h-3.5 w-32 bg-[#43302A] rounded animate-pulse" />
         </div>
         <div className="w-full h-36 bg-[#2D201C] rounded-xl flex items-center justify-center border border-[#564039]">
           <div className="flex items-center gap-2 text-xs text-[#B7AAA0]">
             <Sparkles className="w-3.5 h-3.5 text-[#E0B94F] animate-pulse" strokeWidth={1.75} />
             <span>{language === 'es' ? 'Detectando elementos y composición...' : 'Detecting elements and framing...'}</span>
           </div>
         </div>
      </div>

      {/* Skeleton for Combined Prompt */}
      <div className="bg-[#382823] rounded-2xl p-4 border border-[#564039] space-y-3">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-[#E0B94F]" strokeWidth={1.75} />
             <div className="h-3.5 w-28 bg-[#43302A] rounded animate-pulse" />
           </div>
           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#43302A] rounded text-[10px] text-[#B7AAA0]">
             <span className="w-1.5 h-1.5 rounded-full bg-[#E0B94F] animate-pulse" />
             <span>{language === 'es' ? 'Redactando...' : 'Drafting...'}</span>
           </div>
        </div>

        <div className="p-3 bg-[#43302A] rounded-xl border border-[#564039] space-y-2">
           <div className="h-2.5 w-24 bg-[#564039] rounded animate-pulse" />
           <div className="h-2.5 w-full bg-[#564039] rounded animate-pulse" />
        </div>

        <div className="p-4 bg-[#2D201C] rounded-xl border border-[#564039] space-y-2">
           <div className="h-2.5 w-full bg-[#43302A] rounded animate-pulse" />
           <div className="h-2.5 w-4/5 bg-[#43302A] rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

function ImageUploadBox({
  title,
  description,
  image,
  onChange,
  id,
}: {
  title: string;
  description: string;
  image: ImageData | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  id: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="group flex flex-col items-center justify-center w-full min-h-[175px] sm:min-h-[210px] rounded-2xl bg-[#382823] border border-dashed border-[#564039] hover:border-[#E0B94F] transition-colors cursor-pointer overflow-hidden relative"
      >
        {image ? (
          <div className="absolute inset-0 w-full h-full bg-[#2D201C] p-2">
            <img src={image.previewUrl} alt={title} className="w-full h-full object-contain rounded-xl" />
            <div className="absolute inset-0 bg-[#2D201C]/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl">
              <div className="btn-secondary px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm">
                <UploadCloud className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
                <span>{t('replaceImage')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 text-center">
            <div className="w-10 h-10 mb-2 rounded-xl bg-[#43302A] border border-[#564039] flex items-center justify-center text-[#E0B94F] group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-xs sm:text-sm font-medium text-[#F2E9DD] mb-0.5">{title}</h3>
            <p className="text-[11px] text-[#B7AAA0]">{description}</p>
          </div>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
        />
      </label>
    </div>
  );
}
