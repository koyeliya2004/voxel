import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Request logger for troubleshooting
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '10mb' }));

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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", openRouterConfigured: !!process.env.OPENROUTER_API_KEY, groqConfigured: !!process.env.GROQ_API_KEY });
  });

  // API Route: Groq Proxy for Voxel Nexus
  app.post("/api/groq", async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY not configured. Please add it to your project secrets." });
    }
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(req.body)
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!response.ok) {
        const errorData = isJson ? await response.json() : await response.text();
        return res.status(response.status).json({ 
          error: isJson ? (errorData.error?.message || "Groq API Error") : "Groq API returned non-JSON error",
          details: !isJson ? errorData : undefined
        });
      }

      if (isJson) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.status(500).json({ error: "Upstream returned non-JSON response", details: String(text).substring(0, 200) });
      }
    } catch (err: any) {
      console.error("Groq Proxy Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite server integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // API 404 handler - prevents /api/* from falling through to the index.html
    app.all('/api/*all', (req, res) => {
      res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
    });

    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Catch-all for SPA: Using regex is safer across Express versions
    app.get(/^(?!\/api).*$/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> VOXELWORLD ENGINE SERVER STARTING...`);
    console.log(`>>> MODE: ${process.env.NODE_ENV || 'development'}`);
    console.log(`>>> PORT: ${PORT}`);
    console.log(`>>> GROQ CONFIGURED: ${!!process.env.GROQ_API_KEY}`);
  });
}

startServer();
