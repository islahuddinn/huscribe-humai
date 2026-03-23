import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
        });
        console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

export const sendPushNotification = async (tokens, title, body, data = {}) => {
    try {
        if (!tokens || tokens.length === 0) {
            console.log('No tokens provided for push notification');
            return;
        }

        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            }
        };

        const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
        console.log('Attempting to send to tokens:', tokenArray);

        const messages = tokenArray.map(token => ({
            ...message,
            token
        }));

        const responses = await Promise.all(
            messages.map(msg =>
                admin.messaging().send(msg)
                    .then(response => ({ success: true, response }))
                    .catch(error => ({ success: false, error }))
            )
        );

        console.log('Push notification responses:', responses);

        return {
            successCount: responses.filter(r => r.success).length,
            failureCount: responses.filter(r => !r.success).length,
            responses
        };
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
};

export default admin; 