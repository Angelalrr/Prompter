import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, orderBy, limit, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { Copy, Check, Heart, Sparkles, Image as ImageIcon, Focus, X, Search, Flame, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage, getCategoryLabel, useTranslatedText } from './i18n';

export type Post = {
  id?: string;
  imageUrl: string;
  combinedPrompt: string;
  jsonPrompt: string;
  detectedObjects?: DetectedObject[];
  spanishDescription?: string;
  category?: string;
  likes?: number;
  createdAt: number;
};

type DetectedObject = {
  label: string;
  box_2d: [number, number, number, number];
};

export function Feed() {
  const { language, t } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  const [likedPosts, setLikedPosts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('likedPosts');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  useEffect(() => {
    async function fetchPosts() {
      try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            category: data.category || 'General',
          } as Post;
        });
        setPosts(fetched);
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  const openPost = (post: Post) => {
    setSelectedPost(post);
  };

  const handleLike = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const isLiked = likedPosts.has(postId);
      const postRef = doc(db, 'posts', postId);

      const newLiked = new Set(likedPosts);

      if (isLiked) {
        await updateDoc(postRef, { likes: increment(-1) });
        newLiked.delete(postId);
      } else {
        await updateDoc(postRef, { likes: increment(1) });
        newLiked.add(postId);
      }

      setLikedPosts(newLiked);
      localStorage.setItem('likedPosts', JSON.stringify(Array.from(newLiked)));

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: Math.max(0, (p.likes || 0) + (isLiked ? -1 : 1)) } : p))
      );

      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost({ ...selectedPost, likes: Math.max(0, (selectedPost.likes || 0) + (isLiked ? -1 : 1)) });
      }
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    posts.forEach((p) => {
      if (p.category && p.category.toLowerCase() !== 'all' && p.category.toLowerCase() !== 'todos') {
        cats.add(p.category);
      }
    });
    return ['All', ...Array.from(cats)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let filtered = posts;
    if (activeCategory !== 'All') {
      filtered = filtered.filter((p) => p.category?.toLowerCase() === activeCategory.toLowerCase());
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.category || '').toLowerCase().includes(q) ||
          (p.spanishDescription || '').toLowerCase().includes(q) ||
          p.combinedPrompt.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'popular') {
      filtered = [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    return filtered;
  }, [posts, activeCategory, searchTerm, sortBy]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-12 w-full bg-[#382823] rounded-xl border border-[#564039] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`bg-[#382823] border border-[#564039] rounded-2xl animate-pulse ${
                i % 2 === 0 ? 'h-72' : 'h-88'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-12 h-12 rounded-xl bg-[#382823] border border-[#564039] flex items-center justify-center mx-auto mb-3 text-[#B7AAA0]">
          <ImageIcon className="w-6 h-6" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-[#B7AAA0] font-medium">{t('noPosts')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto mb-8 space-y-4">
        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 sm:p-4 bg-[#382823] border border-[#564039] rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7AAA0]" strokeWidth={1.75} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2D201C] border border-[#564039] focus:border-[#E0B94F] rounded-xl text-xs sm:text-sm text-[#F2E9DD] placeholder:text-[#B7AAA0]/60 outline-none transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#B7AAA0] hover:text-[#F2E9DD] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#2D201C] border border-[#564039] rounded-xl self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setSortBy('newest')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.97] ${
                sortBy === 'newest'
                  ? 'bg-[#43302A] text-[#F2E9DD] border border-[#564039]'
                  : 'text-[#B7AAA0] hover:text-[#F2E9DD]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{t('newest')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.97] ${
                sortBy === 'popular'
                  ? 'bg-[#43302A] text-[#F2E9DD] border border-[#564039]'
                  : 'text-[#B7AAA0] hover:text-[#F2E9DD]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
              <span>{t('popular')}</span>
            </button>
          </div>
        </div>

        {/* Categories Chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {categories.map((cat) => {
              const label = cat === 'All' ? t('all') : getCategoryLabel(cat, language);
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer active:scale-[0.97] ${
                    isActive
                      ? 'bg-[#E0B94F] text-[#2D201C] font-semibold shadow-sm'
                      : 'bg-[#382823] border border-[#564039] text-[#B7AAA0] hover:text-[#F2E9DD] hover:border-[#6B5148]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Responsive Feed Grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 max-w-6xl mx-auto space-y-5">
        {filteredPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            isLiked={likedPosts.has(post.id!)}
            onClick={() => openPost(post)}
            onLike={(e) => handleLike(post.id!, e)}
          />
        ))}
      </div>

      {/* Detail Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedPost && (
              <PostModal
                post={selectedPost}
                isLiked={likedPosts.has(selectedPost.id!)}
                onClose={() => setSelectedPost(null)}
                onLike={() => handleLike(selectedPost.id!)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

interface PostCardProps {
  key?: React.Key;
  post: Post;
  isLiked: boolean;
  onClick: () => void;
  onLike: (e?: React.MouseEvent) => void | Promise<void>;
}

function PostCard({ post, isLiked, onClick, onLike }: PostCardProps) {
  const { language, t } = useLanguage();
  const { translated: cardDescription } = useTranslatedText(post.spanishDescription);

  return (
    <div
      className="break-inside-avoid mb-5 cursor-pointer group bg-[#382823] border border-[#564039] hover:border-[#E0B94F]/40 rounded-2xl overflow-hidden transition-all duration-200"
      onClick={onClick}
    >
      <div className="relative aspect-4/3 sm:aspect-auto overflow-hidden bg-[#2D201C]">
        <img
          src={post.imageUrl}
          alt="Prompt reference"
          className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />

        <div className="absolute top-2.5 right-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLike(e);
            }}
            className={`p-2 rounded-xl transition-colors cursor-pointer active:scale-[0.95] ${
              isLiked
                ? 'bg-[#382823] text-[#A8556B] border border-[#A8556B]/50'
                : 'bg-[#2D201C]/80 text-[#B7AAA0] hover:text-[#F2E9DD] border border-[#564039]'
            }`}
            title={isLiked ? t('saved') : t('save')}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#A8556B]' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {post.category && (
            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#E0B94F]">
              {getCategoryLabel(post.category, language)}
            </span>
          )}
          <span className="text-xs text-[#B7AAA0] flex items-center gap-1 font-mono">
            <Heart className={`w-3 h-3 ${isLiked ? 'text-[#A8556B] fill-[#A8556B]' : 'text-[#B7AAA0]'}`} strokeWidth={1.75} />
            <span>{post.likes || 0}</span>
          </span>
        </div>

        <p className="text-xs text-[#F2E9DD] line-clamp-2 leading-relaxed">
          {cardDescription || post.spanishDescription || post.combinedPrompt}
        </p>
      </div>
    </div>
  );
}

function PostModal({
  post,
  isLiked,
  onClose,
  onLike,
}: {
  post: Post;
  isLiked: boolean;
  onClose: () => void;
  onLike: () => void;
}) {
  const { language, t } = useLanguage();
  const { translated: translatedDescription } = useTranslatedText(post.spanishDescription);
  const [copiedCombined, setCopiedCombined] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showBoxes, setShowBoxes] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  const copyToClipboard = (text: string, type: 'combined' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'combined') {
      setCopiedCombined(true);
      setTimeout(() => setCopiedCombined(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const detectedObjects: DetectedObject[] = post.detectedObjects || [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 bg-[#2D201C]/85 backdrop-blur-sm cursor-pointer"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-4xl max-h-[85vh] bg-[#382823] border border-[#564039] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 text-[#F2E9DD]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 p-2 rounded-xl bg-[#43302A] border border-[#564039] text-[#B7AAA0] hover:text-[#F2E9DD] transition-colors cursor-pointer active:scale-[0.95]"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Left: Image Area */}
        <div className="w-full md:w-1/2 bg-[#2D201C] relative flex items-center justify-center overflow-hidden min-h-[260px] md:min-h-full border-b md:border-b-0 md:border-r border-[#564039]">
          <div
            className="relative cursor-pointer group w-full h-full flex items-center justify-center"
            onClick={() => setShowBoxes(!showBoxes)}
          >
            <img src={post.imageUrl} alt="Artwork" className="w-full h-full object-contain select-none p-3" />

            {detectedObjects.length > 0 && (
              <div className="absolute bottom-3 left-3">
                <div className="px-2.5 py-1 rounded-lg bg-[#382823]/90 border border-[#564039] text-[11px] text-[#B7AAA0] flex items-center gap-1.5">
                  <Focus className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
                  <span>{showBoxes ? t('hideVision') : t('showAiVision')}</span>
                </div>
              </div>
            )}

            {showBoxes &&
              detectedObjects.map((obj, i) => {
                if (!obj.box_2d || obj.box_2d.length !== 4) return null;
                const [ymin, xmin, ymax, xmax] = obj.box_2d;
                const top = `${(ymin / 1000) * 100}%`;
                const left = `${(xmin / 1000) * 100}%`;
                const height = `${((ymax - ymin) / 1000) * 100}%`;
                const width = `${((xmax - xmin) / 1000) * 100}%`;

                return (
                  <div
                    key={i}
                    className="absolute border border-[#E0B94F] bg-[#E0B94F]/15 pointer-events-none"
                    style={{ top, left, width, height }}
                  >
                    <div className="absolute -top-5 left-[-1px] bg-[#E0B94F] text-[#2D201C] text-[9px] font-semibold px-1 py-0.5 rounded-t rounded-br whitespace-nowrap">
                      {obj.label}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: Content & Prompt Details */}
        <div className="w-full md:w-1/2 p-5 sm:p-6 overflow-y-auto space-y-5 bg-[#382823]">
          {/* Header Actions */}
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E0B94F]" strokeWidth={1.75} />
              <h3 className="font-semibold text-sm text-[#F2E9DD]">{t('promptDetails')}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLike}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.97] ${
                  isLiked
                    ? 'bg-[#43302A] text-[#A8556B] border border-[#A8556B]/40'
                    : 'bg-[#43302A] text-[#F2E9DD] border border-[#564039] hover:border-[#6B5148]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#A8556B]' : ''}`} strokeWidth={1.75} />
                <span>{isLiked ? t('saved') : t('save')}</span>
                <span className="font-mono text-[11px] opacity-80">({post.likes || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(post.combinedPrompt, 'combined')}
                className="btn-primary px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5"
              >
                {copiedCombined ? (
                  <Check className="w-3.5 h-3.5 text-[#2D201C]" strokeWidth={2} />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#2D201C]" strokeWidth={1.75} />
                )}
                <span>{copiedCombined ? (language === 'es' ? 'Copiado' : 'Copied') : t('copy')}</span>
              </button>
            </div>
          </div>

          {/* Category */}
          {post.category && (
            <div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-[#43302A] text-[#E0B94F] border border-[#564039]">
                {getCategoryLabel(post.category, language)}
              </span>
            </div>
          )}

          {/* Natural description */}
          {post.spanishDescription && (
            <div className="p-3.5 bg-[#43302A] rounded-xl border border-[#564039] space-y-1">
              <span className="text-[11px] font-medium text-[#E0B94F] block">
                {t('description')}
              </span>
              <p className="text-xs text-[#F2E9DD] leading-relaxed">
                {translatedDescription || post.spanishDescription}
              </p>
            </div>
          )}

          {/* Combined prompt text */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[#B7AAA0] uppercase tracking-wider block">
              Prompt
            </span>
            <p className={`text-xs text-[#F2E9DD] leading-relaxed font-mono bg-[#2D201C] p-3 rounded-xl border border-[#564039] select-text whitespace-pre-wrap break-words ${
              !expandedPrompt ? 'line-clamp-4' : ''
            }`}>
              {post.combinedPrompt}
            </p>
            <button
              type="button"
              onClick={() => setExpandedPrompt(!expandedPrompt)}
              className="text-xs font-medium text-[#E0B94F] hover:underline cursor-pointer"
            >
              {expandedPrompt ? t('showLess') : t('viewFullPrompt')}
            </button>
          </div>

          {/* Structured JSON Section */}
          <div className="pt-2 border-t border-[#564039]">
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="text-xs font-medium text-[#B7AAA0] hover:text-[#F2E9DD] transition-colors w-full text-left flex justify-between items-center py-1 cursor-pointer"
            >
              <span>{showJson ? t('hideJsonPrompt') : t('viewJsonPrompt')}</span>
              <span className="text-xs font-mono">{showJson ? '−' : '+'}</span>
            </button>

            <AnimatePresence>
              {showJson && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mt-3 relative rounded-xl border border-[#564039] bg-[#2D201C] overflow-hidden"
                >
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(post.jsonPrompt, 'json')}
                      className="p-1.5 rounded-lg bg-[#382823] border border-[#564039] text-[#B7AAA0] hover:text-[#F2E9DD] cursor-pointer active:scale-[0.95]"
                      title={t('copy')}
                    >
                      {copiedJson ? (
                        <Check className="w-3.5 h-3.5 text-[#72B6A4]" strokeWidth={2} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                  <pre className="text-[11px] text-[#B7AAA0] p-3.5 overflow-x-auto max-h-[260px] overflow-y-auto font-mono leading-relaxed select-text">
                    <code>{post.jsonPrompt}</code>
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
export default Feed;
