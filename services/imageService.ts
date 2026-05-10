/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { extractHtmlFromText } from "../utils/html";

export const IMAGE_SYSTEM_PROMPT = "Generate an isolated object/scene on a simple background.";
export const generateImage = async (prompt: string, aspectRatio: string = '1:1', optimize: boolean = true): Promise<string> => {
    const finalPrompt = optimize ? `${IMAGE_SYSTEM_PROMPT}\n\nSubject: ${prompt}` : prompt;

    // Try Puter.js first (Free, No Key required on client)
    if (typeof (window as any).puter !== 'undefined') {
        try {
            console.log("Generating image with Puter.js...");
            const imageElement = await (window as any).puter.ai.txt2img(finalPrompt, { 
                model: "black-forest-labs/flux-schnell" 
            });
            if (imageElement && imageElement.src) {
                return imageElement.src;
            }
        } catch (puterError) {
            console.warn("Puter.js image generation failed:", puterError);
        }
    }

    try {
        const response = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: finalPrompt,
                size: aspectRatio === '1:1' ? "1024x1024" : "1024x768"
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err.error || err.message || "Image Generation Failed via Server Proxy";
            throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }

        const data = await response.json();
        const url = data.data?.[0]?.url || data.choices?.[0]?.url;
        
        if (!url) throw new Error("No image URL returned from proxy");
        return url;
    } catch (error) {
        console.error("Image generation failed:", error);
        throw error;
    }
};
