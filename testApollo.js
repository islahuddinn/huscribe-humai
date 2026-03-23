import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_BASE_URL = 'https://api.apollo.io/v1';

async function testApolloKey() {
    try {
        console.log('Testing Apollo API Key...');
        console.log('API Key (first 4 chars):', APOLLO_API_KEY.substring(0, 4) + '...');

        const response = await axios.post(
            `${APOLLO_API_BASE_URL}/people/search`,
            {
                q: 'test',
                page: 1,
                per_page: 1,
                api_key: APOLLO_API_KEY
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('Success! Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('Headers:', error.response?.headers);
    }
}

testApolloKey(); 