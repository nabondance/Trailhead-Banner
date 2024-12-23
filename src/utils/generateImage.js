import { createCanvas } from 'canvas';

export const generateImage = (rankData, certificationsData) => {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Rank Data
  ctx.fillStyle = '#000';
  ctx.font = '30px Arial';
  ctx.fillText(`Rank: ${rankData.title}`, 50, 50);
  ctx.fillText(`Points: ${rankData.requiredPointsSum}`, 50, 100);
  ctx.fillText(`Badges: ${rankData.requiredBadgesCount}`, 50, 150);

  // Certifications Data
  ctx.fillText(`Certifications:`, 50, 200);
  certificationsData.certifications.forEach((cert, index) => {
    ctx.fillText(`${cert.title}`, 50, 250 + index * 30);
  });

  // Convert canvas to image
  const buffer = canvas.toBuffer('image/png');
  const imageUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  return imageUrl;
};