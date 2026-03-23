const express = require('express');
const router = express.Router();
const outreachController = require('../controllers/outreachController');
const { protect } = require('../middleware/auth');

// Prospect routes
router.get('/prospects', protect, outreachController.getProspects);
router.get('/prospects/:id', protect, outreachController.getProspect);
router.post('/prospects', protect, outreachController.createProspect);
router.put('/prospects/:id', protect, outreachController.updateProspect);
router.delete('/prospects/:id', protect, outreachController.deleteProspect);

// Sequence routes
router.get('/sequences', protect, outreachController.getSequences);
router.post('/sequences/:sequenceId/prospects/:prospectId', protect, outreachController.addProspectToSequence);

module.exports = router; 