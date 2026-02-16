# NARA Image Scraper - Beginner's Guide

This guide will help you run the NARA Image Scraper even if you've never used programming tools before.

---

## What You'll Need

- A computer (Mac, Windows, or Linux)
- An internet connection
- About 10 minutes

---

## Step 1: Download Docker Desktop

Docker is a tool that runs applications in containers (like mini virtual computers). It makes running this project super easy!

### For Mac:
1. Go to: https://www.docker.com/products/docker-desktop/
2. Click **"Download for Mac"**
3. Choose **Apple Chip** if you have M1/M2/M3 Mac, or **Intel Chip** for older Macs
4. Open the downloaded `.dmg` file
5. Drag Docker to your Applications folder
6. Open Docker from Applications
7. Wait for Docker to start (you'll see a whale icon in your menu bar)

### For Windows:
1. Go to: https://www.docker.com/products/docker-desktop/
2. Click **"Download for Windows"**
3. Run the downloaded installer
4. Follow the installation wizard
5. Restart your computer when prompted
6. Open Docker Desktop from the Start menu
7. Wait for Docker to start (you'll see a whale icon in your system tray)

### For Linux:
1. Go to: https://docs.docker.com/desktop/install/linux-install/
2. Follow the instructions for your Linux distribution

---

## Step 2: Download This Project

1. On this project's page, click the green **"Code"** button
2. Click **"Download ZIP"**
3. Find the downloaded ZIP file (usually in your Downloads folder)
4. Unzip it by double-clicking (Mac) or right-click → "Extract All" (Windows)
5. You should now have a folder called `nara-image-scraper` or similar

---

## Step 3: Open Terminal

### On Mac:
1. Press `Cmd + Space` to open Spotlight
2. Type `Terminal` and press Enter
3. A black/white window will open - this is the Terminal

### On Windows:
1. Press `Win + X`
2. Click **"Windows Terminal"** or **"PowerShell"**
3. A blue/black window will open

---

## Step 4: Navigate to the Project Folder

The easiest way:

1. In Terminal/PowerShell, type `cd ` (with a space after it)
2. **Drag and drop** the `nara-image-scraper` folder into the Terminal window
3. The path will be automatically filled in
4. Press **Enter**

It should look something like:
```
cd /Users/yourname/Downloads/nara-image-scraper
```

---

## Step 5: Start the Application

Copy and paste this command into Terminal, then press **Enter**:

```bash
docker-compose up --build
```

**What happens:**
- Docker will download the necessary components (this takes 2-5 minutes the first time)
- You'll see lots of text scrolling - this is normal!
- Wait until you see messages like:
  ```
  frontend-1  | ▲ Next.js 14.x
  frontend-1  | - Local: http://localhost:3000
  backend-1   | * Running on http://0.0.0.0:5001
  ```

---

## Step 6: Open the App

1. Open your web browser (Chrome, Safari, Firefox, etc.)
2. Go to: **http://localhost:3000**
3. You should see the NARA Image Scraper interface!

---

## Step 7: Download Images from the National Archives

1. **Go to the National Archives Catalog**: https://catalog.archives.gov
2. **Find a document** you want to download (search for something interesting!)
3. **Copy the URL** from your browser's address bar
   - It should look like: `https://catalog.archives.gov/id/123456789`
4. **Paste the URL** into the "Catalog URL" field in the app
5. **Set page ranges**:
   - Start Page: The first page you want (e.g., `1`)
   - End Page: The last page you want (e.g., `50`)
   - Click "Add Another Range" if you want multiple sections
6. **Click "Fetch"** to start downloading
7. **Wait** for the progress bars to complete
8. **Download your files**:
   - Click **"Download ZIP"** to get images as a ZIP file
   - Click **"Download PDF"** to get images as a PDF document

---

## Stopping the Application

When you're done:

1. Go back to Terminal
2. Press `Ctrl + C` (hold Control and press C)
3. The application will stop

---

## Starting Again Later

Next time you want to use the app:

1. Open Terminal
2. Navigate to the project folder (Step 4)
3. Run: `docker-compose up`
   - Note: You don't need `--build` after the first time!
4. Open http://localhost:3000

---

## Troubleshooting

### "Docker is not running"
- Make sure Docker Desktop is open and running
- Look for the whale icon in your menu bar (Mac) or system tray (Windows)

### "Port already in use"
- Another application is using port 3000 or 5001
- Close other applications or restart your computer

### "Cannot connect to localhost:3000"
- Wait a bit longer - the app might still be starting
- Make sure you see "Running on" messages in Terminal

### Images not downloading
- Check that the URL is from `catalog.archives.gov`
- Try a smaller page range first (e.g., 1-10)
- Some records might not have downloadable images

### Combined PDF not available
- This requires the `img2pdf` library (should be installed automatically)
- Try downloading individual ZIPs instead

---

## Tips

- **Start small**: Try downloading just 5-10 pages first to make sure it works
- **Be patient**: Large page ranges take time to download
- **Check the logs**: The Terminal shows what's happening behind the scenes

---

## Need More Help?

- Check the main [README.md](README.md) for technical details
- Report issues at: https://github.com/anthropics/claude-code/issues

---

Happy researching! The National Archives has amazing historical documents waiting to be discovered.
