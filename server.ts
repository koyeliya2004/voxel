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
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KE;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured in settings. Please check your project secrets." });
    }

    const { imageBase64, prompt } = req.body;
    const mimeMatch = imageBase64?.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64?.split(',')[1] || imageBase64;

    const models = [
      "anthropic/claude-3.5-sonnet",
      "google/gemini-flash-1.5",
      "google/gemini-pro-1.5",
      "openai/gpt-4o",
      "anthropic/claude-3.5-sonnet:beta"
    ];

    let lastError = null;
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
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
                { 
                  type: "image_url", 
                  image_url: { url: `data:${mimeType};base64,${base64Data}` } 
                }
              ]
            }]
          })
        });

        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        
        if (!response.ok) {
          const errorBody = isJson ? await response.json() : await response.text();
          const errorMsg = isJson ? (errorBody?.error?.message || JSON.stringify(errorBody)) : errorBody;
          console.warn(`Model ${model} failed: ${errorMsg}`);
          lastError = errorMsg;
          
          // Only retry on availability/not-found/routing errors
          if (errorMsg.includes("endpoints") || 
              errorMsg.includes("not found") || 
              response.status === 404 || 
              errorMsg.includes("invalid model") ||
              errorMsg.includes("routing") ||
              response.status === 503) {
            continue;
          }
          // For other errors (like auth or bad request), stop and report
          return res.status(response.status).json({ error: errorMsg, model });
        }

        if (isJson) {
          const data = await response.json();
          return res.json(data);
        } else {
          const text = await response.text();
          return res.status(500).json({ error: "Upstream returned non-JSON response", details: String(text).substring(0, 200) });
        }
      } catch (err: any) {
        console.error(`Error with model ${model}:`, err.message);
        lastError = err.message;
      }
    }

    res.status(500).json({ error: "All models failed. Last error: " + lastError });
  });

  // API Route: OpenRouter Proxy for Image Generation (Flux)
  app.post("/api/generate-image", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KE;
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

  // API Route: Segmind Workflow Proxy (Asynchronous with Polling)
  app.post("/api/generate-voxel-segmind", async (req, res) => {
    const apiKey = process.env.SEGMIND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "SEGMIND_API_KEY not configured in settings. Go to Settings -> Secrets and add your key." });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    try {
      const workflowUrl = "https://api.segmind.com/workflows/6839bca2659263e69c7a5674-v4";
      const initialResponse = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "Input_Image": imageBase64 
        })
      });

      if (!initialResponse.ok) {
        const errText = await initialResponse.text();
        let errorData = errText;
        try { errorData = JSON.parse(errText); } catch(e) {}
        
        const errorMsg = typeof errorData === 'object' ? (errorData as any)?.error || JSON.stringify(errorData) : errText;
        
        return res.status(initialResponse.status).json({ 
            error: "Segmind Request Failed", 
            details: errorMsg 
        });
      }

      const queueResult = await initialResponse.json();
      const pollUrl = queueResult.poll_url;

      if (!pollUrl) {
         return res.status(500).json({ error: "No poll_url returned from Segmind" });
      }

      // 2. Poll for results (max 10 attempts / ~70 seconds)
      let attempts = 0;
      const maxAttempts = 12; // ~84 seconds

      while (attempts < maxAttempts) {
        console.log(`Polling Segmind (${attempts + 1}/${maxAttempts})...`);
        const pollResponse = await fetch(pollUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!pollResponse.ok) {
           throw new Error(`Polling failed: ${pollResponse.status}`);
        }

        const result = await pollResponse.json();

        if (result.status === 'COMPLETED') {
          // Output is often a JSON string according to the snippet
          let output = result.output;
          try {
            if (typeof output === 'string') {
              output = JSON.parse(output);
            }
          } catch (e) {
            console.warn("Could not parse Segmind output as JSON, returning as is.");
          }
          return res.json({ status: 'COMPLETED', output });
        } else if (result.status === 'FAILED') {
          return res.status(500).json({ error: "Segmind Generation Failed", details: result.error || "Unknown error" });
        }

        // Wait 7 seconds before next poll as per instructions
        await new Promise(resolve => setTimeout(resolve, 7000));
        attempts++;
      }

      res.status(500).json({ error: "Segmind polling timed out" });

    } catch (err: any) {
      console.error("Segmind Server Error:", err);
      res.status(500).json({ error: err.message });
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
