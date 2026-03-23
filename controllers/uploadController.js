import asyncHandler from "express-async-handler";
import { v2 as cloudinary } from 'cloudinary';


// Uplaod File
const uploadFile = asyncHandler(async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.buffer, {
            resource_type: 'auto' // This will automatically handle image and pdf
        });
        res.json({ message: 'File uploaded successfully', url: result.secure_url });
    } catch (error) {
        res.status(500).json({ message: 'Upload failed', error });
    }

});


export {
    uploadFile
};

