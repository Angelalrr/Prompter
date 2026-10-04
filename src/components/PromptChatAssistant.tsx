import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  Undo2, 
  Redo2, 
  Loader2, 
  Clock, 
  Users 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkTextSecurity } from '../utils/security';
import { useLanguage } from '../i18n';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isViolation?: boolean;
  violationType?: string;
  warningMessage?: string;
  originalSnippet?: string | null;
  newSnippet?: string | null;
  durationSeconds?: number;
}

interface PromptChatAssistantProps {
  currentPrompt: string;
  onPromptUpdated: (newPrompt: string, originalSnippet?: string | null, newSnippet?: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSaveSession?: () => void;
  isSavingSession?: boolean;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onRevertPrompt?: () => void;
  canRevert?: boolean;
}

export function PromptChatAssistant({
  currentPrompt,
  onPromptUpdated,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  initialMessages,
  onMessagesChange,
  onRevertPrompt,
  canRevert = false,
}: PromptChatAssistantProps) {
  const { language, t } = useLanguage();
  
  const handleUndoAction = onUndo || onRevertPrompt;
  const isUndoAvailable = canUndo || canRevert;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        text: language === 'es' 
          ? 'Puedo ajustar cualquier detalle del prompt: cambiar ropa, clima, hora del día, iluminación, estilo de cámara o fondo. ¿Qué deseas modificar?' 
          : 'I can refine any detail of the prompt: outfit, weather, time of day, lighting, lens specs, or background. What would you like to modify?',
        timestamp: Date.now(),
      }
    ];
  });

  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeWarning, setActiveWarning] = useState<string | null>(null);
  const [chatElapsedSeconds, setChatElapsedSeconds] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const quickSuggestions = [
    {
      label: language === 'es' ? 'Luz dorada de atardecer' : 'Golden hour lighting',
      prompt: language === 'es' ? 'Cambia la iluminación a luz dorada de atardecer cálido y cinematográfico' : 'Change lighting to warm golden hour cinematic glow',
    },
    {
      label: language === 'es' ? 'Clima lluvioso con reflejos' : 'Rainy with reflections',
      prompt: language === 'es' ? 'Haz que el clima sea lluvioso con charcos y reflejos en el suelo' : 'Make weather rainy with wet ground reflections and puddles',
    },
    {
      label: language === 'es' ? 'Chaqueta de cuero negro' : 'Black leather jacket',
      prompt: language === 'es' ? 'Cambia la ropa a una chaqueta de cuero negro elegante y moderna' : 'Change outfit to a sleek and modern black leather jacket',
    },
    {
      label: language === 'es' ? 'Fondo de ciudad nocturna' : 'Night skyline background',
      prompt: language === 'es' ? 'Cambia el fondo a un horizonte nocturno con luces de rascacielos' : 'Change background to a night skyline with skyscraper lights',
    },
  ];

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride || inputValue).trim();
    if (!textToSend || isProcessing) return;

    const userMessageId = `user-${Date.now()}`;
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue('');
    setActiveWarning(null);
    setChatElapsedSeconds(0);
    setIsProcessing(true);

    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setChatElapsedSeconds(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
    }, 100);

    const clientSecurity = checkTextSecurity(textToSend);
    if (!clientSecurity.isSafe) {
      setTimeout(() => {
        const warningMsg: ChatMessage = {
          id: `warn-${Date.now()}`,
          sender: 'assistant',
          text: clientSecurity.warningMessage || 'No se puede procesar esta solicitud.',
          timestamp: Date.now(),
          isViolation: true,
          violationType: clientSecurity.violationType,
          warningMessage: clientSecurity.warningMessage,
          durationSeconds: 0.3,
        };
        setMessages((prev) => [...prev, warningMsg]);
        setActiveWarning(clientSecurity.warningMessage || 'Solicitud no permitida');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsProcessing(false);
      }, 400);
      return;
    }

    try {
      const response = await fetch('/api/chat-modify-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: textToSend,
          current_prompt: currentPrompt,
          conversation_history: messages.slice(-6).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      const durationSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

      if (data.is_security_violation) {
        const warningMsg: ChatMessage = {
          id: `warn-${Date.now()}`,
          sender: 'assistant',
          text: data.explanation || 'Solicitud no permitida.',
          timestamp: Date.now(),
          isViolation: true,
          violationType: data.violation_type,
          warningMessage: data.explanation,
          durationSeconds: durationSec,
        };
        setMessages((prev) => [...prev, warningMsg]);
        setActiveWarning(data.explanation || 'Solicitud no permitida');
      } else {
        const successMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.explanation || 'He aplicado el cambio solicitado.',
          timestamp: Date.now(),
          originalSnippet: data.original_phrase_or_element,
          newSnippet: data.new_phrase_or_element,
          durationSeconds: durationSec,
        };
        setMessages((prev) => [...prev, successMsg]);

        if (data.updated_combined_prompt) {
          onPromptUpdated(
            data.updated_combined_prompt,
            data.original_phrase_or_element,
            data.new_phrase_or_element
          );
        }
      }
    } catch (err: any) {
      console.error('Error modifying prompt:', err);
      const durationSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'Ocurrió un error al procesar el cambio. Por favor, intenta de nuevo.',
          timestamp: Date.now(),
          isViolation: true,
          warningMessage: 'Error de conexión',
          durationSeconds: durationSec,
        },
      ]);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#382823] border border-[#564039] rounded-2xl overflow-hidden flex flex-col transition-all text-[#F2E9DD]">
      {/* Header */}
      <div className="px-4 py-3 bg-[#43302A] border-b border-[#564039] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#382823] border border-[#564039] flex items-center justify-center text-[#E0B94F]">
            <Bot className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-semibold text-xs text-[#F2E9DD]">
                {language === 'es' ? 'Asistente Creativo' : 'Creative Assistant'}
              </h4>
            </div>
            <p className="text-[11px] text-[#B7AAA0]">
              {language === 'es' 
                ? 'Ajustes guiados de ropa, estilo, iluminación o fondo' 
                : 'Guided tweaks for outfit, style, lighting, or background'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo / Redo Actions */}
          <button
            type="button"
            onClick={handleUndoAction}
            disabled={!isUndoAvailable}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#B7AAA0] hover:text-[#F2E9DD] hover:bg-[#382823] rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#B7AAA0] transition-colors cursor-pointer disabled:cursor-not-allowed border border-transparent hover:border-[#564039] active:scale-[0.97]"
            title={language === 'es' ? 'Deshacer cambio' : 'Undo change'}
          >
            <Undo2 className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
            <span className="hidden sm:inline">{language === 'es' ? 'Deshacer' : 'Undo'}</span>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#B7AAA0] hover:text-[#F2E9DD] hover:bg-[#382823] rounded-lg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#B7AAA0] transition-colors cursor-pointer disabled:cursor-not-allowed border border-transparent hover:border-[#564039] active:scale-[0.97]"
            title={language === 'es' ? 'Rehacer cambio' : 'Redo change'}
          >
            <span className="hidden sm:inline">{language === 'es' ? 'Rehacer' : 'Redo'}</span>
            <Redo2 className="w-3.5 h-3.5 text-[#E0B94F]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Active Warning Notification */}
      <AnimatePresence>
        {activeWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#43302A] border-b border-[#A8556B]/40 px-4 py-2.5 text-xs text-[#F2E9DD] flex items-start justify-between"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#A8556B] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <span className="font-semibold text-xs block text-[#F2E9DD]">
                  {language === 'es' ? 'Aviso:' : 'Notice:'}
                </span>
                <span className="text-[11px] text-[#B7AAA0]">{activeWarning}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveWarning(null)}
              className="text-[#B7AAA0] hover:text-[#F2E9DD] text-xs font-medium ml-2 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Stream */}
      <div className="p-4 space-y-3.5 max-h-[340px] min-h-[180px] overflow-y-auto bg-[#2D201C]">
        {messages.map((msg) => {
          if (msg.sender === 'user') {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <div className="max-w-[85%] bg-[#43302A] border border-[#564039] text-[#F2E9DD] font-normal rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed">
                  {msg.text}
                </div>
              </motion.div>
            );
          }

          if (msg.isViolation) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-start"
              >
                <div className="max-w-[90%] bg-[#382823] border border-[#A8556B]/40 text-[#F2E9DD] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#A8556B]">
                    <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>
                      {language === 'es' ? 'Acción no permitida' : 'Action not allowed'}
                    </span>
                  </div>
                  <p className="text-xs text-[#B7AAA0] leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[90%] bg-[#382823] border border-[#564039] text-[#F2E9DD] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-[#43302A] text-[#E0B94F] flex items-center justify-center text-[9px] font-bold border border-[#564039]">
                      IA
                    </span>
                    <span className="text-xs font-medium text-[#F2E9DD]">
                      {language === 'es' ? 'Asistente' : 'Assistant'}
                    </span>
                  </div>
                  {msg.durationSeconds !== undefined && (
                    <span className="text-[10px] font-mono text-[#B7AAA0] flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" strokeWidth={1.75} />
                      {msg.durationSeconds}s
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-[#F2E9DD]">
                  {msg.text}
                </p>

                {(msg.originalSnippet || msg.newSnippet) && (
                  <div className="p-2.5 bg-[#2D201C] rounded-lg border border-[#564039] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#B7AAA0]">
                        {language === 'es' ? 'Cambio aplicado:' : 'Applied change:'}
                      </span>
                      {isUndoAvailable && (
                        <button
                          type="button"
                          onClick={handleUndoAction}
                          className="text-[11px] font-medium text-[#E0B94F] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Undo2 className="w-3 h-3" strokeWidth={1.75} />
                          <span>{language === 'es' ? 'Deshacer' : 'Undo'}</span>
                        </button>
                      )}
                    </div>
                    {msg.originalSnippet && (
                      <div className="flex items-baseline gap-1.5 text-[11px]">
                        <span className="text-[#B7AAA0]">{language === 'es' ? 'Antes:' : 'Before:'}</span>
                        <span className="line-through text-[#B7AAA0] italic">
                          "{msg.originalSnippet}"
                        </span>
                      </div>
                    )}
                    {msg.newSnippet && (
                      <div className="flex items-baseline gap-1.5 text-[11px]">
                        <span className="text-[#E0B94F] font-medium">{language === 'es' ? 'Ahora:' : 'Now:'}</span>
                        <span className="text-[#F2E9DD] font-mono">
                          "{msg.newSnippet}"
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start py-1"
          >
            <div className="max-w-[90%] w-full bg-[#382823] border border-[#564039] text-[#F2E9DD] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-[#43302A] text-[#E0B94F] flex items-center justify-center text-[9px] font-bold border border-[#564039]">
                    IA
                  </span>
                  <span className="text-xs text-[#B7AAA0]">
                    {language === 'es' ? 'Escribiendo respuesta...' : 'Thinking...'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#E0B94F] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 animate-pulse" strokeWidth={1.75} />
                  {chatElapsedSeconds.toFixed(1)}s
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="h-2.5 w-4/5 bg-[#43302A] rounded animate-pulse" />
                <div className="h-2.5 w-2/3 bg-[#43302A] rounded animate-pulse" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-3.5 py-2.5 bg-[#382823] border-t border-[#564039] flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] font-medium uppercase text-[#B7AAA0] tracking-wider shrink-0 mr-1">
          {language === 'es' ? 'Sugerencias:' : 'Ideas:'}
        </span>
        {quickSuggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(item.prompt)}
            disabled={isProcessing}
            className="px-2.5 py-1 bg-[#43302A] hover:bg-[#4E3831] border border-[#564039] hover:border-[#E0B94F]/40 text-[#B7AAA0] hover:text-[#F2E9DD] text-[11px] rounded-lg transition-colors shrink-0 disabled:opacity-40 cursor-pointer active:scale-[0.97]"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-[#382823] border-t border-[#564039]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              language === 'es'
                ? 'Indica un cambio (ej. "chaqueta de cuero", "luz de atardecer")...'
                : 'Describe an adjustment (e.g. "leather jacket", "sunset light")...'
            }
            disabled={isProcessing}
            className="w-full pl-3.5 pr-12 py-2.5 bg-[#2D201C] border border-[#564039] focus:border-[#E0B94F] text-[#F2E9DD] placeholder:text-[#B7AAA0]/60 rounded-xl text-xs sm:text-sm outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="absolute right-1.5 p-2 bg-[#E0B94F] hover:bg-[#E9C662] disabled:bg-[#43302A] text-[#2D201C] disabled:text-[#B7AAA0]/50 rounded-lg transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed active:scale-[0.95]"
            aria-label="Enviar"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
export default PromptChatAssistant;
