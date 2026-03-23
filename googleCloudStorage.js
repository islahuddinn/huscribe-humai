// FILE: googleCloudStorage.js
import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = new Storage({
    projectId: '114310674131080102506',
    keyFilename: path.join(__dirname, 'hupply-446408-8ddad1183bb6.json'), // Path to your service account key file
});

const bucketName = 'hupply';

const bucket = storage.bucket(bucketName);

export { bucket };