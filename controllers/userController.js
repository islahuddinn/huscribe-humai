import User from "../models/userModel.js";
import asyncHandler from "express-async-handler";
import generateToken from "../utils/generateToken.js";
import axios from "axios";
import sgMail from "@sendgrid/mail";
import mongoose from "mongoose";

// Configure SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Reusable function to send emails
const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: {
      email: process.env.EMAIL_FROM,
      name: "Huscribe Support" // Adding a sender name for better deliverability
    },
    subject,
    html
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', {
      message: error.message,
      response: error.response?.body,
      code: error.code
    });

    // Check for specific SendGrid errors
    if (error.code === 403) {
      throw new Error('Email sending failed: Sender verification required. Please verify your sender identity in SendGrid.');
    } else {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
};

// Function to generate a random numeric OTP of a specified length

const generateOTP = (length) => {
  const digits = '0123456789';
  let otp = '';

  for (let i = 0; i < length; i++) {
    let randomIndex;

    if (i === 0) {
      // Ensure the first digit is between 1 and 9
      randomIndex = Math.floor(Math.random() * 9) + 1;
    } else {
      randomIndex = Math.floor(Math.random() * digits.length);
    }

    otp += digits[randomIndex];
  }

  return otp;
};
// Function to verify email using Hunter API
const verifyEmailWithHunter = async (email) => {
  const apiKey = '839ea99b267060de74bc7ee8ac1d93b46404baeb';
  const url = `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${apiKey}`;

  try {
    const response = await axios.get(url);
    return response.data.data.status === 'valid';
  } catch (error) {
    console.error('Error verifying email with Hunter:', error);
    return false;
  }
};



// Login user into the Database

// Store the hash with the user's OTP request
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    

    if (!user) {
      return res.status(404).json({
        message: "No user found with this email",
        status: "error"
      });
    }

    if (user.status === 'deactivated') {
      return res.status(401).json({
        message: "Your account has been deactivated. Please contact support for assistance at huscribe@gmail.com",
        status: "error"
      });
    }

    // If password is provided, do password-based authentication
    if (password) {
      // Check if user has a password set
      if (!user.password) {
        return res.status(500).json({
          message: "Password not set. Please login using OTP or use 'Forgot Password' to set your password",
          status: "error"
        });
      }

      try {
        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          return res.status(401).json({
            message: "Invalid password",
            status: "error"
          });
        }

        // If password matches and user is verified, log them in
        if (user.verified === 1) {
          const token = generateToken(user._id);
          user.token = token;
          await user.save();

          return res.status(200).json({
            message: "Logged in successfully",
            status: "ok",
            data: {
              user,
              token
            }
          });
        } else {
          return res.status(401).json({
            message: "Please verify your account first",
            status: "error"
          });
        }
      } catch (error) {
        // Handle password comparison errors
        return res.status(400).json({
          message: "Password not set. Please login using OTP or use 'Forgot Password' to set your password",
          status: "error"
        });
      }
    }
    // If no password provided, send OTP
    else {
      const otpCode = generateOTP(4);
      user.otp_code = otpCode;
      await user.save();

      try {
        await sendEmail(
          email,
          "Login Verification",
          `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              /* General Reset */
              body, table, td, a { 
                text-size-adjust: 100%;
                font-family: Arial, sans-serif; 
                color: #333333; 
                line-height: 1.6;
              }
              table { 
                border-collapse: collapse; 
                width: 100%;
                max-width: 600px; 
                margin: auto; 
              }
              img { 
                border: 0; 
                line-height: 100%;
                outline: none; 
              }
              /* Main Container */
              .container { 
                width: 100%; 
                max-width: 600px; 
                padding: 20px; 
                background-color: #f9f9f9;
                margin: 0 auto;
                border-radius: 8px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
              }
              .header { 
                text-align: center; 
                font-size: 24px; 
                color: #4a90e2; 
                padding-bottom: 15px; 
              }
              .otp-code { 
                font-size: 20px; 
                color: #4a90e2; 
                font-weight: bold; 
                background-color: #e9f5ff; 
                padding: 10px; 
                border-radius: 6px; 
                text-align: center; 
                margin: 20px 0; 
              }
              .message { 
                font-size: 16px; 
                color: #555555; 
                text-align: center; 
                padding: 10px 20px; 
              }
              .footer { 
                font-size: 12px; 
                color: #888888; 
                text-align: center; 
                padding-top: 15px; 
              }
              /* Mobile Adjustments */
              @media (max-width: 600px) {
                .container { 
                  padding: 15px; 
                }
                .otp-code { 
                  font-size: 18px; 
                }
                .header { 
                  font-size: 20px; 
                }
              }
            </style>
          </head>
          <body>
            <table role="presentation" class="container">
              <tr>
                <td class="header">Login Verification</td>
              </tr>
              <tr>
                <td class="message">
                  Your OTP code is:
                </td>
              </tr>
              <tr>
                <td class="otp-code">
                  ${otpCode}
                </td>
              </tr>
              <tr>
                <td class="message">
                  Please enter this code to login to your account. This code will expire in 2 hours.
                </td>
              </tr>
              <tr>
                <td class="footer">
                  If you did not request this code, please ignore this email or contact support.
                </td>
              </tr>
            </table>
          </body>
          </html>
          `
        );

        let account_type = user.verified === 1 ? 'old' : 'new';

        return res.status(200).json({
          message: "OTP sent to your email",
          status: "ok",
          account_type,
          data: user
        });
      } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
          message: error.message,
          status: "error"
        });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: error.message,
      status: "error"
    });
  }
});

