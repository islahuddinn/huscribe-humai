import express from "express";
import {
    addPrompt,
    updatePrompt,
    getPrompt,

} from "../controllers/promptController.js";
const router = express.Router();

// prompt table routes

router.post("/addPrompt", addPrompt);
router.get("/getPrompt", getPrompt);
router.put("/updatePrompt", updatePrompt);

export default router;
