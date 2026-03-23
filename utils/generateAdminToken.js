import jwt from 'jsonwebtoken';

const generateAdminToken = (id) => {
  return jwt.sign(
    { 
      id, 
      isAdmin: true,
      type: 'admin' 
    }, 
    process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET, 
    {
      expiresIn: '7d', // Shorter expiry for admin tokens
    }
  );
};

export default generateAdminToken; 