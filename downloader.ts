import puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum Platform {
  Instagram = 'instagram',
  TikTok = 'tiktok',
  Twitter = 'twitter',
  Facebook = 'facebook',
}

export interface DownloadResult {
  filePath: string;
  platform: Platform;
}

export async function downloadMediaFromUrl(url: string, userId: string): Promise<DownloadResult> {
  const platform = identifyPlatform(url);
  if (!platform) {
    throw new Error('Unsupported platform or invalid URL');
  }

  const fileExtension = platform === Platform.Instagram ? 'jpg' : 'mp4'; // Instagram often images, others videos
  const fileName = `media_${userId}_${Date.now()}.${fileExtension}`;
  const filePath = path.join(__dirname, '../downloads', fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  try {
    let mediaUrl: string;

    switch (platform) {
      case Platform.Instagram:
        mediaUrl = await downloadFromInstagram(url);
        break;
      case Platform.TikTok:
        mediaUrl = await downloadFromTikTok(url);
        break;
      case Platform.Twitter:
        mediaUrl = await downloadFromTwitter(url);
        break;
      case Platform.Facebook:
        mediaUrl = await downloadFromFacebook(url);
        break;
      default:
        throw new Error('Platform not supported');
    }

    // Download the media
    const response = await axios({
      url: mediaUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000, // 30s timeout
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Store metadata in database
    await prisma.download.create({
      data: {
        userId,
        platform,
        url,
        filePath,
      },
    });

    return { filePath, platform };
  } catch (error) {
    throw new Error(`Failed to download media from ${platform}: ${error.message}`);
  }
}

function identifyPlatform(url: string): Platform | null {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes('instagram.com')) return Platform.Instagram;
  if (normalizedUrl.includes('tiktok.com')) return Platform.TikTok;
  if (normalizedUrl.includes('twitter.com') || normalizedUrl.includes('x.com')) return Platform.Twitter;
  if (normalizedUrl.includes('facebook.com')) return Platform.Facebook;
  return null;
}

async function downloadFromInstagram(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector('video[src]');
      const image = document.querySelector('img[src*="media"]');
      return video ? video.src : image ? image.src : '';
    });

    if (!mediaUrl) {
      throw new Error('No media found in Instagram post');
    }

    return mediaUrl;
  } finally {
    await browser.close();
  }
}

async function downloadFromTikTok(url: string): Promise<string> {
  // Using SnapTik API (example endpoint, replace with real API key or service)
  // Note: You need to sign up for a service like SnapTik or similar
  try {
    const response = await axios.post(
      'https://snaptik.app/api/v1/download',
      { url },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SNAPTIK_API_KEY || 'your-snaptik-api-key'}`,
        },
        timeout: 30000,
      }
    );

    const mediaUrl = response.data?.video?.no_watermark || response.data?.video?.url;
    if (!mediaUrl) {
      throw new Error('No media URL returned from TikTok API');
    }
    return mediaUrl;
  } catch (error) {
    throw new Error(`TikTok download failed: ${error.message}`);
  }
}

async function downloadFromTwitter(url: string): Promise<string> {
  // Twitter API v2 (requires bearer token)
  try {
    const tweetId = url.split('/').pop()?.split('?')[0];
    if (!tweetId) {
      throw new Error('Invalid Twitter URL');
    }

    const response = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}`, {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_API_KEY || 'your-twitter-api-key'}`,
      },
      params: {
        'expansions': 'attachments.media_keys',
        'media.fields': 'url',
      },
      timeout: 30000,
    });

    const media = response.data.includes?.media?.[0]?.url;
    if (!media) {
      throw new Error('No media found in Twitter post');
    }
    return media;
  } catch (error) {
    throw new Error(`Twitter download failed: ${error.message}`);
  }
}

async function downloadFromFacebook(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector('video[src]');
      return video ? video.src : '';
    });

    if (!mediaUrl) {
      throw new Error('No video found in Facebook post');
    }
    return mediaUrl;
  } finally {
    await browser.close();
  }
}




// import { downloadMediaFromUrl } from '../services/downloaderService';

// export async function downloadMedia(req: Request, res: Response) {
//   try {
//     const { url } = req.body;
//     const userId = req.user.userId; // Assuming JWT middleware
//     const { filePath } = await downloadMediaFromUrl(url, userId);
//     const fileUrl = `http://localhost:3000/downloads/${path.basename(filePath)}`;
//     res.status(200).json({ success: true, fileUrl });
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message });
//   }
// }



// app.use('/downloads', express.static(path.join(__dirname, '../downloads')));


// // Testing
// Instagram: Use a public post URL (e.g., https://www.instagram.com/p/abc123/). The service scrapes the image or video URL.
//     TikTok: Use a public video URL (e.g., https://www.tiktok.com/@user/video/123456789). Requires a valid SnapTik API key.
//     Twitter (X): Use a tweet URL with media (e.g., https://x.com/user/status/123456789). Requires a Twitter API key.
//     Facebook: Use a public video post URL (e.g., https://www.facebook.com/user/videos/123456789). Scrapes video URL.






// Notes
// Instagram:
// Works for public posts. Private posts require user login (not implemented).
// DOM selectors may break if Instagram updates its frontend; check puppeteer code periodically.
// TikTok:
// Relies on a third-party API (SnapTik). Sign up for a service or replace with another (e.g., ssstik.io).
// Some videos may be region-locked or private.
// Twitter (X):
// Requires a valid Twitter API v2 bearer token. Get it from developer.x.com.
// Only works for tweets with media attachments.
// Facebook:
// Limited to public video posts. Images or private posts may fail.
// Update puppeteer selectors if Facebook's DOM changes.
// Error Handling:
// Includes timeouts and basic error catching.
// Add retry logic or proxies for robustness in production.
// Storage:
// Files save to downloads/. Use a cleanup script to remove old files.
// For production, integrate AWS S3 or similar.
// Performance:
// puppeteer is resource-intensive. Use a headless browser pool or limit concurrent requests.
// Add rate limiting to prevent abuse.
// Troubleshooting
// Puppeteer Errors: Ensure puppeteer dependencies are installed (e.g., Chromium). Run npm install puppeteer again if issues occur.
// API Failures: Verify API keys for TikTok and Twitter. Check rate limits or quotas.
// Media Not Found: Ensure URLs point to public posts with media. Private or invalid URLs will fail.
// File Download Issues: Check downloads/ folder permissions and ensure axios streams complete.