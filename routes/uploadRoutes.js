import express from 'express';
import multer from 'multer';
import { bucket } from '../googleCloudStorage.js';
import path from 'path';
import { format } from 'util';

const router = express.Router();

// Configure multer storage
const storage = multer.memoryStorage();
const uploader = multer({ storage: storage });

// Express middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Upload image route
router.post('/uploadImage', uploader.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error("No file chosen");
        }

        const blob = bucket.file(`images/${Date.now()}_${path.basename(req.file.originalname)}`);
        const blobStream = blob.createWriteStream({
            resumable: false,
        });

        blobStream.on('error', (err) => {
            res.status(500).json({ message: 'Upload failed', status: "error", error: err });
        });

        blobStream.on('finish', () => {
            const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
            res.status(200).json({ message: 'File uploaded successfully', status: "ok", url: publicUrl });
        });

        blobStream.end(req.file.buffer);
    } catch (error) {
        res.status(500).json({ message: 'Upload failed', status: "error", error });
    }
});

// Upload file route
router.post('/uploadFile', uploader.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error("No file chosen");
        }

        const blob = bucket.file(`files/${Date.now()}_${path.basename(req.file.originalname)}`);
        const blobStream = blob.createWriteStream({
            resumable: false,
        });

        blobStream.on('error', (err) => {
            res.status(500).json({ message: 'Upload failed', status: "error", error: err });
        });

        blobStream.on('finish', () => {
            const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
            res.status(200).json({ message: 'File uploaded successfully', status: "ok", url: publicUrl });
        });

        blobStream.end(req.file.buffer);
    } catch (error) {
        res.status(500).json({ message: 'Upload failed', status: "error", error });
    }
});

export default router;