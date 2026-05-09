/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { extractHtmlFromText } from "../utils/html";

export const IMAGE_SYSTEM_PROMPT = "Generate an isolated object/scene on a simple background.";
export const VOXEL_PROMPT = `
You are a master 3D Voxel Artist and Three.js expert. 
Your goal is to recreate the attached image as a modular, procedural 3D Voxel Scene in a single standalone HTML file.

STYLE REQUIREMENTS (Inspired by Voxel Jetpack Cat):
1. MODULAR CONSTRUCTION: Organize the scene into THREE.Group objects (e.g., Body, Head, Accessories, Environment).
2. PROCEDURAL BLOCKS: Use loops to build volumes (for-loops for torso, head, etc.) rather than just a flat pixel map.
3. VIBRANT COLORS: Use a bold color palette derived from the image.
4. ANIMATION: Include a floating (sine wave) animation and subtle rotations or moving parts (like a waving arm or moving tail).
5. ENVIRONMENT: Add a sky background, fog, and simple voxel clouds or water.
6. PERFORMANCE: Use InstancedMesh for multiple voxels of the same color.
7. CONTROLS: Include OrbitControls for user interaction.

OUTPUT: Provide ONLY the full <html> code using "three" and "three/addons/" imports via an importmap.
`;

export const generateVoxelScene = async (
    imageBase64: string, 
    onThoughtUpdate?: (thought: string) => void
): Promise<string> => {
    if (onThoughtUpdate) onThoughtUpdate("Analyzing image and drafting procedural voxel code (Claude 3.5)...");
    
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
            throw new Error(err?.error || "Voxel Generation Failed");
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
