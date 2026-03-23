import express from 'express';
import { protect, restrictTo } from '../controllers/authController.js';
import * as couponController from '../controllers/couponController.js';

const router = express.Router();

// Public route for validating coupons
router.post('/validate', couponController.validateCoupon);

// Protect all other routes - require admin access
router.use(protect);
router.use(restrictTo('admin'));

router.route('/')
    .get(couponController.getAllCoupons)
    .post(couponController.createCoupon);

router.route('/:id')
    .get(couponController.getCoupon)
    .patch(couponController.updateCoupon)
    .delete(couponController.deleteCoupon);

router.patch('/:id/toggle', couponController.toggleCouponStatus);

export default router; 