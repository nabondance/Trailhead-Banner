"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import TrailheadBanner from './TrailheadBanner';

const Page = () => {
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [rankData, setRankData] = useState(null);
  const [certificationsData, setCertificationsData] = useState(null);

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
    setRankData(data.rankData);
    setCertificationsData(data.certificationsData);
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
        <button type="submit">Generate Image</button>
      </form>
      {rankData && (
        <div>
          <h2>Rank Data</h2>
          <pre>{JSON.stringify(rankData, null, 2)}</pre>
        </div>
      )}
      {certificationsData && (
        <div>
          <h2>Certifications Data</h2>
          <pre>{JSON.stringify(certificationsData, null, 2)}</pre>
        </div>
      )}
      <SpeedInsights />
      <Analytics />
    </div>
  );
};

export default Page;