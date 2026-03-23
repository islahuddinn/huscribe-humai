import asyncHandler from "express-async-handler";
import Prompt from "../models/promptModel.js";


const addPrompt = asyncHandler(async (req, res) => {
    try {


        const promptData = new Prompt({
            prompt: req.body.prompt,
            llm: req.body.llm,
            diana_prompt: req.body.diana_prompt,
            language_code: req.body.language_code || 'en',
            llm_provider: req.body.llm_provider || 'openai'

        });

        const sData = await promptData.save();
        res.status(200).json({ message: "Prompt Added", status: "ok", data: sData });
    } catch (err) {
        res.status(500).json({ message: `Error: ${err.message}`, status: "error" });
    }
});



const getPrompt = asyncHandler(async (req, res) => {
    try {
        const data = await Prompt.findOne().sort({ _id: 1 });

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json(err);
    }
});

const updatePrompt = asyncHandler(async (req, res) => {
    try {
        const data = await Prompt.findOneAndUpdate(
            { _id: req.body._id },
            req.body
        );
        res.status(200).json({ message: "Record Updated!", status: "ok", data });
    } catch (err) {
        res.status(500).json(err);
    }
});
// delete agent base on id


export {
    addPrompt,
    updatePrompt,
    getPrompt,
};

