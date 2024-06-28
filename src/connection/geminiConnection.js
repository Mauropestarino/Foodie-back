import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/config.js";

export function createModel() {
    const genAI = new GoogleGenerativeAI(config.generativeAIKey);

    const generationConfig = {
        temperature: 0.6,
        topK: 150,
      };

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig });
    return model
}

export default createModel;