////====social login
export const socialLogin = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required for social login"
      });
    }

    // Find existing user
    let user = await User.findOne({ email });

    if (user) {
      // If user exists and is verified, generate token and return
      if (user.verified === 1) {
        // Generate new token
        const token = generateToken(user._id);
        user.token = token;
        await user.save();

        return res.status(200).json({
          status: "ok",
          message: "Logged in successfully",
          data: {
            user,
            token
          }
        });
      } else {
        // If user exists but is not verified, verify them
        user.verified = 1;
        await user.save();

        // Generate token
        const token = generateToken(user._id);
        user.token = token;
        await user.save();

        return res.status(200).json({
          status: "ok",
          message: "Account verified and logged in successfully",
          data: {
            user,
            token
          }
        });
      }
    } else {
      // Create new user with social login details
      // For social login with just email, we create a minimal user profile
      user = await User.create({
        email,
        verified: 1, // Social login users are pre-verified
        status: 'active'
      });

      // Generate token
      const token = generateToken(user._id);
      user.token = token;
      await user.save();

      return res.status(201).json({
        status: "ok",
        message: "Account created and logged in successfully",
        data: {
          user,
          token
        }
      });
    }
  } catch (error) {
    console.error('Social login error:', error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error during social login"
    });
  }
});

// Microsoft Login Implementation
const microsoftLogin = asyncHandler(async (req, res) => {
  try {
    const { email, microsoft_profile } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required for Microsoft login"
      });
    }

    // Find existing user
    let user = await User.findOne({ email });

    if (user) {
      // If user exists and is verified, generate token and return
      if (user.verified === 1) {
        // Generate new token
        const token = generateToken(user._id);
        user.token = token;

        // Update user profile with latest Microsoft data if provided
        if (microsoft_profile) {
          user.first_name = microsoft_profile.given_name || user.first_name;
          user.last_name = microsoft_profile.surname || user.last_name;
          user.profile_picture = microsoft_profile.photo || user.profile_picture;
        }
        
        await user.save();

        return res.status(200).json({
          status: "ok",
          message: "Logged in successfully",
          data: {
            user,
            token
          }
        });
      } else {
        // If user exists but is not verified, verify them
        user.verified = 1;
        
        // Update profile with Microsoft data if provided
        if (microsoft_profile) {
          user.first_name = microsoft_profile.given_name || user.first_name;
          user.last_name = microsoft_profile.surname || user.last_name;
          user.profile_picture = microsoft_profile.photo || user.profile_picture;
        }

        // Generate token
        const token = generateToken(user._id);
        user.token = token;
        await user.save();

        return res.status(200).json({
          status: "ok",
          message: "Account verified and logged in successfully",
          data: {
            user,
            token
          }
        });
      }
    } else {
      // Create new user with Microsoft login details
      user = await User.create({
        email,
        first_name: microsoft_profile?.given_name || '',
        last_name: microsoft_profile?.surname || '',
        profile_picture: microsoft_profile?.photo || '',
        verified: 1, // Microsoft login users are pre-verified
        status: 'active',
        provider: 'microsoft'
      });

      // Generate token
      const token = generateToken(user._id);
      user.token = token;
      await user.save();

      return res.status(201).json({
        status: "ok",
        message: "Account created and logged in successfully",
        data: {
          user,
          token
        }
      });
    }
  } catch (error) {
    console.error('Microsoft login error:', error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error during Microsoft login"
    });
  }
});


