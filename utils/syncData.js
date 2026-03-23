import cron from 'node-cron';
import { refreshAccessToken, fetchAllFromZoho } from './zohoUtils.js';
import Lead from '../models/Lead.js';
import Contact from '../models/Contact.js';
import Task from '../models/Task.js';
import 'dotenv/config';

// Sync data every hour
cron.schedule('0 * * * *', async () => {
  try {
    const accessToken = await refreshAccessToken(process.env.ZOHO_REFRESH_TOKEN);

    // Sync Leads
    const zohoLeads = await fetchAllFromZoho('Leads', accessToken);
    await Lead.deleteMany({}); // Clear existing leads
    for (const zohoLead of zohoLeads.data) {
      const lead = new Lead({
        leadId: zohoLead.id,
        firstName: zohoLead.First_Name,
        lastName: zohoLead.Last_Name,
        email: zohoLead.Email,
        company: zohoLead.Company,
        phone: zohoLead.Phone,
      });
      await lead.save();
    }

    // Sync Contacts and Tasks (similar to Leads)
  } catch (error) {
    console.error('Error syncing data:', error);
  }
});