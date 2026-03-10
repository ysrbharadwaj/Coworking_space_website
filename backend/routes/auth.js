const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/auth');
const { validate, rules, str } = require('../middleware/validate');
const { OAuth2Client } = require('google-auth-library');
const saltRounds = 10;

// Initialize Google OAuth client
// IMPORTANT: Set GOOGLE_CLIENT_ID in your .env file
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate & sanitise all inputs
    const err = validate(req.body, {
      name:     [rules.required, rules.string, rules.minLen(2), rules.maxLen(100), rules.noScript],
      email:    [rules.required, rules.email, rules.maxLen(255)],
      password: [rules.required, rules.minLen(8), rules.maxLen(128)],
      phone:    [rules.phone],
    });
    if (err) return res.status(400).json({ success: false, error: err });

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword, // Store hashed password
          phone: phone || null,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({ 
      success: true, 
      data: userWithoutPassword,
      message: 'User registered successfully' 
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed. Please try again.' 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const err = validate(req.body, {
      email:    [rules.required, rules.email, rules.maxLen(255)],
      password: [rules.required, rules.maxLen(128)],
    });
    if (err) return res.status(400).json({ success: false, error: err });

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid email or password' 
        });
      }
      throw error;
    }

    // Check password (using bcrypt for secure comparison)
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ 
      success: true, 
      data: userWithoutPassword,
      token,
      message: 'Login successful' 
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed. Please try again.' 
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      throw error;
    }

    res.json({ 
      success: true, 
      data: user 
    });

  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch profile' 
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { userId, name, phone } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, email, phone, created_at')
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      data: user,
      message: 'Profile updated successfully' 
    });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
});

// Verify token – returns current user from token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to verify token' });
  }
});

// Logout – client should discard token; server is stateless
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Google OAuth Sign-In
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Google token is required' 
      });
    }

    // Verify Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid Google token' 
      });
    }

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email not provided by Google' 
      });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    let user;

    if (checkError && checkError.code === 'PGRST116') {
      // User doesn't exist, create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            name: name || email.split('@')[0],
            email: email,
            google_id: googleId,
            profile_picture: picture,
            created_at: new Date().toISOString()
            // No password field for OAuth users
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create user:', insertError);
        throw insertError;
      }

      user = newUser;
    } else if (checkError) {
      throw checkError;
    } else {
      // User exists, update Google ID if not set
      if (!existingUser.google_id) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            google_id: googleId,
            profile_picture: picture 
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update user:', updateError);
          throw updateError;
        }
        user = updatedUser;
      } else {
        user = existingUser;
      }
    }

    // Remove sensitive fields from response
    const { password, google_id, ...userWithoutSensitiveData } = user;

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({ 
      success: true, 
      data: userWithoutSensitiveData,
      token: jwtToken,
      message: 'Google sign-in successful' 
    });

  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Google sign-in failed. Please try again.' 
    });
  }
});

module.exports = router;
