import mongoose from 'mongoose';
const { Schema } = mongoose;

const promptSchema = new mongoose.Schema(
    {

        language_code: {
            type: String,
            enum: ['ar', 'en', 'hi', 'ur', 'fa', 'ru'],
            default: 'en'
        },
        llm_provider: {
            type: String,
            enum: ['claude', 'gemini', 'openai'],
            default: 'openai'
        },

        llm: {
            type: String,
            enum: [
                'gpt-4o',
                'gpt-4o-mini',
                'gemini-1.5-pro',
                'claude-3-opus-20240229',
                'claude-3-sonnet-20240229',
                'gemini-exp-1121',
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b'
            ],
            default: 'gpt-4o'
        },
        // Ayla Agent Data
        prompt: {
            ar: { type: String },
            en: { type: String },
            hi: { type: String },
            ur: { type: String },
            fa: { type: String },
            ru: { type: String }
        },
        diana_prompt: {
            ar: { type: String },
            en: { type: String },
            hi: { type: String },
            ur: { type: String },
            fa: { type: String },
            ru: { type: String }
        },
    },
    { timestamps: true }
);

const Prompt = mongoose.model('Prompt', promptSchema);
export default Prompt;