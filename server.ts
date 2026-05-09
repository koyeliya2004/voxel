import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route: OpenRouter Proxy for Voxel Generation (Claude 3.5 Sonnet)
  app.post("/api/generate-voxel", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured in settings." });
    }

    const { imageBase64, prompt } = req.body;
    const mimeMatch = imageBase64?.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64?.split(',')[1] || imageBase64;

    const models = ["anthropic/claude-3.5-sonnet", "anthropic/claude-3.5-sonnet:beta", "google/gemini-flash-1.5"];

    for (const model of models) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai.studio/build",
            "X-Title": "Image to Voxel Art"
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
              ]
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          return res.json(data);
        }
      } catch (err) {
        console.error(`Error with model ${model}:`, err);
      }
    }
    res.status(500).json({ error: "Voxel generation failed on all models." });
  });

  // API Route: OpenRouter Proxy for Image Generation (Flux)
  app.post("/api/generate-image", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured in settings. Please check your project secrets." });
    }

    const { prompt, size } = req.body;
    const models = [
      "black-forest-labs/flux-schnell",
      "black-forest-labs/flux-dev",
      "openai/dall-e-3",
      "stabilityai/sdxl"
    ];

    let lastError = null;
    for (const model of models) {
      try {
        console.log(`Trying image model: ${model}`);
        const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai.studio/build",
            "X-Title": "Image to Voxel Art"
          },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            size: size || "1024x1024"
          })
        });

        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");

        if (!response.ok) {
          const errorBody = isJson ? await response.json() : await response.text();
          const errorMsg = isJson ? (errorBody?.error?.message || JSON.stringify(errorBody)) : errorBody;
          console.warn(`Image model ${model} failed: ${errorMsg}`);
          lastError = errorMsg;
          
          if (errorMsg.includes("endpoints") || errorMsg.includes("not found") || response.status === 404) {
            continue;
          }
          return res.status(response.status).json({ error: errorMsg });
        }

        if (isJson) {
          const data = await response.json();
          return res.json(data);
        } else {
          const text = await response.text();
          return res.status(500).json({ error: "Upstream returned non-JSON response", details: String(text).substring(0, 200) });
        }
      } catch (err: any) {
        console.error(`Error with image model ${model}:`, err.message);
        lastError = err.message;
      }
    }

    res.status(500).json({ error: "All image models failed", lastError });
  });

  // API Route: Groq Proxy for Quick Voxel Generation (Llama 3)
  app.post("/api/generate-groq", async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY not configured in settings." });
    }

    const { prompt } = req.body;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "system",
            content: `You are a master 3D Voxel Artist and Three.js expert. Your goal is to recreate the user's request as a modular, procedural 3D Voxel Scene in a single standalone HTML file. 

STYLE REQUIREMENTS:
1. DESIGN: Use a "VoxelVerse 3D" aesthetic - glass UI overlays, vibrant pink/purple gradients, and high-quality voxel characters or objects on floating islands.
2. MODULAR CONSTRUCTION: Organize the scene into THREE.Group objects.
3. PERFORMANCE: Use InstancedMesh for multiple voxels of the same color.
4. UI: Include a beautiful Tailwind CSS overlay with a glass effect, stats, and controls info.
5. TECH: Use Three.js (r160+), OrbitControls, and InstancedMesh.
6. OUTPUT: Provide ONLY the full standalone <html> code including all scripts and styles. Do not include markdown code blocks.`
          }, {
            role: "user",
            content: `Create a 3D Voxel scene of: ${prompt}. Build it with the aesthetic of a high-end 3D previewer.`
          }],
          temperature: 0.7,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Groq generation failed:", err);
      res.status(500).json({ error: "Groq generation failed", details: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", openRouterConfigured: !!process.env.OPENROUTER_API_KEY });
  });

  // Vite server integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
