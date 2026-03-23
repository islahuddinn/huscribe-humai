import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  resetUserPassword,
  getUserStats
} from "../../controllers/adminPanel/adminUserController.js";

const router = express.Router();

// Statistics route (should be before parameterized routes)
router.get('/stats', getUserStats);

// CRUD routes
router.route('/')
  .get(getAllUsers)     // GET /api/admin/users - Get all users with pagination and filtering
  .post(createUser);    // POST /api/admin/users - Create new user

router.route('/:id')
  .get(getUserById)     // GET /api/admin/users/:id - Get single user
  .put(updateUser)      // PUT /api/admin/users/:id - Update user
  .delete(deleteUser);  // DELETE /api/admin/users/:id - Delete user

// Special action routes
router.put('/:id/status', updateUserStatus);        // PATCH /api/admin/users/:id/status - Update user status
router.patch('/:id/reset-password', resetUserPassword); // PATCH /api/admin/users/:id/reset-password - Reset user password

export default router; 