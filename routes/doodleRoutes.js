import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    authorizeDoodle,
    doodleCallback,
    createPoll,
    getPoll,
    getAllPolls,
    updatePoll,
    deletePoll,
    addParticipant,
    removeParticipant,
    getParticipants,
    createMeeting,
    getMeeting,
    getAllMeetings,
    updateMeeting,
    deleteMeeting,
    syncCalendar
} from '../controllers/doodleController.js';

const router = express.Router();

/////===== Auth routes
router.get('/auth', authorizeDoodle);
router.get('/callback', doodleCallback);

/////===== Poll routes
router.post('/polls', protect, createPoll);
router.get('/polls/:pollId', protect, getPoll);
router.get('/polls', protect, getAllPolls);
router.put('/polls/:pollId', protect, updatePoll);
router.delete('/polls/:pollId', protect, deletePoll);

/////==== Participant routes
router.post('/polls/:pollId/participants', protect, addParticipant);
router.delete('/polls/:pollId/participants/:participantId', protect, removeParticipant);
router.get('/polls/:pollId/participants', protect, getParticipants);

//////===== Meeting routes
router.post('/meetings', protect, createMeeting);
router.get('/meetings/:meetingId', protect, getMeeting);
router.get('/meetings', protect, getAllMeetings);
router.put('/meetings/:meetingId', protect, updateMeeting);
router.delete('/meetings/:meetingId', protect, deleteMeeting);

/////===== Calendar sync
router.post('/calendar/sync', protect, syncCalendar);

export default router;
