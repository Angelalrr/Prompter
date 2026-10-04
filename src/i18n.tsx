import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it';

const translations = {
  en: {
    create: 'Create',
    communityFeed: 'Community Feed',
    appTitle: 'Prompt Studio',
    appDescription: 'Extract the exact prompt from any image or Pinterest pin, then publish it to the community feed.',
    searchPlaceholder: 'Search by keyword or AI description...',
    newest: 'Newest',
    popular: 'Popular',
    all: 'All',
    noPosts: 'No posts yet. Be the first to share a prompt!',
    save: 'Save',
    saved: 'Saved',
    viewDetails: 'View Details',
    aiGeneratedPrompt: 'AI Generated Prompt',
    showAiVision: 'Show AI Vision',
    noObjectsDetected: 'No objects detected',
    promptDetails: 'Prompt Details',
    copyPrompt: 'Copy Prompt',
    copy: 'Copy',
    viewFullPrompt: 'View Full Prompt',
    hideFullPrompt: 'Hide Full Prompt',
    showLess: 'Show Less',
    viewJsonPrompt: 'VIEW JSON PROMPT',
    hideJsonPrompt: 'HIDE JSON PROMPT',
    step1: '1. Reference Image',
    uploadYourReference: 'Upload your reference',
    dragDrop: 'Drag and drop or click to browse',
    replaceImage: 'Replace Image',
    or: 'OR',
    pastePinterestPlaceholder: 'Paste any link (webpage, Pinterest pin, or direct image URL)...',
    pasteUrlPlaceholder: 'Paste any link (webpage, Pinterest pin, or direct image URL)...',
    fetch: 'Fetch',
    fetching: 'Fetching...',
    tweaksInstructions: '2. Tweaks & Instructions',
    optional: 'Optional',
    customInstructionsPlaceholder: 'e.g., Change the jacket to red leather, make it raining, cinematic lighting...',
    generatePrompt: 'Generate Prompt',
    analyzingImage: 'Analyzing Image...',
    aiWritingPrompt: 'AI is writing your prompt...',
    analyzingLayers: 'Analyzing layers, detecting objects, and crafting the description',
    aiVisionExtraction: 'AI Vision Extraction',
    publishToFeed: 'Publish to Community Feed',
    publishing: 'Publishing...',
    publishedToFeed: 'Published to Feed!',
    combinedFinalPrompt: 'Combined Final Prompt',
    jsonPromptEditable: 'JSON Prompt',
    jsonPromptProtected: 'JSON Prompt',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Modified detail',
    undoChange: 'Undo',
    undo: 'Undo',
    redo: 'Redo',
    undoTooltip: 'Undo prompt change',
    redoTooltip: 'Redo prompt change',
    securityActive: '',
    copyJson: 'Copy JSON',
    description: 'Description:',
    catGeneral: 'General',
    catPortrait: 'Portrait',
    catBeach: 'Beach Candid',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Saved',
    saveSession: 'Save Conversation & Info',
    savedSessionSuccess: 'Saved to your Saved tab!',
    openInEditor: 'Open in Editor',
    noSavedItems: 'No saved prompts yet',
    noSavedItemsDesc: 'Save your generated prompts and chat adjustments to revisit them anytime.',
    savedConversation: 'Saved conversation',
    deletePrompt: 'Delete',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'High demand',
    highDemandNotice: 'Several users are using the AI right now.',
  },
  es: {
    create: 'Crear',
    communityFeed: 'Comunidad',
    appTitle: 'Prompt Studio',
    appDescription: 'Extrae el prompt exacto de cualquier imagen o pin de Pinterest, y publícalo en la comunidad.',
    searchPlaceholder: 'Buscar por palabra clave o descripción...',
    newest: 'Más recientes',
    popular: 'Populares',
    all: 'Todos',
    noPosts: 'Aún no hay publicaciones. ¡Sé el primero en compartir!',
    save: 'Guardar',
    saved: 'Guardado',
    viewDetails: 'Ver Detalles',
    aiGeneratedPrompt: 'Prompt Generado por IA',
    showAiVision: 'Ver Visión de IA',
    noObjectsDetected: 'Sin objetos detectados',
    promptDetails: 'Detalles del Prompt',
    copyPrompt: 'Copiar Prompt',
    copy: 'Copiar',
    viewFullPrompt: 'Ver Prompt Completo',
    hideFullPrompt: 'Ocultar Prompt',
    showLess: 'Mostrar Menos',
    viewJsonPrompt: 'VER PROMPT JSON',
    hideJsonPrompt: 'OCULTAR PROMPT JSON',
    step1: '1. Imagen de Referencia',
    uploadYourReference: 'Sube tu referencia',
    dragDrop: 'Arrastra y suelta o haz clic para buscar',
    replaceImage: 'Reemplazar Imagen',
    or: 'O',
    pastePinterestPlaceholder: 'Pega cualquier enlace (página web, pin de Pinterest o imagen directa)...',
    pasteUrlPlaceholder: 'Pega cualquier enlace (página web, pin de Pinterest o imagen directa)...',
    fetch: 'Obtener',
    fetching: 'Obteniendo...',
    tweaksInstructions: '2. Ajustes e Instrucciones',
    optional: 'Opcional',
    customInstructionsPlaceholder: 'ej., Cambia la chaqueta a cuero rojo, que esté lloviendo, iluminación cinematográfica...',
    generatePrompt: 'Generar Prompt',
    analyzingImage: 'Analizando Imagen...',
    aiWritingPrompt: 'La IA está redactando tu prompt...',
    analyzingLayers: 'Analizando capas, detectando objetos y estructurando la descripción',
    aiVisionExtraction: 'Extracción de Visión IA',
    publishToFeed: 'Publicar en la Comunidad',
    publishing: 'Publicando...',
    publishedToFeed: '¡Publicado en el Feed!',
    combinedFinalPrompt: 'Prompt Final Combinado',
    jsonPromptEditable: 'Prompt JSON',
    jsonPromptProtected: 'Prompt JSON',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Detalle modificado',
    undoChange: 'Deshacer',
    undo: 'Deshacer',
    redo: 'Rehacer',
    undoTooltip: 'Deshacer cambio en el prompt',
    redoTooltip: 'Rehacer cambio en el prompt',
    securityActive: '',
    copyJson: 'Copiar JSON',
    description: 'Descripción:',
    catGeneral: 'General',
    catPortrait: 'Retrato',
    catBeach: 'Playa Casual',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Guardados',
    saveSession: 'Guardar Conversación y Prompts',
    savedSessionSuccess: '¡Conversación y prompts guardados!',
    openInEditor: 'Abrir en el Editor',
    noSavedItems: 'Aún no tienes prompts guardados',
    noSavedItemsDesc: 'Guarda tus prompts generados y las conversaciones del bot para abrirlos cuando quieras.',
    savedConversation: 'Conversación guardada',
    deletePrompt: 'Eliminar',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'Alta demanda',
    highDemandNotice: 'Varios usuarios están usando la IA ahora.',
  },
  fr: {
    create: 'Créer',
    communityFeed: 'Communauté',
    appTitle: 'Prompt Studio',
    appDescription: 'Extrayez le prompt exact de n\'importe quelle image ou pin Pinterest et publiez-le.',
    searchPlaceholder: 'Rechercher par mot-clé ou description...',
    newest: 'Plus récents',
    popular: 'Populaires',
    all: 'Tous',
    noPosts: 'Aucune publication pour le moment. Soyez le premier à partager !',
    save: 'Enregistrer',
    saved: 'Enregistré',
    viewDetails: 'Voir les Détails',
    aiGeneratedPrompt: 'Prompt Généré par l\'IA',
    showAiVision: 'Voir Vision IA',
    noObjectsDetected: 'Aucun objet détecté',
    promptDetails: 'Détails du Prompt',
    copyPrompt: 'Copier le Prompt',
    copy: 'Copier',
    viewFullPrompt: 'Voir Prompt Complet',
    hideFullPrompt: 'Masquer le Prompt',
    showLess: 'Voir Moins',
    viewJsonPrompt: 'VOIR PROMPT JSON',
    hideJsonPrompt: 'MASQUER PROMPT JSON',
    step1: '1. Image de Référence',
    uploadYourReference: 'Uploadez votre référence',
    dragDrop: 'Glissez-déposez ou parcourez',
    replaceImage: 'Remplacer l\'Image',
    or: 'OU',
    pastePinterestPlaceholder: 'Collez n\'importe quel lien (page web, pin Pinterest ou image directe)...',
    pasteUrlPlaceholder: 'Collez n\'importe quel lien (page web, pin Pinterest ou image directe)...',
    fetch: 'Obtenir',
    fetching: 'Récupération...',
    tweaksInstructions: '2. Ajustements & Instructions',
    optional: 'Optionnel',
    customInstructionsPlaceholder: 'ex: Veste en cuir rouge, temps pluvieux, éclairage cinématographique...',
    generatePrompt: 'Générer le Prompt',
    analyzingImage: 'Analyse de l\'image...',
    aiWritingPrompt: 'L\'IA rédige votre prompt...',
    analyzingLayers: 'Analyse des calques, détection des objets et rédaction de la description',
    aiVisionExtraction: 'Extraction Vision IA',
    publishToFeed: 'Publier dans la Communauté',
    publishing: 'Publication...',
    publishedToFeed: 'Publié dans le Feed !',
    combinedFinalPrompt: 'Prompt Final Combiné',
    jsonPromptEditable: 'Prompt JSON',
    jsonPromptProtected: 'Prompt JSON',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Détail modifié',
    undoChange: 'Annuler',
    undo: 'Annuler',
    redo: 'Rétablir',
    undoTooltip: 'Annuler modification du prompt',
    redoTooltip: 'Rétablir modification du prompt',
    securityActive: '',
    copyJson: 'Copier JSON',
    description: 'Description :',
    catGeneral: 'Général',
    catPortrait: 'Portrait',
    catBeach: 'Plage Décontractée',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Enregistrés',
    saveSession: 'Sauvegarder Conversation & Infos',
    savedSessionSuccess: 'Enregistré dans vos favoris !',
    openInEditor: 'Ouvrir dans l\'Éditeur',
    noSavedItems: 'Aucun prompt enregistré',
    noSavedItemsDesc: 'Sauvegardez vos prompts et conversations pour y revenir à tout moment.',
    savedConversation: 'Conversation enregistrée',
    deletePrompt: 'Supprimer',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'Forte demande',
    highDemandNotice: 'Plusieurs utilisateurs utilisent l\'IA actuellement.',
  },
  de: {
    create: 'Erstellen',
    communityFeed: 'Community',
    appTitle: 'Prompt Studio',
    appDescription: 'Extrahieren Sie den exakten Prompt aus jedem Bild oder Pinterest-Pin.',
    searchPlaceholder: 'Suche nach Stichwort oder Beschreibung...',
    newest: 'Neueste',
    popular: 'Beliebt',
    all: 'Alle',
    noPosts: 'Noch keine Beiträge. Seien Sie der Erste!',
    save: 'Speichern',
    saved: 'Gespeichert',
    viewDetails: 'Details Ansehen',
    aiGeneratedPrompt: 'KI Generierter Prompt',
    showAiVision: 'KI-Vision zeigen',
    noObjectsDetected: 'Keine Objekte erkannt',
    promptDetails: 'Prompt Details',
    copyPrompt: 'Prompt Kopieren',
    copy: 'Kopieren',
    viewFullPrompt: 'Vollständigen Prompt Ansehen',
    hideFullPrompt: 'Prompt Verbergen',
    showLess: 'Weniger Anzeigen',
    viewJsonPrompt: 'JSON PROMPT ANSEHEN',
    hideJsonPrompt: 'JSON PROMPT VERBERGEN',
    step1: '1. Referenzbild',
    uploadYourReference: 'Referenz hochladen',
    dragDrop: 'Ziehen & ablegen oder durchsuchen',
    replaceImage: 'Bild Ersetzen',
    or: 'ODER',
    pastePinterestPlaceholder: 'Beliebigen Link einfügen (Webseite, Pinterest-Pin oder Direktbild)...',
    pasteUrlPlaceholder: 'Beliebigen Link einfügen (Webseite, Pinterest-Pin oder Direktbild)...',
    fetch: 'Abrufen',
    fetching: 'Abrufen...',
    tweaksInstructions: '2. Anpassungen & Anweisungen',
    optional: 'Optional',
    customInstructionsPlaceholder: 'z.B.: Rote Lederjacke, regnerisch, filmische Beleuchtung...',
    generatePrompt: 'Prompt Generieren',
    analyzingImage: 'Bild wird analysiert...',
    aiWritingPrompt: 'Die KI schreibt Ihren Prompt...',
    analyzingLayers: 'Ebenen analysieren, Objekte erkennen und Beschreibung erstellen',
    aiVisionExtraction: 'KI-Vision Extraktion',
    publishToFeed: 'In der Community Veröffentlichen',
    publishing: 'Veröffentlichung...',
    publishedToFeed: 'Im Feed veröffentlicht!',
    combinedFinalPrompt: 'Kombinierter Prompt',
    jsonPromptEditable: 'JSON Prompt',
    jsonPromptProtected: 'JSON Prompt',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Geändertes Detail',
    undoChange: 'Rückgängig',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    undoTooltip: 'Prompt-Änderung rückgängig machen',
    redoTooltip: 'Prompt-Änderung wiederholen',
    securityActive: '',
    copyJson: 'JSON Kopieren',
    description: 'Beschreibung:',
    catGeneral: 'Allgemein',
    catPortrait: 'Porträt',
    catBeach: 'Strand Authentisch',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Gespeichert',
    saveSession: 'Unterhaltung & Prompts speichern',
    savedSessionSuccess: 'In Gespeichert abgelegt!',
    openInEditor: 'Im Editor öffnen',
    noSavedItems: 'Noch keine Prompts gespeichert',
    noSavedItemsDesc: 'Speichern Sie Ihre Prompts und Chat-Verläufe, um jederzeit darauf zuzugreifen.',
    savedConversation: 'Gespeicherte Unterhaltung',
    deletePrompt: 'Löschen',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'Hohe Nachfrage',
    highDemandNotice: 'Mehrere Benutzer verwenden derzeit die KI.',
  },
  it: {
    create: 'Crea',
    communityFeed: 'Comunità',
    appTitle: 'Prompt Studio',
    appDescription: 'Estrai il prompt esatto da qualsiasi immagine o pin di Pinterest e pubblicalo.',
    searchPlaceholder: 'Cerca per parola chiave o descrizione...',
    newest: 'Più Recenti',
    popular: 'Popolari',
    all: 'Tutti',
    noPosts: 'Nessun post ancora. Sii il primo a condividere!',
    save: 'Salva',
    saved: 'Salvato',
    viewDetails: 'Vedi Dettagli',
    aiGeneratedPrompt: 'Prompt Generato dall\'IA',
    showAiVision: 'Mostra Visione IA',
    noObjectsDetected: 'Nessun oggetto rilevato',
    promptDetails: 'Dettagli Prompt',
    copyPrompt: 'Copia Prompt',
    copy: 'Copia',
    viewFullPrompt: 'Vedi Prompt Completo',
    hideFullPrompt: 'Nascondi Prompt',
    showLess: 'Mostra Meno',
    viewJsonPrompt: 'VEDI PROMPT JSON',
    hideJsonPrompt: 'NASCONDI PROMPT JSON',
    step1: '1. Immagine di Riferimento',
    uploadYourReference: 'Carica la tua immagine',
    dragDrop: 'Trascina e rilascia o sfoglia',
    replaceImage: 'Sostituisci Immagine',
    or: 'OPPURE',
    pastePinterestPlaceholder: 'Incolla qualsiasi link (pagina web, pin di Pinterest o immagine diretta)...',
    pasteUrlPlaceholder: 'Incolla qualsiasi link (pagina web, pin di Pinterest o immagine diretta)...',
    fetch: 'Recupera',
    fetching: 'Recupero...',
    tweaksInstructions: '2. Modifiche & Istruzioni',
    optional: 'Opzionale',
    customInstructionsPlaceholder: 'es. Giacca in pelle rossa, pioggia, illuminazione cinematografica...',
    generatePrompt: 'Genera Prompt',
    analyzingImage: 'Analisi immagine...',
    aiWritingPrompt: 'L\'IA sta scrivendo il tuo prompt...',
    analyzingLayers: 'Analisi dei livelli, rilevamento oggetti e stesura della descrizione',
    aiVisionExtraction: 'Estrazione Visione IA',
    publishToFeed: 'Pubblica nella Comunità',
    publishing: 'Pubblicazione...',
    publishedToFeed: 'Pubblicato nel Feed!',
    combinedFinalPrompt: 'Prompt Finale Combinato',
    jsonPromptEditable: 'Prompt JSON',
    jsonPromptProtected: 'Prompt JSON',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Dettaglio modificato',
    undoChange: 'Annulla',
    undo: 'Annulla',
    redo: 'Ripeti',
    undoTooltip: 'Annulla modifica al prompt',
    redoTooltip: 'Ripeti modifica al prompt',
    securityActive: '',
    copyJson: 'Copia JSON',
    description: 'Descrizione:',
    catGeneral: 'Generale',
    catPortrait: 'Ritratto',
    catBeach: 'Spiaggia Spontanea',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Salvati',
    saveSession: 'Salva Conversazione e Prompt',
    savedSessionSuccess: 'Salvato nella scheda Salvati!',
    openInEditor: 'Apri nell\'Editor',
    noSavedItems: 'Nessun prompt salvato',
    noSavedItemsDesc: 'Salva i tuoi prompt e le conversazioni del bot per riaprirli quando vuoi.',
    savedConversation: 'Conversazione salvata',
    deletePrompt: 'Elimina',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'Alta richiesta',
    highDemandNotice: 'Diversi utenti stanno usando l\'IA adesso.',
  },
  pt: {
    create: 'Criar',
    communityFeed: 'Comunidade',
    appTitle: 'Prompt Studio',
    appDescription: 'Extraia o prompt exato de qualquer imagem ou pin do Pinterest e publique na comunidade.',
    searchPlaceholder: 'Buscar por palavra-chave ou descrição...',
    newest: 'Mais Recentes',
    popular: 'Populares',
    all: 'Todos',
    noPosts: 'Ainda não há postagens. Seja o primeiro a compartilhar!',
    save: 'Salvar',
    saved: 'Salvo',
    viewDetails: 'Ver Detalhes',
    aiGeneratedPrompt: 'Prompt Gerado por IA',
    showAiVision: 'Mostrar Visão IA',
    noObjectsDetected: 'Nenhum objeto detectado',
    promptDetails: 'Detalhes do Prompt',
    copyPrompt: 'Copiar Prompt',
    copy: 'Copiar',
    viewFullPrompt: 'Ver Prompt Completo',
    hideFullPrompt: 'Ocultar Prompt',
    showLess: 'Mostrar Menos',
    viewJsonPrompt: 'VER PROMPT JSON',
    hideJsonPrompt: 'OCULTAR PROMPT JSON',
    step1: '1. Imagem de Referência',
    uploadYourReference: 'Carregue sua referência',
    dragDrop: 'Arraste e solte ou clique para procurar',
    replaceImage: 'Substituir Imagem',
    or: 'OU',
    pastePinterestPlaceholder: 'Cole qualquer link (página web, pin do Pinterest ou imagem direta)...',
    pasteUrlPlaceholder: 'Cole qualquer link (página web, pin do Pinterest ou imagem direta)...',
    fetch: 'Buscar',
    fetching: 'Buscando...',
    tweaksInstructions: '2. Ajustes e Instruções',
    optional: 'Opcional',
    customInstructionsPlaceholder: 'ex: Jaqueta de couro vermelha, chuva, iluminação cinematográfica...',
    generatePrompt: 'Gerar Prompt',
    analyzingImage: 'Analisando Imagem...',
    aiWritingPrompt: 'A IA está escrevendo seu prompt...',
    analyzingLayers: 'Analisando camadas, detectando objetos e criando a descrição',
    aiVisionExtraction: 'Extração de Visão IA',
    publishToFeed: 'Publicar na Comunidade',
    publishing: 'Publicando...',
    publishedToFeed: 'Publicado no Feed!',
    combinedFinalPrompt: 'Prompt Final Combinado',
    jsonPromptEditable: 'Prompt JSON',
    jsonPromptProtected: 'Prompt JSON',
    promptLockedNotice: '',
    lastChangeHighlighted: 'Detalhe modificado',
    undoChange: 'Desfazer',
    undo: 'Desfazer',
    redo: 'Refazer',
    undoTooltip: 'Desfazer alteração no prompt',
    redoTooltip: 'Refazer alteração no prompt',
    securityActive: '',
    copyJson: 'Copiar JSON',
    description: 'Descrição:',
    catGeneral: 'Geral',
    catPortrait: 'Retrato',
    catBeach: 'Praia Casual',
    catStreetwear: 'Streetwear',
    catCyberpunk: 'Cyberpunk',
    savedTab: 'Salvos',
    saveSession: 'Salvar Conversa e Prompts',
    savedSessionSuccess: 'Salvo na aba Salvos!',
    openInEditor: 'Abrir no Editor',
    noSavedItems: 'Nenhum prompt salvo ainda',
    noSavedItemsDesc: 'Salve seus prompts gerados e conversas do bot para acessá-los quando quiser.',
    savedConversation: 'Conversa salva',
    deletePrompt: 'Excluir',
    elapsedTime: '',
    generatedIn: '',
    highDemandTitle: 'Alta demanda',
    highDemandNotice: 'Vários usuários estão usando a IA agora.',
  }
};

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'es';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

