import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bookmark, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  MessageSquare, 
  Clock, 
  Sparkles, 
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage, getCategoryLabel } from '../i18n';
import type { ChatMessage } from './PromptChatAssistant';

export interface SavedPromptItem {
  id: string;
  imageUrl: string;
  combinedPrompt: string;
  jsonPrompt: string;
  spanishDescription?: string;
  category?: string;
  detectedObjects?: Array<{ label: string; box_2d: [number, number, number, number] }>;
  chatMessages: ChatMessage[];
  createdAt: number;
  generationDuration?: number;
}

interface SavedPromptsProps {
  onOpenInEditor: (item: SavedPromptItem) => void;
  onGoToCreate: () => void;
  onItemsCountChange?: (count: number) => void;
}

export function SavedPrompts({ onOpenInEditor, onGoToCreate, onItemsCountChange }: SavedPromptsProps) {
  const { language, t } = useLanguage();
  const [items, setItems] = useState<SavedPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  useEffect(() => {
    onItemsCountChange?.(items.length);
  }, [items, onItemsCountChange]);

  const loadSavedPrompts = async () => {
    setLoading(true);
    let localSaved: SavedPromptItem[] = [];
    try {
      const raw = localStorage.getItem('saved_prompts_list');
      if (raw) {
        localSaved = JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading localStorage saved prompts:', e);
    }

    try {
      const q = query(collection(db, 'saved_prompts'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const fireSaved: SavedPromptItem[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        let parsedChat: ChatMessage[] = [];
        try {
          if (d.chatMessages) {
            parsedChat = typeof d.chatMessages === 'string' ? JSON.parse(d.chatMessages) : d.chatMessages;
          }
        } catch {}
        return {
          id: docSnap.id,
          imageUrl: d.imageUrl || '',
          combinedPrompt: d.combinedPrompt || '',
          jsonPrompt: d.jsonPrompt || '',
          spanishDescription: d.spanishDescription || '',
          category: d.category || 'General',
          detectedObjects: d.detectedObjects || [],
          chatMessages: parsedChat,
          createdAt: d.createdAt || Date.now(),
          generationDuration: d.generationDuration || undefined,
        };
      });

      const map = new Map<string, SavedPromptItem>();
      localSaved.forEach((item) => map.set(item.combinedPrompt, item));
      fireSaved.forEach((item) => map.set(item.combinedPrompt, item));

      const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
      setItems(merged);
    } catch (err) {
      console.error('Error loading from Firestore:', err);
      setItems(localSaved.sort((a, b) => b.createdAt - a.createdAt));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedPrompts();
  }, []);

  const handleDelete = async (item: SavedPromptItem, e?: React.MouseEvent) => {
    e?.stopPropagation();

    setItems((prev) => prev.filter((i) => i.id !== item.id && i.combinedPrompt !== item.combinedPrompt));

    try {
      const raw = localStorage.getItem('saved_prompts_list');
      if (raw) {
        const list: SavedPromptItem[] = JSON.parse(raw);
        const filtered = list.filter((i) => i.id !== item.id && i.combinedPrompt !== item.combinedPrompt);
        localStorage.setItem('saved_prompts_list', JSON.stringify(filtered));
      }
    } catch (err) {
      console.error('Error updating localStorage:', err);
    }

    try {
      try {
        await deleteDoc(doc(db, 'saved_prompts', item.id));
      } catch {}

      const q = query(collection(db, 'saved_prompts'), limit(50));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        if (docSnap.id === item.id || d.combinedPrompt === item.combinedPrompt) {
          await deleteDoc(doc(db, 'saved_prompts', docSnap.id));
        }
      }
    } catch (err) {
      console.error('Error deleting from Firestore:', err);
    }
  };

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(itemId);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      const matchPrompt = item.combinedPrompt.toLowerCase().includes(term);
      const matchDesc = item.spanishDescription?.toLowerCase().includes(term);
      const matchCat = item.category?.toLowerCase().includes(term);
      const matchChat = item.chatMessages?.some((m) => m.text.toLowerCase().includes(term));
      return matchPrompt || matchDesc || matchCat || matchChat;
    });
  }, [items, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-[#382823] border border-[#564039] rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#43302A] border border-[#564039] flex items-center justify-center text-[#E0B94F]">
              <Bookmark className="w-3.5 h-3.5 fill-[#E0B94F]" strokeWidth={1.75} />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-[#F2E9DD]">
              {t('savedTab')}
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#43302A] text-[#B7AAA0] border border-[#564039]">
              {items.length}
            </span>
          </div>
          <p className="text-xs text-[#B7AAA0]">
            {language === 'es'
              ? 'Tus prompts guardados junto a la sesión y ajustes del asistente'
              : 'Your saved prompts with conversation history and adjustments'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#B7AAA0] absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'es' ? 'Buscar guardados...' : 'Search saved...'}
              className="w-full bg-[#2D201C] border border-[#564039] focus:border-[#E0B94F] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#F2E9DD] placeholder:text-[#B7AAA0]/60 outline-none transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#B7AAA0] hover:text-[#F2E9DD] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onGoToCreate}
            className="btn-primary text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{t('create')}</span>
          </button>
        </div>
      </div>

      {/* Grid of Saved Prompts */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-[#382823] border border-[#564039] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="w-full h-44 bg-[#2D201C] rounded-xl" />
              <div className="h-3.5 bg-[#43302A] rounded w-2/3" />
              <div className="h-3 bg-[#43302A] rounded w-full" />
              <div className="h-3 bg-[#43302A] rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#382823] border border-[#564039] rounded-2xl p-10 text-center max-w-sm mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#43302A] border border-[#564039] flex items-center justify-center text-[#B7AAA0]">
            <Bookmark className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#F2E9DD]">
              {t('noSavedItems')}
            </h3>
            <p className="text-xs text-[#B7AAA0] leading-relaxed">
              {t('noSavedItemsDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToCreate}
            className="btn-primary text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{language === 'es' ? 'Crear prompt' : 'Create prompt'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isCopied = copiedPromptId === item.id;
            const messagesCount = item.chatMessages ? item.chatMessages.length : 0;
            const formattedDate = new Date(item.createdAt).toLocaleDateString(
              language === 'es' ? 'es-ES' : 'en-US',
              { month: 'short', day: 'numeric' }
            );

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="bg-[#382823] border border-[#564039] hover:border-[#E0B94F]/40 rounded-2xl flex flex-col overflow-hidden group cursor-pointer transition-all duration-200"
                onClick={() => onOpenInEditor(item)}
              >
                {/* Image Preview */}
                <div className="relative aspect-4/3 bg-[#2D201C] overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt="Saved Prompt"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#382823]/90 text-[#E0B94F] border border-[#564039]">
                      {getCategoryLabel(item.category || 'General', language)}
                    </span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item, e)}
                      className="p-1.5 rounded-lg bg-[#382823]/90 border border-[#564039] text-[#B7AAA0] hover:text-[#A8556B] hover:border-[#A8556B]/50 hover:bg-[#43302A] transition-colors cursor-pointer active:scale-[0.95]"
                      title={t('deletePrompt')}
                      aria-label="Eliminar prompt guardado"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>

                  {messagesCount > 0 && (
                    <div className="absolute bottom-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#2D201C]/90 text-[#F2E9DD] border border-[#564039] flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-[#E0B94F]" strokeWidth={1.75} />
                        <span>
                          {messagesCount} {messagesCount === 1 ? 'msj' : 'msjs'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#B7AAA0]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={1.75} />
                        {formattedDate}
                      </span>
                      {item.generationDuration !== undefined && (
                        <span className="font-mono text-[10px] text-[#72B6A4] bg-[#43302A] px-1.5 py-0.5 rounded border border-[#564039]">
                          {item.generationDuration}s
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#F2E9DD] leading-relaxed line-clamp-3 font-mono select-text whitespace-pre-wrap break-words">
                      {item.combinedPrompt}
                    </p>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-2.5 border-t border-[#564039] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] font-medium text-[#E0B94F] flex items-center gap-1 group-hover:underline">
                      <Sparkles className="w-3 h-3" strokeWidth={1.75} />
                      <span>{language === 'es' ? 'Editar' : 'Edit'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(item.combinedPrompt, item.id);
                      }}
                      className="p-1.5 rounded-lg text-[#B7AAA0] hover:text-[#F2E9DD] hover:bg-[#43302A] transition-colors cursor-pointer active:scale-[0.95]"
                      title={t('copyPrompt')}
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-[#72B6A4]" strokeWidth={2} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default SavedPrompts;
