const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/mailer');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST /api/auth/send-otp (Initiate registration with 6-digit OTP email)
router.post('/send-otp', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Email, username, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or username already exists.' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.findOneAndUpdate(
      { email: cleanEmail },
      {
        email: cleanEmail,
        username: cleanUsername,
        password,
        otp,
        expiresAt,
      },
      { upsert: true, new: true }
    );

    const emailRes = await sendOtpEmail(cleanEmail, otp, cleanUsername);

    res.json({
      message: 'Verification code sent to your email.',
      email: cleanEmail,
      simulated: !!emailRes.simulated,
      ...(emailRes.simulated ? { otpPreview: otp } : {}),
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
  }
});

// POST /api/auth/resend-otp (Resend a fresh 6-digit OTP)
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pending = await Otp.findOne({ email: cleanEmail });

    if (!pending) {
      return res.status(404).json({ message: 'No pending registration found for this email. Please register again.' });
    }

    const otp = generateOtp();
    pending.otp = otp;
    pending.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();

    const emailRes = await sendOtpEmail(cleanEmail, otp, pending.username);

    res.json({
      message: 'A new 6-digit verification code has been sent.',
      email: cleanEmail,
      simulated: !!emailRes.simulated,
      ...(emailRes.simulated ? { otpPreview: otp } : {}),
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Failed to resend verification code. Please try again.' });
  }
});

// POST /api/auth/verify-otp (Verify 6-digit OTP and complete registration)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and 6-digit verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const pending = await Otp.findOne({ email: cleanEmail });

    if (!pending) {
      return res.status(400).json({ message: 'Verification code has expired or is invalid. Please request a new code.' });
    }

    if (new Date() > pending.expiresAt) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    if (pending.otp !== cleanOtp) {
      return res.status(400).json({ message: 'Invalid 6-digit verification code. Please try again.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: pending.username.toLowerCase() }]
    });

    if (existingUser) {
      await Otp.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'User with this email or username already exists.' });
    }

    const user = new User({
      email: cleanEmail,
      username: pending.username,
      password: pending.password,
      isVerified: true,
    });
    await user.save();

    await Otp.deleteOne({ _id: pending._id });

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Account verified and created successfully!',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        storageUsedBytes: user.storageUsedBytes,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/register (Wrapper supporting both OTP verification and initial trigger)
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, otp } = req.body;

    if (otp) {
      // If otp provided, delegate to verify-otp logic
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanOtp = otp.toString().trim();

      const pending = await Otp.findOne({ email: cleanEmail });
      if (!pending) {
        return res.status(400).json({ message: 'Verification code has expired or is invalid.' });
      }

      if (pending.otp !== cleanOtp) {
        return res.status(400).json({ message: 'Invalid 6-digit verification code.' });
      }

      const user = new User({
        email: cleanEmail,
        username: pending.username,
        password: pending.password,
        isVerified: true,
      });
      await user.save();
      await Otp.deleteOne({ _id: pending._id });

      const token = generateToken(user);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          storageUsedBytes: user.storageUsedBytes,
        },
      });
    }

    // If otp is not provided, trigger OTP send
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Email, username, and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or username already exists.' });
    }

    const newOtp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.findOneAndUpdate(
      { email: cleanEmail },
      {
        email: cleanEmail,
        username: cleanUsername,
        password,
        otp: newOtp,
        expiresAt,
      },
      { upsert: true, new: true }
    );

    const emailRes = await sendOtpEmail(cleanEmail, newOtp, cleanUsername);

    return res.status(200).json({
      requiresOtp: true,
      message: 'Verification code sent to your email.',
      email: cleanEmail,
      simulated: !!emailRes.simulated,
      ...(emailRes.simulated ? { otpPreview: newOtp } : {}),
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password.' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.isVerified === false) {
      return res.status(403).json({
        message: 'Your email address is not verified. Please verify your email before signing in.',
        unverified: true,
        email: user.email,
      });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        storageUsedBytes: user.storageUsedBytes,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ message: 'Server error checking session.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Signed out successfully' });
});

module.exports = router;
