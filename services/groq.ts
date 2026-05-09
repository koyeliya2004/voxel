import { extractHtmlFromText } from "../utils/html";

export const generateGroqVoxel = async (prompt: string): Promise<string> => {
    try {
        const response = await fetch("/api/generate-groq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err?.error?.message || "Groq Generation Failed");
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        
        if (!text) throw new Error("No response from Groq");
        
        return extractHtmlFromText(text);
    } catch (error) {
        console.error("Groq Voxel failed:", error);
        throw error;
    }
};
