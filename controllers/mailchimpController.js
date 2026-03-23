import mailchimp from '@mailchimp/mailchimp_marketing';
import asyncHandler from 'express-async-handler';

// Initialize Mailchimp client
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

/////==== subscribe to list
export const subscribeToList = asyncHandler(async (req, res) => {
  const { email, firstName, lastName } = req.body;

  try {
    const response = await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
      email_address: email,
      status: 'subscribed',
      merge_fields: {
        FNAME: firstName,
        LNAME: lastName,
      },
    });

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.response?.body?.detail || 'Failed to subscribe user',
    });
  }
});

////==== get subscriber by email
export const getSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.params;

  try {
    const response = await mailchimp.lists.getListMember(
      process.env.MAILCHIMP_LIST_ID,
      email
    );

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Subscriber not found',
    });
  }
});

/////==== update
export const updateSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.params;
  const { firstName, lastName, status } = req.body;

  try {
    const response = await mailchimp.lists.updateListMember(
      process.env.MAILCHIMP_LIST_ID,
      email,
      {
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
        },
        status: status,
      }
    );

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.response?.body?.detail || 'Failed to update subscriber',
    });
  }
});

// @desc    Delete subscriber from Mailchimp list
// @route   DELETE /api/mailchimp/subscriber/:email
// @access  Public
export const deleteSubscriber = asyncHandler(async (req, res) => {
  const { email } = req.params;

  try {
    await mailchimp.lists.deleteListMember(
      process.env.MAILCHIMP_LIST_ID,
      email
    );

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.response?.body?.detail || 'Failed to delete subscriber',
    });
  }
});

// @desc    Get all lists from Mailchimp
// @route   GET /api/mailchimp/lists
// @access  Public
export const getLists = asyncHandler(async (req, res) => {
  try {
    const response = await mailchimp.lists.getAllLists();

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.response?.body?.detail || 'Failed to get lists',
    });
  }
}); 