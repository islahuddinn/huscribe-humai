const outreachService = require('../services/outreachService');
const { handleError } = require('../utils/errorHandler');

/**
 * @desc Get all prospects from Outreach
 * @route GET /api/outreach/prospects
 * @access Private
 */
exports.getProspects = async (req, res) => {
    try {
        const prospects = await outreachService.getProspects();
        res.status(200).json({
            success: true,
            data: prospects
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Get a single prospect from Outreach
 * @route GET /api/outreach/prospects/:id
 * @access Private
 */
exports.getProspect = async (req, res) => {
    try {
        const prospect = await outreachService.getProspect(req.params.id);
        res.status(200).json({
            success: true,
            data: prospect
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Create a new prospect in Outreach
 * @route POST /api/outreach/prospects
 * @access Private
 */
exports.createProspect = async (req, res) => {
    try {
        const prospect = await outreachService.createProspect(req.body);
        res.status(201).json({
            success: true,
            data: prospect
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Update a prospect in Outreach
 * @route PUT /api/outreach/prospects/:id
 * @access Private
 */
exports.updateProspect = async (req, res) => {
    try {
        const prospect = await outreachService.updateProspect(req.params.id, req.body);
        res.status(200).json({
            success: true,
            data: prospect
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Delete a prospect from Outreach
 * @route DELETE /api/outreach/prospects/:id
 * @access Private
 */
exports.deleteProspect = async (req, res) => {
    try {
        await outreachService.deleteProspect(req.params.id);
        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Get all sequences from Outreach
 * @route GET /api/outreach/sequences
 * @access Private
 */
exports.getSequences = async (req, res) => {
    try {
        const sequences = await outreachService.getSequences();
        res.status(200).json({
            success: true,
            data: sequences
        });
    } catch (error) {
        handleError(res, error);
    }
};

/**
 * @desc Add a prospect to a sequence
 * @route POST /api/outreach/sequences/:sequenceId/prospects/:prospectId
 * @access Private
 */
exports.addProspectToSequence = async (req, res) => {
    try {
        const result = await outreachService.addProspectToSequence(
            req.params.sequenceId,
            req.params.prospectId
        );
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        handleError(res, error);
    }
}; 