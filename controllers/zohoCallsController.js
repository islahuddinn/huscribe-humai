import {
  fetchAllFromZoho,
  fetchOneFromZoho,
  createOrUpdateInZoho,
  deleteFromZoho,
  getAccessTokenFromHeader
} from '../utils/zohoUtils.js';

// Create a Call
export const createCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newCall } = req.body;

    // Validate required fields
    if (!newCall.Subject || !newCall.Call_Type || !newCall.Call_Start_Time) {
      return res.status(400).json({
        status: 'error',
        message: 'Required fields missing: Subject, Call_Type, Call_Start_Time'
      });
    }

    // Additional fields that can be included:
    // - Call_Duration_Minutes
    // - Call_Purpose
    // - Description
    // - Call_Result
    // - Call_Agenda
    // - Who_Id (Related Contact/Lead)
    // - What_Id (Related Account/Deal)
    // - Reminder_Time
    // - Call_Status
    // - Call_End_Time
    // - Conference_Link
    // - Recording_URL
    // - Call_Notes

    const zohoResponse = await createOrUpdateInZoho('Calls', accessToken, newCall);
    res.status(201).json({
      status: 'success',
      data: zohoResponse
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get All Calls
export const getAllCalls = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, limit = 10, status, type, startDate, endDate } = req.query;
    
    let queryParams = {
      page,
      per_page: limit
    };

    // Add filters if provided
    if (status) queryParams.status = status;
    if (type) queryParams.type = type;
    if (startDate) queryParams.start_date = startDate;
    if (endDate) queryParams.end_date = endDate;

    const { data, total } = await fetchAllFromZoho('Calls', accessToken, queryParams);

    res.json({
      status: 'success',
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get a Call by ID
export const getCallById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Calls', accessToken, callId);
    res.json({
      status: 'success',
      data: zohoResponse
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update a Call
export const updateCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;
    const updatedCall = req.body;

    const zohoResponse = await createOrUpdateInZoho('Calls', accessToken, updatedCall, callId);
    res.json({
      status: 'success',
      data: zohoResponse
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Delete a Call
export const deleteCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;

    const zohoResponse = await deleteFromZoho('Calls', accessToken, callId);
    res.json({
      status: 'success',
      data: zohoResponse
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Log Call Outcome
export const logCallOutcome = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;
    const { outcome, notes, duration, endTime } = req.body;

    if (!outcome) {
      return res.status(400).json({
        status: 'error',
        message: 'Call outcome is required'
      });
    }

    const updatedCall = {
      Call_Result: outcome,
      Call_Notes: notes,
      Call_Duration_Minutes: duration,
      Call_End_Time: endTime,
      Call_Status: 'Completed'
    };

    const zohoResponse = await createOrUpdateInZoho('Calls', accessToken, updatedCall, callId);
    res.json({
      status: 'success',
      data: zohoResponse
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}; 