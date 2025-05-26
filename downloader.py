import os
import re
import instaloader
import requests
from facebook_scraper import get_posts
from pytiktokapi import TikTokAPI
import tweepy
from urllib.parse import urlparse
from pathlib import Path

# Ensure output directory exists
OUTPUT_DIR = "downloaded_media"
Path(OUTPUT_DIR).mkdir(exist_ok=True)

def download_instagram(url, username=None, password=None):
    """Download images or videos from an Instagram post."""
    try:
        # Initialize Instaloader
        L = instaloader.Instaloader(download_pictures=True, download_videos=True, download_comments=False)
        
        # Log in if credentials are provided
        if username and password:
            L.login(username, password)
        
        # Extract shortcode from URL
        shortcode = url.split("/")[-2] if url.endswith("/") else url.split("/")[-1]
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        # Download post content
        target_path = os.path.join(OUTPUT_DIR, shortcode)
        L.download_post(post, target=target_path)
        print(f"Downloaded Instagram post {shortcode} to {target_path}")
    except Exception as e:
        print(f"Error downloading from Instagram: {e}")

def download_tiktok(url):
    """Download video from a TikTok post."""
    try:
        # Initialize TikTokAPI (Note: Requires configuration, may need cookies or API key)
        api = TikTokAPI()
        video_data = api.get_video_by_url(url)
        
        # Download video
        video_url = video_data.get('video', {}).get('downloadAddr')
        if video_url:
            response = requests.get(video_url, stream=True)
            video_id = urlparse(url).path.split("/")[-1]
            file_path = os.path.join(OUTPUT_DIR, f"tiktok_{video_id}.mp4")
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Downloaded TikTok video to {file_path}")
        else:
            print("No video URL found for TikTok post")
    except Exception as e:
        print(f"Error downloading from TikTok: {e}")

def download_facebook(url):
    """Download images or videos from a Facebook post."""
    try:
        # Extract post ID from URL (simplified, may need adjustment for different URL formats)
        post_id = urlparse(url).path.split("/")[-1]
        
        # Scrape post data
        for post in get_posts(post_urls=[url], cookies=None):
            if post.get('video'):
                video_url = post['video']
                response = requests.get(video_url, stream=True)
                file_path = os.path.join(OUTPUT_DIR, f"facebook_{post_id}.mp4")
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"Downloaded Facebook video to {file_path}")
            elif post.get('image'):
                image_url = post['image']
                response = requests.get(image_url)
                file_path = os.path.join(OUTPUT_DIR, f"facebook_{post_id}.jpg")
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                print(f"Downloaded Facebook image to {file_path}")
            else:
                print("No media found in Facebook post")
    except Exception as e:
        print(f"Error downloading from Facebook: {e}")

def download_twitter(url):
    """Download images or videos from a Twitter/X post."""
    try:
        # Note: Tweepy requires Twitter API credentials
        # Replace with your own keys or use direct scraping
        consumer_key = "YOUR_CONSUMER_KEY"
        consumer_secret = "YOUR_CONSUMER_SECRET"
        access_token = "YOUR_ACCESS_TOKEN"
        access_token_secret = "YOUR_ACCESS_TOKEN_SECRET"
        
        client = tweepy.Client(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret
        )
        
        # Extract tweet ID from URL
        tweet_id = url.split("/")[-1]
        tweet = client.get_tweet(tweet_id, expansions=["attachments.media_keys"], media_fields=["url", "type"])
        
        media = tweet.includes.get('media', [])
        for item in media:
            media_url = item.url
            media_type = item.type
            file_ext = "mp4" if media_type == "video" else "jpg"
            file_path = os.path.join(OUTPUT_DIR, f"twitter_{tweet_id}.{file_ext}")
            response = requests.get(media_url)
            with open(file_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded Twitter {media_type} to {file_path}")
    except Exception as e:
        print(f"Error downloading from Twitter: {e}")

def main():
    """Main function to process a social media URL."""
    url = input("Enter the social media post URL: ").strip()
    
    # Determine platform based on URL
    if "instagram.com" in url:
        # Instagram may require login for private posts
        username = input("Enter Instagram username (optional, press Enter to skip): ").strip()
        password = input("Enter Instagram password (optional, press Enter to skip): ").strip()
        download_instagram(url, username or None, password or None)
    elif "tiktok.com" in url:
        download_tiktok(url)
    elif "facebook.com" in url:
        download_facebook(url)
    elif "twitter.com" in url or "x.com" in url:
        download_twitter(url)
    else:
        print("Unsupported platform. Please provide a valid Instagram, TikTok, Facebook, or Twitter URL.")

if __name__ == "__main__":
    main()