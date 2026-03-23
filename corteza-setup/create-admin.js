import axios from 'axios';

const CORTEZA_API = 'http://localhost:18080/api';

async function createAdminUser() {
  try {
    // Create the user
    const createUserResponse = await axios.post(`${CORTEZA_API}/system/auth/signup`, {
      email: 'admin@corteza.local',
      username: 'admin',
      password: 'admin123',
      name: 'Admin User',
      handle: 'admin'
    });

    console.log('User created:', createUserResponse.data);

    // Login as the new user
    const loginResponse = await axios.post(`${CORTEZA_API}/system/auth/login`, {
      email: 'admin@corteza.local',
      password: 'admin123'
    });

    const token = loginResponse.data.response.jwt;
    const headers = { Authorization: `Bearer ${token}` };

    // Get the super-admin role ID
    const rolesResponse = await axios.get(`${CORTEZA_API}/system/roles/`, { headers });
    const superAdminRole = rolesResponse.data.response.find(r => r.handle === 'super-admin');

    if (!superAdminRole) {
      throw new Error('Could not find super-admin role');
    }

    // Assign super-admin role to the user
    await axios.post(`${CORTEZA_API}/system/roles/${superAdminRole.roleID}/members`, {
      userID: createUserResponse.data.response.userID
    }, { headers });

    console.log('Successfully created admin user and assigned super-admin role');
  } catch (error) {
    console.error('Error creating admin user:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createAdminUser(); 