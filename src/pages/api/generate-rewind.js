import GET_TRAILBLAZER_RANK from '../../graphql/queries/getTrailblazerRank';
import GET_USER_CERTIFICATIONS from '../../graphql/queries/getUserCertifications';
import GET_STAMPS from '../../graphql/queries/getStamps';
import SupabaseUtils from '../../utils/supabaseUtils';
import GraphQLUtils from '../../utils/graphqlUtils';
import { generateRewind } from '../../utils/generateRewind';

// Input validation helper
function validateInput(username, year) {
  const errors = [];

  if (!username) {
    errors.push('Username is required');
  } else if (typeof username !== 'string') {
    errors.push('Username must be a string');
  } else if (username.length < 4) {
    errors.push('Username must be at least 4 characters long');
  } else if (username.length > 64) {
    errors.push('Username is too long (max 64 characters)');
  } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    errors.push('Username contains invalid characters');
  }

  if (year && (typeof year !== 'number' || year < 2020 || year > new Date().getFullYear() + 1)) {
    errors.push('Invalid year provided');
  }

  return errors;
}

// Sanitize username input
function sanitizeUsername(username) {
  return username?.toString().trim().toLowerCase().substring(0, 64);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported',
    });
  }

  const start_time = new Date().getTime();
  const { username: rawUsername, year = 2025 } = req.body;

  // Sanitize and validate input
  const username = sanitizeUsername(rawUsername);
  const validationErrors = validateInput(username, year);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Invalid input',
      details: validationErrors,
    });
  }

  const graphqlQueries = [
    {
      query: GET_TRAILBLAZER_RANK,
      variables: {
        slug: username,
        hasSlug: true,
      },
      url: 'https://profile.api.trailhead.com/graphql',
    },
    {
      query: GET_USER_CERTIFICATIONS,
      variables: {
        slug: username,
        hasSlug: true,
        count: 100,
      },
      url: 'https://profile.api.trailhead.com/graphql',
    },
    {
      query: GET_STAMPS,
      variables: {
        slug: username,
        first: 50, // Increased to get more stamps for yearly analysis
      },
      url: 'https://mobile.api.trailhead.com/graphql',
    },
  ];

  try {
    // Perform the GraphQL queries in parallel using the utils class
    const [rankResponse, certificationsResponse, stampsResponse] = await GraphQLUtils.performQueries(graphqlQueries);

    // Validate GraphQL responses
    if (!rankResponse?.data?.data?.profile) {
      return res.status(404).json({
        error: 'User not found',
        message: `No Trailhead profile found for username: ${username}`,
      });
    }

    // Extract the data from the responses with validation
    const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
    const certificationsData = certificationsResponse.data?.data?.profile?.credential || {};
    const stampsData = stampsResponse.data?.data?.earnedStamps || {};

    // Validate essential data is present
    if (!rankData.rank && !certificationsData.certifications && !stampsData.edges) {
      return res.status(422).json({
        error: 'Insufficient data',
        message: 'Unable to find sufficient Trailhead data to generate a rewind',
      });
    }

    // Generate the rewind image with all processing handled in the utility
    const generateRewindResult = await generateRewind({
      username,
      year,
      rankData,
      certificationsData,
      stampsData,
    });

    // Validate rewind generation result
    if (!generateRewindResult?.imageUrl) {
      return res.status(500).json({
        error: 'Image generation failed',
        message: 'Failed to generate rewind image',
        warnings: generateRewindResult?.warnings || [],
      });
    }

    const imageUrl = generateRewindResult.imageUrl;
    const warnings = generateRewindResult.warnings || [];
    const rewindSummary = generateRewindResult.rewindSummary;
    const yearlyData = generateRewindResult.yearlyData;

    // Update the rewind counter in the database (non-blocking)
    const rewind_data = {
      th_username: username,
      rewind_processing_time: new Date().getTime() - start_time,
      year,
      rankData,
      yearlyData,
      rewindSummary,
    };
    SupabaseUtils.updateRewindCounter(rewind_data).catch((error) => {
      console.error('Error updating rewind counter:', error.message);
    });

    // Send back the rewind data and image URL
    res.status(200).json({
      imageUrl,
      warnings,
      rewindSummary,
      yearlyData,
      year,
      username,
    });
  } catch (error) {
    console.error('Error generating rewind:', {
      message: error.message,
      stack: error.stack,
      username,
      year,
    });

    // Handle specific error types
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to connect to Trailhead services. Please try again later.',
      });
    }

    if (error.response) {
      const status = error.response.status;
      console.error('Response data:', error.response.data);
      console.error('Response status:', status);

      if (status === 404) {
        return res.status(404).json({
          error: 'User not found',
          message: `No Trailhead profile found for username: ${username}`,
        });
      } else if (status === 429) {
        return res.status(429).json({
          error: 'Rate limited',
          message: 'Too many requests. Please wait a moment and try again.',
        });
      } else if (status >= 500) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Trailhead services are currently unavailable. Please try again later.',
        });
      } else {
        return res.status(500).json({
          error: 'External service error',
          message: `Failed to fetch data from Trailhead (Status: ${status})`,
        });
      }
    } else if (error.request) {
      console.error('Request failed:', error.request);
      return res.status(503).json({
        error: 'Network error',
        message: 'Unable to connect to external services. Please check your connection and try again.',
      });
    } else {
      return res.status(500).json({
        error: 'Internal error',
        message: 'An unexpected error occurred while generating your rewind.',
      });
    }
  }
}