export const getLanguageFlag = (lang: Language): string => {
  switch (lang) {
    case 'en': return '🇺🇸';
    case 'es': return '🇪🇸';
    case 'fr': return '🇫🇷';
    case 'de': return '🇩🇪';
    case 'it': return '🇮🇹';
    case 'pt': return '🇵🇹';
    default: return '🌐';
  }
};

export const getCategoryLabel = (category: string, lang: Language): string => {
  if (!category) return '';
  const lower = category.trim().toLowerCase();
  const dict = translations[lang] || translations.es;

  if (lower === 'all' || lower === 'todos' || lower === 'all categories') {
    return dict.all;
  }
  if (lower === 'general') {
    return dict.catGeneral;
  }
  if (lower.includes('streetwear')) {
    return dict.catStreetwear;
  }
  if (lower.includes('beach') || lower.includes('playa')) {
    return dict.catBeach;
  }
  if (lower.includes('portrait') || lower.includes('retrato')) {
    return dict.catPortrait;
  }
  if (lower.includes('cyberpunk')) {
    return dict.catCyberpunk;
  }
  return category;
};

// In-memory cache for translations to avoid redundant network calls
const memoryTranslationCache: Record<string, string> = {};

export function useTranslatedText(text: string | undefined): { translated: string; loading: boolean } {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string>(() => {
    if (!text) return '';
    if (language === 'es') return text;
    const cacheKey = `tr_${language}_${text}`;
    if (memoryTranslationCache[cacheKey]) return memoryTranslationCache[cacheKey];
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        memoryTranslationCache[cacheKey] = stored;
        return stored;
      }
    } catch {
      // ignore localStorage errors
    }
    return text;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!text) {
      setTranslated('');
      return;
    }

    if (language === 'es') {
      setTranslated(text);
      return;
    }

    const cacheKey = `tr_${language}_${text}`;
    if (memoryTranslationCache[cacheKey]) {
      setTranslated(memoryTranslationCache[cacheKey]);
      return;
    }

    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        memoryTranslationCache[cacheKey] = stored;
        setTranslated(stored);
        return;
      }
    } catch {
      // ignore
    }

    let isMounted = true;
    setLoading(true);

    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: language }),
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const result = data.translatedText || text;
        memoryTranslationCache[cacheKey] = result;
        try {
          localStorage.setItem(cacheKey, result);
        } catch {
          // ignore
        }
        setTranslated(result);
      })
      .catch(err => {
        console.error('Translation error:', err);
        if (isMounted) setTranslated(text);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [text, language]);

  return { translated, loading };
}

