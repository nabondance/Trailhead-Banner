"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import TrailheadBanner from './TrailheadBanner';

const Page = () => {
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleImageSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    console.log('Rank Data:', data.rankData);
    console.log('Certifications Data:', data.certificationsData);
    setImageUrl(data.imageUrl);
  };

  return (
    <div>
      <TrailheadBanner />
      <form onSubmit={handleImageSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter Trailhead username"
          required
        />
        <button type="submit">Generate Banner</button>
      </form>
      {imageUrl && (
        <div>
          <h2>Generated Image</h2>
          <img src={imageUrl} alt="Generated Banner" />
          <a href={imageUrl} download="trailhead-image.png">Download Image</a>
        </div>
      )}
      <SpeedInsights />
      <Analytics />
    </div>
  );
};

export default Page;