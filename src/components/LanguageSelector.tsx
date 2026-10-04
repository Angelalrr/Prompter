import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage, Language } from '../i18n';

export interface LanguageOption {
  code: Language;
  label: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español', native: 'Español' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'de', label: 'Deutsch', native: 'Deutsch' },
  { code: 'it', label: 'Italiano', native: 'Italiano' },
  { code: 'pt', label: 'Português', native: 'Português' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Language) => {
    if (code !== language) {
      setLanguage(code);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        id="language-selector-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Seleccionar idioma"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#382823] border border-[#564039] hover:border-[#E0B94F]/50 text-[#F2E9DD] transition-colors cursor-pointer select-none active:scale-[0.97]"
      >
        <Globe className="w-3.5 h-3.5 text-[#B7AAA0]" strokeWidth={1.75} />
        <span className="text-xs font-semibold tracking-wider text-[#F2E9DD]">
          {currentLang.code.toUpperCase()}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#B7AAA0] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="language-dropdown-menu"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#382823] border border-[#564039] shadow-2xl p-1 z-50 focus:outline-none overflow-hidden"
          >
            <div className="space-y-0.5" role="menu" aria-orientation="vertical">
              {LANGUAGES.map((item) => {
                const isSelected = item.code === language;
                return (
                  <button
                    key={item.code}
                    id={`language-option-${item.code}`}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(item.code)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#43302A] text-[#E0B94F] font-semibold'
                        : 'text-[#F2E9DD] hover:bg-[#43302A] hover:text-[#F2E9DD]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#B7AAA0] uppercase w-5">
                        {item.code}
                      </span>
                      <span>{item.native}</span>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={2} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LanguageSelector;
