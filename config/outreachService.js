const axios = require('axios');
const config = require('../config');

class OutreachService {
    constructor() {
        this.baseURL = 'https://api.outreach.io/api/v2';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${config.outreach.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async getProspects() {
        const response = await this.client.get('/prospects');
        return response.data;
    }

    async getProspect(id) {
        const response = await this.client.get(`/prospects/${id}`);
        return response.data;
    }

    async createProspect(prospectData) {
        const response = await this.client.post('/prospects', {
            data: {
                type: 'prospect',
                attributes: prospectData
            }
        });
        return response.data;
    }

    async updateProspect(id, prospectData) {
        const response = await this.client.patch(`/prospects/${id}`, {
            data: {
                type: 'prospect',
                id: id,
                attributes: prospectData
            }
        });
        return response.data;
    }

    async deleteProspect(id) {
        await this.client.delete(`/prospects/${id}`);
    }

    async getSequences() {
        const response = await this.client.get('/sequences');
        return response.data;
    }

    async addProspectToSequence(sequenceId, prospectId) {
        const response = await this.client.post(`/sequences/${sequenceId}/prospects`, {
            data: {
                type: 'sequenceMembership',
                relationships: {
                    prospect: {
                        data: {
                            type: 'prospect',
                            id: prospectId
                        }
                    }
                }
            }
        });
        return response.data;
    }
}

module.exports = new OutreachService(); 