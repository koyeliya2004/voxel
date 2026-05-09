/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { extractHtmlFromText } from "../utils/html";

export const IMAGE_SYSTEM_PROMPT = "Generate an isolated object/scene on a simple background.";
export const VOXEL_PROMPT = "I have provided an image. Code a beautiful voxel art scene inspired by this image. Write threejs code as a single-page with a dark background. Make it look like a floating island to ensure transparency doesn't show background artifacts.";

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
            const err = await response.json();
            throw new Error(err?.error?.message || "Image Generation Failed via Server Proxy");
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

export const generateVoxelScene = async (
    imageBase64: string, 
    onThoughtUpdate?: (thought: string) => void
): Promise<string> => {
    if (onThoughtUpdate) onThoughtUpdate("Requesting analysis from secure backend (Claude 3.5 Sonnet)...");
    
    try {
        const response = await fetch("/api/generate-voxel", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imageBase64,
                prompt: VOXEL_PROMPT
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err?.error?.message || "Voxel Generation Failed via Server Proxy");
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        
        if (!text) throw new Error("No response from AI model");
        
        return extractHtmlFromText(text);
    } catch (error) {
        console.error("Voxel failed:", error);
        throw error;
    }
};

export const generateVoxelSegmind = async (imageBase64: string): Promise<any> => {
    try {
        const response = await fetch("/api/generate-voxel-segmind", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64 })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err?.details || err?.error || "Segmind Workflow Failed");
        }

        return await response.json();
    } catch (error) {
        console.error("Segmind workflow failed:", error);
        throw error;
    }
};
