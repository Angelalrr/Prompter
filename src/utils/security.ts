// Security utility for validating prompts and user input against malicious links, obscenities, and attacks

export interface SecurityCheckResult {
  isSafe: boolean;
  violationType?: 'malicious_link' | 'inappropriate_content' | 'discriminatory' | 'erase_prompt' | 'prompt_injection' | 'off_topic';
  warningMessage?: string;
  matchedTerm?: string;
}

// URL and Link Detection
const URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.)[^\s<>"'{}|\\^`]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|mil|io|xyz|app|dev|co|me|site|online|top|info|biz|club|vip|link|ai|tech|ru|cn|tv|store|pro|cc|space|live|page|social|gg|ly|cloud)(?:\/[^\s<>"'{}|\\^`]*)?/i;
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s]*)?\b/;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/i;
const HTML_SCRIPT_REGEX = /<(?:\/)?(?:script|iframe|img|a|form|embed|object|base|svg)[^>]*>/i;
const DOMAIN_SHORTHAND_REGEX = /(?:t\.me|wa\.me|discord\.gg|bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly)\/[a-zA-Z0-9_-]+/i;

// Profanity, vulgarities, slurs, explicit terms in Spanish and English
const PROFANITY_TERMS = [
  // Spanish obscenities / insults / slurs / NSFW
  'puta', 'puto', 'mierda', 'coño', 'verga', 'pene', 'vagina', 'tetas', 'chichi', 'culo',
  'pendejo', 'pendeja', 'pendejos', 'cabron', 'cabrón', 'cabrona', 'hijo de puta', 'hdp',
  'chingar', 'chinga', 'chingada', 'maricon', 'maricón', 'marica', 'culiao', 'culiado',
  'conchatumadre', 'concha de tu madre', 'malparido', 'gonorrea', 'chupapollas', 'gilipollas',
  'polla', 'follar', 'porno', 'pornografía', 'desnuda', 'desnudo', 'xxx', 'sexo oral',
  'violación', 'pedofilia', 'nazi', 'hitler', 'escoria',
  // English obscenities / insults / slurs / NSFW
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'cock',
  'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'bastard', 'porn', 'porno',
  'nude', 'naked', 'nsfw', 'boobs', 'dildo', 'masturbate', 'rape', 'penis', 'vagina',
  'sex', 'erotic', 'incest'
];

// Patterns for prompt wipe/erasure
const ERASE_PATTERNS = [
  /borra(?:r)?\s+(?:todo|el\s+prompt|completamente)/i,
  /elimina(?:r)?\s+(?:todo|el\s+prompt|completo)/i,
  /deja(?:r)?\s+(?:en\s+blanco|vac[ií]o)/i,
  /vac[ií]a(?:r)?\s+(?:el\s+prompt|todo)/i,
  /quitar\s+(?:todo|el\s+prompt)/i,
  /delete\s+(?:all|everything|the\s+prompt)/i,
  /erase\s+(?:all|the\s+prompt|everything)/i,
  /clear\s+(?:all|the\s+prompt|everything)/i,
  /wipe\s+(?:out|the\s+prompt|all)/i,
  /make\s+it\s+(?:empty|blank)/i,
  /reset\s+(?:to\s+empty|prompt)/i
];

// Patterns for prompt injection / jailbreak
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /ignora\s+(?:todas\s+las\s+)?instrucciones/i,
  /system\s+prompt/i,
  /developer\s+mode/i,
  /modo\s+desarrollador/i,
  /act\s+as\s+dan/i,
  /olvida\s+(?:todas\s+)?las\s+reglas/i,
  /disregard\s+all\s+rules/i,
  /override\s+security/i,
  /bypassing\s+safety/i
];

export function checkTextSecurity(text: string): SecurityCheckResult {
  if (!text || typeof text !== 'string') {
    return { isSafe: true };
  }

  const cleanText = text.trim();

  // 1. Check for malicious links and URLs
  if (
    URL_REGEX.test(cleanText) ||
    IP_REGEX.test(cleanText) ||
    MARKDOWN_LINK_REGEX.test(cleanText) ||
    HTML_SCRIPT_REGEX.test(cleanText) ||
    DOMAIN_SHORTHAND_REGEX.test(cleanText)
  ) {
    const match = cleanText.match(URL_REGEX)?.[0] || cleanText.match(DOMAIN_SHORTHAND_REGEX)?.[0] || 'enlace';
    return {
      isSafe: false,
      violationType: 'malicious_link',
      matchedTerm: match,
      warningMessage: 'No se permite incluir enlaces web, URLs o dominios externos en los prompts.'
    };
  }

  // 2. Check for Prompt Wipe / Erasure attempts
  for (const pattern of ERASE_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isSafe: false,
        violationType: 'erase_prompt',
        warningMessage: 'No se puede vaciar o borrar el prompt completo. Solo puedes modificar detalles específicos.'
      };
    }
  }

  // 3. Check for Prompt Injection / Jailbreaks
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isSafe: false,
        violationType: 'prompt_injection',
        warningMessage: 'Instrucción no admitida. Solo se pueden realizar cambios visuales a la imagen.'
      };
    }
  }

  // 4. Check for Profanity, Vulgarities and Obscene words
  const normalizedWords = cleanText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics for matching
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/);

  for (const term of PROFANITY_TERMS) {
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (term.includes(' ')) {
      // multi-word phrase
      if (cleanText.toLowerCase().includes(term) || cleanText.toLowerCase().includes(normalizedTerm)) {
        return {
          isSafe: false,
          violationType: 'inappropriate_content',
          matchedTerm: term,
          warningMessage: 'El mensaje contiene palabras ofensivas o no permitidas.'
        };
      }
    } else {
      if (normalizedWords.includes(normalizedTerm)) {
        return {
          isSafe: false,
          violationType: 'inappropriate_content',
          matchedTerm: term,
          warningMessage: 'El mensaje contiene palabras ofensivas o no permitidas.'
        };
      }
    }
  }

  return { isSafe: true };
}
