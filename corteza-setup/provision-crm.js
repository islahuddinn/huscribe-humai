import axios from 'axios';
import { crmBaselineManifest } from '../manifests/crm-baseline.js';

const CORTEZA_API = 'http://localhost:18080/api';

async function provisionCRM() {
  try {
    // Step 1: Create admin user
    console.log('Creating admin user...');
    await axios.post(`${CORTEZA_API}/system/users/`, {
      email: 'admin@corteza.local',
      name: 'Admin User',
      handle: 'admin',
      password: 'admin123',
      emailConfirmed: true
    });

    // Step 2: Login as admin
    console.log('Logging in...');
    const loginResponse = await axios.post(`${CORTEZA_API}/system/auth/login`, {
      email: 'admin@corteza.local',
      password: 'admin123'
    });

    const token = loginResponse.data.response.jwt;
    const headers = { Authorization: `Bearer ${token}` };

    // Step 3: Create CRM namespace
    console.log('Creating CRM namespace...');
    const namespaceResponse = await axios.post(
      `${CORTEZA_API}/compose/namespace/`,
      {
        name: 'Huscribe CRM',
        slug: 'huscribe-crm',
        enabled: true,
        meta: {
          description: 'Complete CRM solution powered by Corteza'
        }
      },
      { headers }
    );

    const namespaceID = namespaceResponse.data.response.namespaceID;
    console.log('Namespace created:', namespaceID);

    // Step 4: Create modules
    console.log('Creating modules...');
    for (const moduleConfig of crmBaselineManifest.modules) {
      console.log(`Creating module: ${moduleConfig.name}`);
      await axios.post(
        `${CORTEZA_API}/compose/namespace/${namespaceID}/module/`,
        {
          name: moduleConfig.name,
          handle: moduleConfig.handle,
          fields: moduleConfig.fields.map(field => ({
            name: field.name,
            kind: field.kind,
            label: field.name,
            isRequired: field.required || false,
            isPrivate: false,
            isMulti: field.isMultiLine || false,
            options: field.options ? { selectOptions: field.options } : undefined
          }))
        },
        { headers }
      );
    }

    // Step 5: Create pages
    console.log('Creating pages...');
    for (const pageConfig of crmBaselineManifest.pages) {
      console.log(`Creating page: ${pageConfig.name}`);
      await axios.post(
        `${CORTEZA_API}/compose/namespace/${namespaceID}/page/`,
        {
          title: pageConfig.name,
          handle: pageConfig.handle,
          visible: pageConfig.visible,
          blocks: pageConfig.blocks
        },
        { headers }
      );
    }

    console.log('CRM provisioning completed successfully!');
    console.log('You can now access your CRM at: http://localhost:18080/compose/ns/huscribe-crm');

  } catch (error) {
    console.error('Error during provisioning:', error.response?.data || error.message);
    throw error;
  }
}

provisionCRM().catch(console.error); 