const register = asyncHandler(async (req, res) => {
  const {
    first_name,
    last_name,
    address,
    mobile_no,
    password,
    email,
    dob,
    emirates_id,
    language,
    emirates_id_photo,
    insurance_card,
    company,
    notification_preferences,
    default_input_mode
  } = req.body;

  try {
    let user = await User.findOne({ email });
    const otpCode = generateOTP(4);
    let message = '';

    if (user) {
      if (user.verified === 0) {
        // Update existing unverified user
        user.first_name = first_name;
        user.last_name = last_name;
        user.address = address;
        user.mobile_no = mobile_no;
        user.password = password;
        user.dob = dob;
        user.emirates_id = emirates_id;
        user.language = language;
        user.emirates_id_photo = emirates_id_photo;
        user.insurance_card = insurance_card;
        user.company = company;
        user.notification_preferences = notification_preferences;
        user.default_input_mode = default_input_mode;
        user.otp_code = otpCode;
        message = 'User details updated and new OTP sent';
      } else {
        return res.status(400).json({
          message: "User already exists and is verified, Please login",
          status: "error"
        });
      }
    } else {
      // Create new user
      user = new User({
        first_name,
        last_name,
        address,
        mobile_no,
        password,
        email,
        dob,
        emirates_id,
        language,
        emirates_id_photo,
        insurance_card,
        company,
        notification_preferences,
        default_input_mode,
        otp_code: otpCode,
        verified: 0
      });
      message = 'New user created and OTP sent';
    }

    await user.save();

    await sendEmail(
      email,
      "Verify Your Registration",
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* General Reset */
          body, table, td, a { 
            text-size-adjust: 100%;
            font-family: Arial, sans-serif; 
            color: #333333; 
            line-height: 1.6;
          }
          table { 
            border-collapse: collapse; 
            width: 100%;
            max-width: 600px; 
            margin: auto; 
          }
          img { 
            border: 0; 
            line-height: 100%;
            outline: none; 
          }
          /* Main Container */
          .container { 
            width: 100%; 
            max-width: 600px; 
            padding: 20px; 
            background-color: #f9f9f9;
            margin: 0 auto;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            font-size: 24px; 
            color: #4a90e2; 
            padding-bottom: 15px; 
          }
          .otp-code { 
            font-size: 20px; 
            color: #4a90e2; 
            font-weight: bold; 
            background-color: #e9f5ff; 
            padding: 10px; 
            border-radius: 6px; 
            text-align: center; 
            margin: 20px 0; 
          }
          .message { 
            font-size: 16px; 
            color: #555555; 
            text-align: center; 
            padding: 10px 20px; 
          }
          .footer { 
            font-size: 12px; 
            color: #888888; 
            text-align: center; 
            padding-top: 15px; 
          }
          /* Mobile Adjustments */
          @media (max-width: 600px) {
            .container { 
              padding: 15px; 
            }
            .otp-code { 
              font-size: 18px; 
            }
            .header { 
              font-size: 20px; 
            }
          }
        </style>
      </head>
      <body>
        <table role="presentation" class="container">
          <tr>
            <td class="header">Verify Your Registration</td>
          </tr>
          <tr>
            <td class="message">
              Your OTP code is:
            </td>
          </tr>
          <tr>
            <td class="otp-code">
              ${otpCode}
            </td>
          </tr>
          <tr>
            <td class="message">
              Please enter this code to verify your account. This code will expire in 2 hours.
            </td>
          </tr>
          <tr>
            <td class="footer">
              If you did not request this code, please ignore this email or contact support.
            </td>
          </tr>
        </table>
      </body>
      </html>
      `
    );

    res.status(201).json({
      message: message,
      status: "ok",
      data: {
        user,
        token: generateToken(user._id)
      }
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message,
      status: "error"
    });
  }
});

// Admin Portal Dashboard
const adminPortalDashboard = asyncHandler(async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const inactiveUsers = await User.countDocuments({ status: 'inactive' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });

    // Get subscription statistics
    const activeSubscriptions = await User.countDocuments({
      subscriptionStatus: 'active',
      'currentPlan': { $ne: null }
    });

    // Get RFQ statistics from RFQ collection
    const RFQ = mongoose.model('RFQ');
    const totalRfqs = await RFQ.countDocuments();
    const pendingRfqs = await RFQ.countDocuments({ status: 'pending' });
    const completedRfqs = await RFQ.countDocuments({ status: 'completed' });

    // Get active promo codes count and details
    const Coupon = mongoose.model('Coupon');
    const [activePromoCodes, totalPromoCodes, expiredPromoCodes, inactivePromoCodes] = await Promise.all([
      // Active promo codes
      Coupon.countDocuments({
        $and: [
          { isActive: true },
          { validUntil: { $gte: new Date() } },
          {
            $expr: {
              $lt: ['$currentUses', '$maxUses']
            }
          }
        ]
      }),
      // Total promo codes
      Coupon.countDocuments({}),
      // Expired promo codes
      Coupon.countDocuments({
        validUntil: { $lt: new Date() }
      }),
      // Inactive promo codes
      Coupon.countDocuments({
        isActive: false
      })
    ]);

    // Get recent users for the table view
    const recentUsers = await User.find()
      .select('-password -otp_code')
      .populate('currentPlan')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Return all dashboard data
    res.json({
      status: "ok",
      data: {
        cards: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: inactiveUsers,
            suspended: suspendedUsers
          },
          subscriptions: {
            activePlans: activeSubscriptions
          },
          rfqs: {
            total: totalRfqs,
            pending: pendingRfqs,
            completed: completedRfqs
          },
          promoCodes: {
            total: totalPromoCodes,
            active: activePromoCodes,
            expired: expiredPromoCodes,
            inactive: inactivePromoCodes
          }
        },
        recentUsers: recentUsers.map(user => ({
          ...user,
          hasValidSubscription: user.subscriptionStatus === 'active' ||
            (user.subscriptionStatus === 'cancelled' &&
              user.subscriptionEndsAt &&
              new Date(user.subscriptionEndsAt) > new Date()),
          isInTrial: user.trialEndsAt && new Date(user.trialEndsAt) > new Date()
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// Verify OTP
const verifyRegistrationOTP = asyncHandler(async (req, res) => {
  const { email, otpCode } = req.body;

  const user = await User.findOne({ email });

  let account_type = ''
  if (!user) {
    res.status(404).json({ message: "User not found", status: "error" });
  }
  if (user.verified === 0) {
    account_type = 'new'
  } else {
    account_type = 'old'
    user.status = 'active'
    await user.save()
  }
  const userData = {
    user: {
      ...user.toObject(),
      // rating: averageRating,
    },
    token: generateToken(user._id),
  }

  if (Number(otpCode) === Number(user.otp_code)) {
    const data = await User.findOneAndUpdate(
      { _id: user._id },
      { verified: 1 },
      { new: true }
    );


    res.status(200).json({ message: "Logged In successfully", status: "ok", data: userData, account_type });
  } else {
    res.status(500).json({ message: "Invalid OTP code", status: "error" });
  }
});

// Function to send reset OTP code to email
// Function to send reset OTP code to mobile number
const sendResetOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Verify email first
  // const isEmailValid = await verifyEmailWithHunter(email);
  // if (!isEmailValid) {
  //   return res.status(400).json({
  //     message: "Invalid email address. Please provide a valid email.",
  //     status: "error"
  //   });
  // }

  let account_type = '';
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "No user exists with this email!", status: "error" });
  }

  if (user.verified === 0) {
    account_type = 'new';
  } else {
    account_type = 'old';
  }

  const otpCode = generateOTP(4);
  user.otp_code = otpCode;
  await user.save();

  try {
    await sendEmail(
      email,
      "Reset OTP Verification",
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* General Reset */
          body, table, td, a { 
            text-size-adjust: 100%;
            font-family: Arial, sans-serif; 
            color: #333333; 
            line-height: 1.6;
          }
          table { 
            border-collapse: collapse; 
            width: 100%;
            max-width: 600px; 
            margin: auto; 
          }
          img { 
            border: 0; 
            line-height: 100%;
            outline: none; 
          }
          /* Main Container */
          .container { 
            width: 100%; 
            max-width: 600px; 
            padding: 20px; 
            background-color: #f9f9f9;
            margin: 0 auto;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            font-size: 24px; 
            color: #4a90e2; 
            padding-bottom: 15px; 
          }
          .otp-code { 
            font-size: 20px; 
            color: #4a90e2; 
            font-weight: bold; 
            background-color: #e9f5ff; 
            padding: 10px; 
            border-radius: 6px; 
            text-align: center; 
            margin: 20px 0; 
          }
          .message { 
            font-size: 16px; 
            color: #555555; 
            text-align: center; 
            padding: 10px 20px; 
          }
          .footer { 
            font-size: 12px; 
            color: #888888; 
            text-align: center; 
            padding-top: 15px; 
          }
          /* Mobile Adjustments */
          @media (max-width: 600px) {
            .container { 
              padding: 15px; 
            }
            .otp-code { 
              font-size: 18px; 
            }
            .header { 
              font-size: 20px; 
            }
          }
        </style>
      </head>
      <body>
        <table role="presentation" class="container">
          <tr>
            <td class="header">Verify Your Entry</td>
          </tr>
          <tr>
            <td class="message">
              Your OTP code is:
            </td>
          </tr>
          <tr>
            <td class="otp-code">
              ${otpCode}
            </td>
          </tr>
          <tr>
            <td class="message">
              Please enter this code to verify your account. This code will expire in 2 hours.
            </td>
          </tr>
          <tr>
            <td class="footer">
              If you did not request this code, please ignore this email or contact support.
            </td>
          </tr>
        </table>
      </body>
      </html>
      `
    );

    res.status(200).json({
      message: "Check your email for OTP code!",
      status: "ok",
      account_type
    });
  } catch (error) {
    console.log('Error', error);
    res.status(500).json({
      message: error.message,
      status: "error"
    });
  }
});

