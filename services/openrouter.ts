export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const openRouterChat = async (prompt: string, model: string = "anthropic/claude-3.5-sonnet") => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not found");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin, // Required by OpenRouter
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error?.message || "OpenRouter Request Failed");
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0].message.content;
};

export const openRouterImage = async (prompt: string) => {
    // Using a reliable image model on OpenRouter
    return openRouterChat(prompt, "openai/gpt-4o-mini"); // OpenRouter usually handles chat, let's see if we can use a specific image endpoint or multimodal model
};
