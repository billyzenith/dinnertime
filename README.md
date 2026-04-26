# Meal Planner

A personal weekly meal planning app with cookbook recipe scanning.

## Pages

- `/` — Meal planner (generates weekly dinners from your recipe database)
- `/scan.html` — Add a recipe by photographing a cookbook page

## Setup

### 1. Push to GitHub
Create a new GitHub repo and push all files in this folder.

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com), sign in with GitHub
2. Click **Add New Project** → import your repo
3. Add these **Environment Variables**:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → Sheets API → Service Accounts → JSON key (paste full JSON) |
| `GOOGLE_SPREADSHEET_ID` | The long ID in your spreadsheet URL |

4. Click **Deploy**

### 3. Share your sheet with the service account
In Google Cloud Console, copy the service account's email address (looks like `name@project.iam.gserviceaccount.com`). Open your Google Sheet → Share → paste the email → give Editor access.

### 4. Use it
- Open your Vercel URL in Chrome and bookmark it
- Use `/scan.html` on mobile to photograph cookbook pages and add them to your database

## Google Sheet structure

Sheet name: `Database`, columns A–L:

| Col | Field |
|---|---|
| A | Recipe Name |
| B | Author |
| C | Type |
| D | Ingredients (comma-separated, no quantities) |
| E | Location (URL or "Book Name p.142") |
| F | Notes |
| G | Cook Time (mins) |
| H | Weekday Safe (Yes/No) |
| I | Season (All/Spring/Summer/Autumn/Winter) |
| J | Contains Eggs (Yes/No) |
| K | Contains Mushrooms (Yes/No) |
| L | Serves |