//Get all user from the database

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ first_name: { $ne: 0 } }); // $ne stands for "not equal to"
  return res.json({
    data: users,
    status: "ok"
  });
});

//Get  user fbas on user_id

const getSpecificUser = asyncHandler(async (req, res) => {
  const { user_id } = req.query
  const user = await User.findOne({ _id: user_id });
  res.json({
    data: user,
    status: "ok"
  });
});
// forgot password

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Verify email first
  // const isEmailValid = await verifyEmailWithHunter(email);
  // if (!isEmailValid) {
  //   return res.status(400).json({
  //     message: "Invalid email address. Please provide a valid email.",
  //     status: "error"
  //   });
  // }

  const userExist = await User.findOne({ email });

  if (!userExist) {
    return res.status(201).json({ message: "No user exists with this email!", status: "error" });
  }

  try {
    const otpCode = generateOTP(4);
    userExist.otp_code = otpCode;
    await userExist.save();

    await sendEmail(
      userExist.email,
      "Password Reset Verification",
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* General Reset */
          body, table, td, a { 
            text-size-adjust: 100%;
            font-family: Arial, sans-serif; 
            color: #333333; 
            line-height: 1.6;
          }
          table { 
            border-collapse: collapse; 
            width: 100%;
            max-width: 600px; 
            margin: auto; 
          }
          img { 
            border: 0; 
            line-height: 100%;
            outline: none; 
          }
          /* Main Container */
          .container { 
            width: 100%; 
            max-width: 600px; 
            padding: 20px; 
            background-color: #f9f9f9;
            margin: 0 auto;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .header { 
            text-align: center; 
            font-size: 24px; 
            color: #4a90e2; 
            padding-bottom: 15px; 
          }
          .otp-code { 
            font-size: 20px; 
            color: #4a90e2; 
            font-weight: bold; 
            background-color: #e9f5ff; 
            padding: 10px; 
            border-radius: 6px; 
            text-align: center; 
            margin: 20px 0; 
          }
          .message { 
            font-size: 16px; 
            color: #555555; 
            text-align: center; 
            padding: 10px 20px; 
          }
          .footer { 
            font-size: 12px; 
            color: #888888; 
            text-align: center; 
            padding-top: 15px; 
          }
          /* Mobile Adjustments */
          @media (max-width: 600px) {
            .container { 
              padding: 15px; 
            }
            .otp-code { 
              font-size: 18px; 
            }
            .header { 
              font-size: 20px; 
            }
          }
        </style>
      </head>
      <body>
        <table role="presentation" class="container">
          <tr>
            <td class="header">Verify Your Entry</td>
          </tr>
          <tr>
            <td class="message">
              Your OTP code is:
            </td>
          </tr>
          <tr>
            <td class="otp-code">
              ${otpCode}
            </td>
          </tr>
          <tr>
            <td class="message">
              Please enter this code to verify your account. This code will expire in 2 hours.
            </td>
          </tr>
          <tr>
            <td class="footer">
              If you did not request this code, please ignore this email or contact support.
            </td>
          </tr>
        </table>
      </body>
      </html>
      `
    );

    res.status(200).json({
      message: "Check your email for OTP code!",
      status: "ok"
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message,
      status: "error"
    });
  }
});


// Update Passsword
const updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(404).json({
      message: 'User not found',
      status: 'error'
    });
  }

  if (Number(user.otp_code) === Number(req.body.otpCode)) {
    // OTP code is valid
    user.password = req.body.new_password; // Pre-save hook will hash the password
    user.verified = 1
    user.otp_code = undefined; // Clear the OTP code after using it

    try {
      const updatedUser = await user.save();
      return res.json({
        data: updatedUser,
        message: 'Password Updated',
        status: 'ok',
        token: generateToken(updatedUser._id),
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Error saving updated user',
        status: 'error',
        error: error.message,
      });
    }
  } else {
    return res.status(500).json({
      message: 'Invalid OTP code',
      status: 'error'
    });
  }
});


// update user data for profile

const updateUserDetails = asyncHandler(async (req, res) => {
  try {
    const data = await User.findOneAndUpdate(
      { _id: req.body._id },
      req.body
    );
    res.status(200).json({ data, message: "Changes Saved Successfully!", status: "ok" });
  } catch (err) {
    res.status(500).json({ message: `${err}`, status: "ok" });
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.query.user_id;

    // Delete the user
    const userDeletionResult = await User.deleteOne({ _id: userId });

    res.status(200).json({
      message: "User and associated data deleted successfully!",
      status: 'ok',
      userDeletionResult,
    });
  } catch (err) {
    res.status(500).json({ error: err, status: "error" });
  }
});
const getConversations = asyncHandler(async (req, res) => {
  // _id is user_id

  try {
    const { _id } = req.query;
    const ConversationsCollection = mongoose.connection.collection('conversations');

    let conversations;
    if (_id) {
      conversations = await ConversationsCollection.findOne({ _id: mongoose.Types.ObjectId(_id) });
    } else {
      conversations = await ConversationsCollection.find({}).toArray();
    }

    res.status(200).json({ data: conversations, status: "ok" });
  } catch (err) {
    res.status(500).json({ message: `${err}`, status: "error" });
  }
});
const getAylaConversations = asyncHandler(async (req, res) => {


  try {
    const { rfq_id } = req.query;
    const ConversationsCollection = mongoose.connection.collection('alexa_ayla_conversations');

    let conversations;
    if (rfq_id) {
      conversations = await ConversationsCollection.findOne({ rfq_id: mongoose.Types.ObjectId(rfq_id) });
    } else {
      conversations = await ConversationsCollection.find({}).toArray();
    }

    res.status(200).json({ data: conversations, status: "ok" });
  } catch (err) {
    res.status(500).json({ message: `${err}`, status: "error" });
  }
});
const updateHash = asyncHandler(async (req, res) => {
  const { email, app_hash } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 'error'
      });
    }

    // Update the user's app_hash
    user.app_hash = app_hash;
    await user.save();

    res.status(200).json({
      message: 'Hash updated successfully',
      status: 'ok',
      data: user
    });
  } catch (error) {
    console.error('Error updating hash:', error);
    res.status(500).json({
      message: 'Error updating hash',
      status: 'error',
      error: error.message
    });
  }
});

// Check if user exists
const checkUserExists = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        exists: false,
        status: "ok"
      });
    }

    return res.status(200).json({
      exists: true,
      verified: user.verified === 1,
      status: "ok"
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({
      message: error.message,
      status: "error"
    });
  }
});

// @desc    Update password with current password verification
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found',
      status: 'error'
    });
  }

  // Verify current password
  const isMatch = await user.matchPassword(current_password);
  if (!isMatch) {
    return res.status(401).json({
      message: 'Current password is incorrect',
      status: 'error'
    });
  }

  // Update password - will be hashed by pre-save middleware
  user.password = new_password;
  await user.save();

  res.json({
    status: 'ok',
    message: 'Password changed successfully'
  });
});

const checkPlanAndQuota = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('currentPlan');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if subscription is active OR cancelled but not yet expired
  const hasValidSubscription = user.subscriptionStatus === 'active' ||
    (user.subscriptionStatus === 'cancelled' &&
      user.subscriptionEndsAt &&
      new Date(user.subscriptionEndsAt) > new Date());

  // Check if user is in trial period
  const isInTrial = user.isInTrial();

  // Check RFQ quota
  const hasQuota = await user.hasRfqQuota();

  // Check publicDb feature access
  const hasPublicDbAccess = user.currentPlan?.features?.publicDb || false;

  let status = 'error';
  let message = '';

  if (!hasValidSubscription && !isInTrial) {
    status = 'no_plan';
    message = 'You do not have any active plan or trial period';
  } else if (!hasQuota) {
    status = 'no_quota';
    message = 'You have reached your monthly RFQ quota limit';
  } else {
    status = 'success';
    message = 'You have an active plan with available RFQ quota';
  }

  res.json({
    status,
    message,
    hasValidSubscription,
    isInTrial,
    hasQuota,
    hasPublicDbAccess
  });
});

// @desc    Get all users with detailed information for admin
// @route   GET /api/users/admin/users
// @access  Admin
const getAdminUsersList = asyncHandler(async (req, res) => {
  const users = await User.find()
    .populate('currentPlan')
    .select('-password -otp_code')
    .lean();

  const UserTokenTotalsCollection = mongoose.connection.collection('user_token_totals');

  const enhancedUsers = await Promise.all(users.map(async (user) => {
    // Check subscription status
    const hasValidSubscription = user.subscriptionStatus === 'active' ||
      (user.subscriptionStatus === 'cancelled' &&
        user.subscriptionEndsAt &&
        new Date(user.subscriptionEndsAt) > new Date());

    // Update status based on subscription if status is not suspended
    if (user.status !== 'suspended') {
      user.status = hasValidSubscription ? 'active' : 'inactive';
    }

    // Get token usage data for this user
    const tokenAggregation = await UserTokenTotalsCollection.aggregate([
      {
        $match: {
          user_id: user._id
        }
      },
      {
        $group: {
          _id: null,
          total_input_tokens: { $sum: "$input_tokens" },
          total_output_tokens: { $sum: "$output_tokens" },
          total_tokens: { $sum: "$total_tokens" }
        }
      }
    ]).toArray();

    const tokenUsage = tokenAggregation.length > 0 ? {
      total_input_tokens: tokenAggregation[0].total_input_tokens || 0,
      total_output_tokens: tokenAggregation[0].total_output_tokens || 0,
      total_tokens: tokenAggregation[0].total_tokens || 0
    } : {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0
    };

    return {
      ...user,
      hasValidSubscription,
      isInTrial: user.trialEndsAt && new Date(user.trialEndsAt) > new Date(),
      tokenUsage
    };
  }));

  res.json({
    status: "ok",
    data: enhancedUsers
  });
});

// @desc    Update user status (suspend/activate)
// @route   PUT /api/users/admin/update-status
// @access  Admin
const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId, status } = req.body;

  if (!['active', 'suspended', 'inactive'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status value');
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.status = status;
  await user.save();

  res.json({
    status: "ok",
    message: `User status updated to ${status}`,
    data: {
      userId: user._id,
      status: user.status
    }
  });
});

// @desc    Get user token usage details
// @route   GET /api/users/token-usage/:user_id
// @access  Private
const getUserTokenUsage = asyncHandler(async (req, res) => {
  try {
    const { user_id } = req.params;
    const UserTokenTotalsCollection = mongoose.connection.collection('user_token_totals');

    let tokenUsage;
    let tokenSummary = {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0
    };

    if (user_id) {
      // Get individual token usage records
      tokenUsage = await UserTokenTotalsCollection.findOne({
        user_id: new mongoose.Types.ObjectId(user_id)
      });

      // Get aggregated token summaries
      const tokenAggregation = await UserTokenTotalsCollection.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(user_id)
          }
        },
        {
          $group: {
            _id: null,
            total_input_tokens: { $sum: "$input_tokens" },
            total_output_tokens: { $sum: "$output_tokens" },
            total_tokens: { $sum: "$total_tokens" }
          }
        }
      ]).toArray();

      if (tokenAggregation.length > 0) {
        tokenSummary = {
          total_input_tokens: tokenAggregation[0].total_input_tokens || 0,
          total_output_tokens: tokenAggregation[0].total_output_tokens || 0,
          total_tokens: tokenAggregation[0].total_tokens || 0
        };
      }
    } else {
      // Get all users' token usage
      tokenUsage = await UserTokenTotalsCollection.find({}).toArray();

      // Get aggregated token summaries for all users
      const tokenAggregation = await UserTokenTotalsCollection.aggregate([
        {
          $group: {
            _id: null,
            total_input_tokens: { $sum: "$input_tokens" },
            total_output_tokens: { $sum: "$output_tokens" },
            total_tokens: { $sum: "$total_tokens" }
          }
        }
      ]).toArray();

      if (tokenAggregation.length > 0) {
        tokenSummary = {
          total_input_tokens: tokenAggregation[0].total_input_tokens || 0,
          total_output_tokens: tokenAggregation[0].total_output_tokens || 0,
          total_tokens: tokenAggregation[0].total_tokens || 0
        };
      }
    }

    res.status(200).json({
      data: {
        usage: tokenUsage,
        summary: tokenSummary
      },
      status: "ok"
    });
  } catch (err) {
    res.status(500).json({
      message: `${err}`,
      status: "error"
    });
  }
});

// @desc    Update FCM token for a user
// @route   POST /api/users/fcm-token
// @access  Private
const updateFcmToken = asyncHandler(async (req, res) => {
  const { token, device, userId, deviceType, platform } = req.body;

  if (!token || !device) {
    return res.status(400).json({
      status: 'error',
      message: 'Token and device are required'
    });
  }

  try {
    const user = await User.findById(userId || req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    await user.addFcmToken(token, device);

    res.json({
      status: 'ok',
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('currentPlan', 'name features price')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Calculate subscription info
    const subscriptionInfo = {
      hasActiveSubscription: user.hasActiveSubscription(),
      isInTrial: user.isInTrial(),
      subscriptionEndsAt: user.subscriptionEndsAt,
      trialEndsAt: user.trialEndsAt
    };

    res.status(200).json({
      status: 'ok',
      data: {
        user,
        subscriptionInfo
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      mobile_no,
      address,
      dob,
      gender,
      company,
      language,
      notification_preferences,
      default_input_mode
    } = req.body;

    // Build update object with only provided fields
    const updateFields = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (mobile_no !== undefined) updateFields.mobile_no = mobile_no;
    if (address !== undefined) updateFields.address = address;
    if (dob !== undefined) updateFields.dob = dob;
    if (gender !== undefined) updateFields.gender = gender;
    if (company !== undefined) updateFields.company = company;
    if (language !== undefined) updateFields.language = language;
    if (notification_preferences !== undefined) updateFields.notification_preferences = notification_preferences;
    if (default_input_mode !== undefined) updateFields.default_input_mode = default_input_mode;

    // Check if there are any fields to update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields provided for update'
      });
    }

    // Update user using findByIdAndUpdate for better reliability
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { 
        new: true, // Return the updated document
        runValidators: true // Run schema validators
      }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'ok',
      message: 'Profile updated successfully',
      data: {
        user: updatedUser.toObject()
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update profile picture
// @route   PUT /api/users/profile-picture
// @access  Private
const updateProfilePicture = asyncHandler(async (req, res) => {
  try {
    const { profile_picture } = req.body;

    if (!profile_picture) {
      return res.status(400).json({
        status: 'error',
        message: 'Profile picture URL is required'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    user.profile_picture = profile_picture;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Profile picture updated successfully',
      data: {
        profile_picture: user.profile_picture
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Change email address
// @route   PUT /api/users/change-email
// @access  Private
const changeEmail = asyncHandler(async (req, res) => {
  try {
    const { new_email, current_password } = req.body;

    if (!new_email || !current_password) {
      return res.status(400).json({
        status: 'error',
        message: 'New email and current password are required'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.matchPassword(current_password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Check if new email already exists
    const existingUser = await User.findOne({ email: new_email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email address already in use'
      });
    }

    // Verify email with Hunter API
    const isEmailValid = await verifyEmailWithHunter(new_email);
    if (!isEmailValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email address'
      });
    }

    // Generate OTP for email verification
    const otpCode = generateOTP(4);
    user.otp_code = otpCode;
    user.verified = 0; // Mark as unverified until new email is confirmed
    
    // Store new email temporarily (you might want to add a temp_email field to schema)
    user.email = new_email;
    await user.save();

    // Send verification email to new address
    await sendEmail(
      new_email,
      "Email Change Verification",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; }
          .header { text-align: center; color: #4a90e2; font-size: 24px; margin-bottom: 20px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #4a90e2; text-align: center; 
                     background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .message { font-size: 16px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Email Change Verification</div>
          <div class="message">
            <p>You have requested to change your email address. Please use the following OTP to verify your new email:</p>
          </div>
          <div class="otp-code">${otpCode}</div>
          <div class="message">
            <p>This OTP will expire in 10 minutes. If you didn't request this change, please contact support immediately.</p>
          </div>
        </div>
      </body>
      </html>
      `
    );

    res.status(200).json({
      status: 'ok',
      message: 'Verification OTP sent to new email address. Please verify to complete the change.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Reset password with current password
// @route   PUT /api/users/reset-password
// @access  Private
const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password, new password, and confirmation are required'
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        status: 'error',
        message: 'New password and confirmation do not match'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.matchPassword(current_password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = new_password;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get account security settings
// @route   GET /api/users/security
// @access  Private
const getSecuritySettings = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('email verified fcmTokens createdAt');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const securityInfo = {
      email: user.email,
      emailVerified: user.verified === 1,
      accountCreated: user.createdAt,
      activeDevices: user.fcmTokens.length,
      devices: user.fcmTokens.map(token => ({
        device: token.device,
        addedAt: token.createdAt
      }))
    };

    res.status(200).json({
      status: 'ok',
      data: securityInfo
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Remove device/FCM token
// @route   DELETE /api/users/devices/:device
// @access  Private
const removeDevice = asyncHandler(async (req, res) => {
  try {
    const { device } = req.params;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Remove the device token
    user.fcmTokens = user.fcmTokens.filter(token => token.device !== device);
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Device removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get account usage statistics
// @route   GET /api/users/usage-stats
// @access  Private
const getUsageStats = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('currentPlan');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const usageStats = {
      currentPlan: user.currentPlan ? {
        name: user.currentPlan.name,
        features: user.currentPlan.features
      } : null,
      usage: {
        voicesUsed: user.usage.voicesUsed,
        meetingsUsed: user.usage.meetingsUsed,
        lastResetDate: user.usage.lastResetDate
      },
      remaining: {
        voices: user.remainingVoices,
        meetings: user.remainingMeetings
      },
      subscription: {
        status: user.subscriptionStatus,
        endsAt: user.subscriptionEndsAt,
        isInTrial: user.isInTrial(),
        hasActiveSubscription: user.hasActiveSubscription()
      }
    };

    res.status(200).json({
      status: 'ok',
      data: usageStats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update notification preferences
// @route   PUT /api/users/notifications
// @access  Private
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  try {
    const { notification_preferences } = req.body;

    if (!notification_preferences) {
      return res.status(400).json({
        status: 'error',
        message: 'Notification preferences are required'
      });
    }

    const validPreferences = ['all', 'important', 'none'];
    if (!validPreferences.includes(notification_preferences)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification preference. Must be: all, important, or none'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    user.notification_preferences = notification_preferences;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Notification preferences updated successfully',
      data: {
        notification_preferences: user.notification_preferences
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Deactivate account
// @route   PUT /api/users/deactivate
// @access  Private
const deactivateAccount = asyncHandler(async (req, res) => {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        status: 'error',
        message: 'Password is required to deactivate account'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Password is incorrect'
      });
    }

    // Deactivate account
    user.status = 'deactivated';
    
    // Clear sensitive data but keep for potential reactivation
    user.fcmTokens = [];
    
    await user.save();

    // Send deactivation confirmation email
    await sendEmail(
      user.email,
      "Account Deactivated",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; }
          .header { text-align: center; color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
          .message { font-size: 16px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Account Deactivated</div>
          <div class="message">
            <p>Your Huscribe account has been successfully deactivated.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>If you wish to reactivate your account in the future, please contact our support team.</p>
            <p>Thank you for using Huscribe.</p>
          </div>
        </div>
      </body>
      </html>
      `
    );

    res.status(200).json({
      status: 'ok',
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Request account data export
// @route   POST /api/users/export-data
// @access  Private
const requestDataExport = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('currentPlan')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // In a real implementation, you would:
    // 1. Queue a background job to collect all user data
    // 2. Generate a downloadable file
    // 3. Send email with download link
    // For now, we'll send the basic user data

    const userData = {
      profile: user.toObject(),
      exportDate: new Date(),
      dataTypes: [
        'Profile Information',
        'Voice Memos',
        'Meeting Records',
        'Transcriptions',
        'Subscription History',
        'Usage Statistics'
      ]
    };

    // Send email with data export info
    await sendEmail(
      user.email,
      "Data Export Request",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; }
          .header { text-align: center; color: #4a90e2; font-size: 24px; margin-bottom: 20px; }
          .message { font-size: 16px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Data Export Request</div>
          <div class="message">
            <p>Your data export request has been received and is being processed.</p>
            <p>You will receive another email with a download link within 24 hours.</p>
            <p>The export will include:</p>
            <ul>
              <li>Profile Information</li>
              <li>Voice Memos</li>
              <li>Meeting Records</li>
              <li>Transcriptions</li>
              <li>Subscription History</li>
              <li>Usage Statistics</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
      `
    );

    res.status(200).json({
      status: 'ok',
      message: 'Data export request submitted. You will receive an email with download link within 24 hours.',
      data: {
        requestDate: new Date(),
        estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get notification preferences
// @route   GET /api/users/notifications
// @access  Private
const getNotificationPreferences = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notification_preferences');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'ok',
      data: {
        notification_preferences: user.notification_preferences || 'all'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get privacy settings
// @route   GET /api/users/privacy
// @access  Private
const getPrivacySettings = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('privacy_settings');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Default privacy settings if none exist
    const defaultPrivacySettings = {
      dataProcessingConsent: true,
      marketingConsent: false,
      analyticsConsent: true,
      thirdPartySharing: false,
      updatedAt: user.createdAt
    };

    res.status(200).json({
      status: 'ok',
      data: {
        privacy_settings: user.privacy_settings || defaultPrivacySettings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Test profile update (for debugging)
// @route   POST /api/users/test-profile-update
// @access  Private
const testProfileUpdate = asyncHandler(async (req, res) => {
  try {
    const { test_field } = req.body;
    
    // First, get the current user
    const currentUser = await User.findById(req.user._id).select('-password');
    
    if (!currentUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Try a simple update
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { first_name: test_field || 'Test Update' } },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'ok',
      message: 'Test update successful',
      data: {
        before: {
          id: currentUser._id,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name
        },
        after: {
          id: updatedUser._id,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});


//// controller for adding multiple user with transaction

const multiUserAdd = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const users = req.body.users; // Expecting an array of user objects
    const createdUsers = [];
    for (const userData of users) {
      const { email, password, first_name, last_name } = userData;
      if (!email || !password) {
        throw new Error('Email and password are required for each user');
      }
      const existingUser = await User.findOne({ email }).session(session);
      if (existingUser) {
        throw new Error(`User with email ${email} already exists`);
      }
      const newUser = new User({
        email,
        password,
        first_name,
        last_name,
        verified: 1 // Auto-verify for bulk added users
      });
      await newUser.save({ session });
      createdUsers.push(newUser);
    }
    /// handling the failed users

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({  
      status: 'ok',

      message: 'All users created successfully',



export {
  login,
  getConversations,
  getAylaConversations,
  register,
  adminPortalDashboard,
  sendResetOTP,
  verifyRegistrationOTP,
  getUsers,
  updatePassword,
  forgotPassword,
  updateUserDetails,
  deleteUser,
  getSpecificUser,
  updateHash,
  checkUserExists,
  changePassword,
  checkPlanAndQuota,
  getAdminUsersList,
  updateUserStatus,
  getUserTokenUsage,
  updateFcmToken,
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  changeEmail,
  resetPassword,
  getSecuritySettings,
  removeDevice,
  getUsageStats,
  updateNotificationPreferences,
  getNotificationPreferences,
  getPrivacySettings,
  deactivateAccount,
  requestDataExport,
  testProfileUpdate,
  microsoftLogin
};
