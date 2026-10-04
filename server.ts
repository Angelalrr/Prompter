import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as cheerio from "cheerio";

import { checkTextSecurity } from "./src/utils/security";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};

async function extractImageFromUrl(rawUrl: string): Promise<{ data: string; mimeType: string; previewUrl: string; foundUrl?: string }> {
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  // 1. Fetch the target URL directly with browser headers
  const initialRes = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
  });

  if (!initialRes.ok) {
    throw new Error(`No se pudo acceder al enlace proporcionado (código ${initialRes.status}).`);
  }

  const finalUrl = initialRes.url || url;
  const contentType = (initialRes.headers.get("content-type") || "").toLowerCase();

  // If the provided link is directly an image
  if (contentType.startsWith("image/")) {
    const buffer = Buffer.from(await initialRes.arrayBuffer());
    if (buffer.length > 100) {
      const cleanMime = contentType.split(";")[0];
      const base64 = buffer.toString("base64");
      return {
        data: base64,
        mimeType: cleanMime,
        previewUrl: `data:${cleanMime};base64,${base64}`,
        foundUrl: finalUrl,
      };
    }
  }

  // 2. Otherwise, parse HTML with cheerio (equivalent to BeautifulSoup)
  const html = await initialRes.text();
  const $ = cheerio.load(html);

  const rawCandidates: string[] = [];

  // A. og:image and twitter:image meta tags
  $("meta").each((_, el) => {
    const property = ($(el).attr("property") || "").toLowerCase();
    const name = ($(el).attr("name") || "").toLowerCase();
    const content = $(el).attr("content");

    if (!content) return;

    if (
      property === "og:image" ||
      property === "og:image:url" ||
      property === "og:image:secure_url" ||
      name === "og:image" ||
      name === "twitter:image" ||
      name === "twitter:image:src" ||
      name === "image"
    ) {
      rawCandidates.push(content);
    }
  });

  // B. link rel=image_src
  $('link[rel="image_src"], link[rel="preload"][as="image"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) rawCandidates.push(href);
  });

  // C. img elements in the DOM (src, data-src, data-original, data-lazy-src, srcset)
  $("img").each((_, el) => {
    const attrs = ["src", "data-src", "data-original", "data-lazy-src", "data-zoom-image", "data-high-res-src", "data-full-url"];
    for (const attr of attrs) {
      const val = $(el).attr(attr);
      if (val && !val.startsWith("data:image/svg")) {
        rawCandidates.push(val);
      }
    }
    const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
    if (srcset) {
      const parts = srcset.split(",").map((s) => s.trim().split(" ")[0]);
      if (parts.length > 0) {
        rawCandidates.push(parts[parts.length - 1]);
      }
    }
  });

  // D. JSON-LD Schema.org structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text() || "{}");
      const findImages = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (typeof obj.image === "string") rawCandidates.push(obj.image);
        else if (Array.isArray(obj.image)) {
          obj.image.forEach((img: any) => {
            if (typeof img === "string") rawCandidates.push(img);
            else if (img && typeof img.url === "string") rawCandidates.push(img.url);
          });
        } else if (obj.image && typeof obj.image.url === "string") {
          rawCandidates.push(obj.image.url);
        }
        if (typeof obj.contentUrl === "string") rawCandidates.push(obj.contentUrl);
        if (typeof obj.thumbnailUrl === "string") rawCandidates.push(obj.thumbnailUrl);
        Object.values(obj).forEach((val) => {
          if (typeof val === "object") findImages(val);
        });
      };
      findImages(json);
    } catch {}
  });

  // Clean, resolve relative URLs with urljoin / new URL, and prioritize high-res versions
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (c: string) => {
    if (!c || typeof c !== "string" || c.trim().startsWith("data:")) return;
    try {
      const resolved = new URL(c.trim(), finalUrl).href;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        candidates.push(resolved);
      }
    } catch {}
  };

  for (const raw of rawCandidates) {
    // If it's a Pinterest image URL with reduced resolution, also try highest resolution variants first
    if (raw.includes("pinimg.com")) {
      const originalVar = raw.replace(/\/(?:236x|474x|564x|736x)\//, "/originals/");
      const res736Var = raw.replace(/\/(?:236x|474x|564x)\//, "/736x/");
      addCandidate(originalVar);
      addCandidate(res736Var);
    }
    addCandidate(raw);
  }

  // 3. Test candidates to find the first valid image
  for (const candidate of candidates.slice(0, 25)) {
    try {
      const imgRes = await fetch(candidate, {
        headers: {
          ...BROWSER_HEADERS,
          Referer: finalUrl,
        },
        redirect: "follow",
      });

      if (!imgRes.ok) continue;

      const imgType = (imgRes.headers.get("content-type") || "").toLowerCase();
      if (!imgType.startsWith("image/") || imgType.includes("svg")) continue;

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      if (buffer.length < 500) continue;

      const cleanMime = imgType.split(";")[0];
      const base64 = buffer.toString("base64");

      return {
        data: base64,
        mimeType: cleanMime,
        previewUrl: `data:${cleanMime};base64,${base64}`,
        foundUrl: candidate,
      };
    } catch (e) {
      // Continue testing next candidate
    }
  }

  throw new Error("No se encontró ninguna imagen válida en esta página. Prueba con el enlace directo de la imagen o sube el archivo.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API route for generating the prompt
  app.post("/api/generate-prompt", async (req, res) => {
    try {
      const { referenceImage, customInstructions, existingCategories } = req.body;

      if (!referenceImage) {
        return res.status(400).json({ error: "Reference image is required." });
      }

      const categoriesList = existingCategories && Array.isArray(existingCategories) && existingCategories.length > 0 
        ? existingCategories.join(', ') 
        : 'None yet';

      const refPart = {
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.data, // base64 without prefix
        },
      };

      let response;
      let retries = 3;
      let delay = 1000; // start with 1 second delay

      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite", // Using lite version for best availability
            contents: {
              parts: [
                refPart,
                { text: "This is a reference photo for the desired style, pose, clothing, and scene." },
                {
                  text: `Analyze the style, scene, background, environment, lighting, pose, clothing, camera style/quality, color palette, and overall vibe of the reference photo. 
CRITICAL: DO NOT describe the physical characteristics, facial features, ethnicity, hair, or body type of the person in the photo. Leave the subject's physical description completely blank or use generic placeholders (e.g., 'a person').

CRITICAL RULES FOR THE GENERATED PROMPT:
1. You MUST ALWAYS include phrasing that forces maximum casual realism, such as: "shot on iPhone, casual snap, candid spontaneous photo, amateur photography, natural lighting, highly detailed, raw unedited photograph, not AI generated".
2. The overall tone should strongly simulate a spontaneous, real-world, casual photo (like something quickly snapped for Instagram or a camera roll) rather than a professional photoshoot, synthetic, or 3D render.
3. Be EXTREMELY granular, rich, and detailed. Mention specific fabrics, lighting direction, focal length, film grain, background elements, and color grading.
4. IMPORTANT: Do NOT include raw numbers or bracketed coordinate syntax (e.g., do NOT write "[ymin: 100, xmin: 200]" or coordinates) inside the natural descriptions or inside 'final_combined_prompt'. Use natural spatial phrases instead (e.g., "in the foreground center", "leaning against the background wall to the left"). Coordinates belong exclusively in the 'detected_objects' JSON array.

EXISTING CATEGORIES TO REUSE (IF APPLICABLE): [${categoriesList}].
CRITICAL: You MUST output a "category" field. If the image fits perfectly into one of the EXISTING CATEGORIES, you MUST reuse the exact category name. If not, create a new VERY SHORT, descriptive category (1 to 2 words MAX, keep it extremely brief, e.g., 'Cyberpunk', 'Retrato', 'Paisaje', 'Streetwear').

${customInstructions ? `USER'S EXTRA INSTRUCTIONS / CHANGES TO APPLY: "${customInstructions}"\n(You MUST seamlessly integrate these specific changes into your final descriptions).` : ''}

Break down the description into specific, highly detailed categories. Use rich, universally recognized prompting keywords, optical terminology (e.g., 85mm lens, f/1.8), lighting tags (e.g., cinematic lighting, volumetric), and highly descriptive adjectives.

CRITICAL (RAW PROMPT COORDINATES): In 'detected_objects', identify up to 10 key visual elements, objects, clothing items, or background elements. For each, provide its clean 'label' and its exact 2D bounding box 'box_2d' as [ymin, xmin, ymax, xmax] integers from 0 to 1000 representing relative coordinates.

CRITICAL FORMATTING FOR final_combined_prompt:
You MUST structure 'final_combined_prompt' across MULTIPLE DISTINCT PARAGRAPHS separated by double newlines (\\n\\n). Do NOT clump everything into one continuous single line. Format it with clean visual rhythm:
- Paragraph 1: Core scene, mood, candid realism keywords ("shot on iPhone, raw unedited photograph"), and spatial framing.
- Paragraph 2: Subject posture, pose, and natural positioning in the frame.
- Paragraph 3: Granular clothing items, fabrics, textures, and details.
- Paragraph 4: Detailed environment, architecture, props, and background elements.
- Paragraph 5: Lighting direction, shadows, highlights, color temperature, and atmospheric vibe.
- Paragraph 6: Camera technical specifications (lens focal length, aperture, shutter feel, depth of field, natural sensor noise).

IMPORTANT: All fields in the JSON response (except 'spanish_description') MUST be written strictly in ENGLISH.
Provide the response as a valid JSON object containing the broken-down prompt sections.`,
                },
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  detected_objects: {
                    type: Type.ARRAY,
                    description: "List of key objects (clothing, props, background elements) detected in the image with their bounding boxes and exact spatial positions.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING, description: "Detailed name of the object (e.g., 'black leather jacket', 'vintage aviator sunglasses')" },
                        box_2d: {
                          type: Type.ARRAY,
                          items: { type: Type.INTEGER },
                          description: "Bounding box coordinates [ymin, xmin, ymax, xmax]. Values MUST be integers from 0 to 1000."
                        },
                        position_description: {
                          type: Type.STRING,
                          description: "Spatial position in the frame (e.g., 'Center foreground [Y: 35-78%, X: 22-65%]')"
                        }
                      },
                      required: ["label", "box_2d"]
                    }
                  },
                  spanish_description: {
                    type: Type.STRING,
                    description: "A natural language description of the image, written entirely in Spanish. Max 2-3 sentences.",
                  },
                  category: {
                    type: Type.STRING,
                    description: "A short 1-3 word category name for this image style/type. Reuse from existing categories if provided and matching.",
                  },
                  subject_positioning_and_framing: {
                    type: Type.STRING,
                    description: "Details on camera angle, framing (e.g., medium shot, full body, high angle), and how the subject is positioned in the frame with coordinates.",
                  },
                  pose_and_action: {
                    type: Type.STRING,
                    description: "Extremely detailed description of the subject's pose, gesture, posture, and action.",
                  },
                  clothing_and_textures: {
                    type: Type.STRING,
                    description: "Extremely detailed description of the clothes, fabrics, wrinkles, fit, fashion style, accessories, and their exact spatial positions.",
                  },
                  environment_and_background: {
                    type: Type.STRING,
                    description: "Extremely detailed description of the scene, background, location, props, and surrounding elements with spatial coordinates.",
                  },
                  time_of_day_and_weather: {
                    type: Type.STRING,
                    description: "The time of day, weather conditions, or atmospheric effects (e.g., raining, golden hour, overcast, neon night).",
                  },
                  lighting_and_shadows: {
                    type: Type.STRING,
                    description: "Detailed description of the lighting direction, quality (hard/soft), rim light, shadows, and contrast.",
                  },
                  color_palette_and_grading: {
                    type: Type.STRING,
                    description: "The dominant colors, color grading, saturation levels, and visual aesthetics (e.g., vintage wash, muted tones).",
                  },
                  camera_lens_and_tech_specs: {
                    type: Type.STRING,
                    description: "Description of the photography style, camera angle, film type, focal length, depth of field (bokeh), or simulated device (e.g., shot on iPhone, polaroid, 35mm lens, f/1.8).",
                  },
                  emotional_tone_and_vibe: {
                    type: Type.STRING,
                    description: "The mood, emotion, and overall vibe of the image.",
                  },
                  final_combined_prompt: {
                    type: Type.STRING,
                    description: "A richly detailed, cohesive multi-paragraph prompt with clean paragraph breaks (\\n\\n) combining ALL details, ready to be copy-pasted directly into Midjourney, Flux, or Stable Diffusion.",
                  },
                  negative_prompt: {
                    type: Type.STRING,
                    description: "Negative prompt to avoid artifacts or unwanted elements based on the style.",
                  }
                },
                required: [
                  "detected_objects",
                  "spanish_description",
                  "category",
                  "subject_positioning_and_framing", 
                  "pose_and_action", 
                  "clothing_and_textures", 
                  "environment_and_background", 
                  "time_of_day_and_weather", 
                  "lighting_and_shadows", 
                  "color_palette_and_grading", 
                  "camera_lens_and_tech_specs", 
                  "emotional_tone_and_vibe",
                  "final_combined_prompt",
                  "negative_prompt"
                ]
              },
            },
          });
          break; // success, exit the retry loop
        } catch (error: any) {
          retries--;
          console.log(`API Error. Retries left: ${retries}. Error:`, error.message);
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        }
      }

      let jsonStr = response.text?.trim() || "{}";
      // Sanitize potential markdown block around JSON
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const result = JSON.parse(jsonStr);

      res.json(result);
    } catch (error: any) {
      console.error("Error generating prompt:", error);
      res.status(500).json({ error: error.message || "Failed to generate prompt." });
    }
  });

  // Universal API route for fetching images from any webpage or direct image link
  const handleUrlFetch = async (req: express.Request, res: express.Response) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ error: "Por favor, ingresa una URL válida." });
      }

      const result = await extractImageFromUrl(url.trim());
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching image from URL:", error);
      res.status(500).json({ 
        error: error.message || "No se pudo extraer una imagen desde el enlace proporcionado. Intenta con el enlace directo de la imagen o sube el archivo." 
      });
    }
  };

  app.post("/api/fetch-url", handleUrlFetch);
  app.post("/api/fetch-pinterest", handleUrlFetch);

  // API route for translating text into the selected language
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLang } = req.body;
      if (!text || !targetLang) {
        return res.status(400).json({ error: "Text and targetLang are required." });
      }

      if (targetLang === "es") {
        return res.json({ translatedText: text });
      }

      const languageNames: Record<string, string> = {
        en: "English",
        fr: "French",
        de: "German",
        it: "Italian",
        pt: "Portuguese",
      };

      const langName = languageNames[targetLang] || "English";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Translate the following image description or category accurately, naturally, and concisely into ${langName}. Preserve the tone and meaning. Output ONLY the translated text without quotes or explanations.\n\nText: "${text}"`,
      });

      const translated = response.text ? response.text.trim() : text;
      res.json({ translatedText: translated });
    } catch (error: any) {
      console.error("Translation API error:", error);
      res.json({ translatedText: req.body.text || "" });
    }
  });

  // API route for secure prompt modification chatbot
  app.post("/api/modify-prompt", async (req, res) => {
    try {
      const { currentPrompt, userMessage, currentJson } = req.body;

      if (!currentPrompt || typeof currentPrompt !== "string") {
        return res.status(400).json({ error: "Current prompt is required." });
      }

      if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
        return res.status(400).json({ error: "User message is required." });
      }

      // Step 1: Client/User message pre-validation security check
      const inputSecurity = checkTextSecurity(userMessage);
      if (!inputSecurity.isSafe) {
        return res.json({
          is_allowed: false,
          violation_type: inputSecurity.violationType,
          warning_message: inputSecurity.warningMessage,
          assistant_reply: `No es posible aplicar esta solicitud: ${inputSecurity.warningMessage}`,
          original_phrase_or_element: null,
          new_phrase_or_element: null,
          updated_combined_prompt: currentPrompt,
        });
      }

      // Step 2: Use Gemini to safely evaluate request, check for off-topic/abuse, and alter ONLY the requested part
      let response;
      let retries = 3;
      let delay = 1000;

      const systemInstruction = `You are a helpful and intelligent AI Photo Prompt Assistant.
Your job is to seamlessly adjust specific visual elements of the image prompt as requested by the user (e.g. clothing, colors, background, weather, lighting, accessories, camera angle).

SECURITY & USAGE RULES:
1. NO LINKS OR URLS: If the user tries to add any website, link, url, or domain, set is_allowed to false, violation_type to "malicious_link", and warning_message to "No se permite incluir enlaces web o URLs en el prompt."
2. NO PROFANITY OR HATE SPEECH: If the user inputs vulgarities, offensive, or discriminatory content, set is_allowed to false, violation_type to "inappropriate_content", and warning_message to "No se permite el uso de lenguaje obsceno u ofensivo."
3. ON-TOPIC ONLY: If the user talks about unrelated topics (general chit-chat, school questions, code, politics, etc.), set is_allowed to false, violation_type to "off_topic", and warning_message to "Solo puedo ayudarte a ajustar elementos visuales de la imagen (ropa, fondo, iluminación, etc.)."
4. NO PROMPT DELETION: If the user tries to clear or empty the prompt, set is_allowed to false, violation_type to "erase_prompt", and warning_message to "No se puede vaciar el prompt completo."
5. FOCUS ONLY ON THE REQUESTED CHANGE: Modify ONLY the visual element indicated by the user. Keep the photographic style, quality keywords ('shot on iPhone', etc.), and formatting seamlessly intact.
6. IDENTIFY CHANGES: Provide the exact original phrase replaced in 'original_phrase_or_element' and the new phrase in 'new_phrase_or_element'.
7. Response tone: Friendly, natural, professional in Spanish for assistant_reply (e.g., "Listo, he cambiado la chaqueta por una de cuero negro."). The updated prompt remains in English.`;

      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [
              {
                text: `${systemInstruction}\n\nCURRENT PROMPT:\n"""${currentPrompt}"""\n\nUSER REQUEST TO MODIFY:\n"""${userMessage}"""\n\nAnalyze the request carefully. If it violates ANY safety rule, reject it with is_allowed=false. If allowed, apply ONLY the requested change and return the updated prompt and exact phrases changed.`
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  is_allowed: {
                    type: Type.BOOLEAN,
                    description: "Whether the request is strictly permitted and adheres to all safety rules."
                  },
                  violation_type: {
                    type: Type.STRING,
                    description: "Type of violation: 'malicious_link', 'inappropriate_content', 'discriminatory', 'off_topic', 'erase_prompt', or null if allowed."
                  },
                  warning_message: {
                    type: Type.STRING,
                    description: "Explicit warning in Spanish explaining why the request is prohibited, or null if allowed."
                  },
                  assistant_reply: {
                    type: Type.STRING,
                    description: "Message in Spanish explaining the action taken to the user."
                  },
                  original_phrase_or_element: {
                    type: Type.STRING,
                    description: "The specific phrase or element in the original prompt that was replaced or removed."
                  },
                  new_phrase_or_element: {
                    type: Type.STRING,
                    description: "The new phrase or element added in its place."
                  },
                  updated_combined_prompt: {
                    type: Type.STRING,
                    description: "The complete prompt with ONLY the requested change applied. Must keep all other parts intact."
                  }
                },
                required: ["is_allowed", "assistant_reply"]
              }
            }
          });
          break;
        } catch (error: any) {
          retries--;
          console.log(`Modify prompt API Error. Retries left: ${retries}. Error:`, error.message);
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        }
      }

      let jsonStr = response?.text?.trim() || "{}";
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const modResult = JSON.parse(jsonStr);

      // Step 3: Server-side post-validation check on resulting prompt
      if (modResult.is_allowed && modResult.updated_combined_prompt) {
        const outputSecurity = checkTextSecurity(modResult.updated_combined_prompt);
        if (!outputSecurity.isSafe) {
          return res.json({
            is_allowed: false,
            violation_type: outputSecurity.violationType,
            warning_message: outputSecurity.warningMessage,
            assistant_reply: `Modificación rechazada: Se detectó contenido inseguro o no permitido en el resultado. ${outputSecurity.warningMessage}`,
            original_phrase_or_element: null,
            new_phrase_or_element: null,
            updated_combined_prompt: currentPrompt,
          });
        }

        // Sanity check: Ensure prompt wasn't completely emptied or severely degraded
        if (modResult.updated_combined_prompt.length < 50) {
          return res.json({
            is_allowed: false,
            violation_type: "erase_prompt",
            warning_message: "Acción no permitida: El prompt resultante no puede quedar vacío.",
            assistant_reply: "Acción bloqueada: El cambio solicitado dejó el prompt sin contenido.",
            original_phrase_or_element: null,
            new_phrase_or_element: null,
            updated_combined_prompt: currentPrompt,
          });
        }
      }

      res.json(modResult);
    } catch (error: any) {
      console.error("Error in modify-prompt:", error);
      res.status(500).json({
        is_allowed: false,
        warning_message: "Ocurrió un error al procesar la solicitud con el asistente.",
        assistant_reply: "Hubo un problema al procesar el cambio. Por favor, intenta de nuevo.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
