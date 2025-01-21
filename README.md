# Website Crawler (crawlit)

A super simple tool that crawls your website and finds all the internal links. It saves them to a CSV file on your desktop.

## What does it do?

- Finds all the links on your website
- Creates a CSV file with all the URLs and where they end up (useful for finding redirects)
- Saves everything neatly to your desktop
- Won't crash your website by crawling too fast

## Install it

1. Make sure you have [Node.js](https://nodejs.org/) installed (if you don't, just download it from their website and install it)

2. Open your terminal:
   - Windows: Press Windows key, type "cmd", hit Enter
   - Mac: Press Cmd + Space, type "terminal", hit Enter
   - Linux: You know how to open a terminal 😉

3. Copy and paste these commands:
   ```bash
   git clone https://github.com/RiWebuk/crawlit.git
   cd crawlit
   npm install -g .
   ```

That's it! You're ready to go!

## Use it

Super simple:
```bash
crawlit https://yourwebsite.com
```

Just replace `yourwebsite.com` with your actual website address. The tool will:
1. Start crawling your site
2. Show you its progress
3. Save a `crawled-urls.csv` file to your desktop when it's done

## Options (if you want to get fancy)

Want to tweak things? Here are some options you can add:

```bash
# Crawl faster (be careful!)
crawlit https://yourwebsite.com -c 5 -d 500

# Save the file somewhere else
crawlit https://yourwebsite.com -o /path/to/my/file.csv

# See what's happening under the hood
crawlit https://yourwebsite.com --debug

# Get help
crawlit --help
```

What the options mean:
- `-c` or `--concurrency`: How many pages to crawl at once (default: 5)
- `-d` or `--delay`: Milliseconds to wait between requests (default: 1000)
- `-o` or `--output`: Where to save the CSV file (default: your desktop)
- `--debug`: Show detailed information about what's happening
- `-t` or `--timeout`: How long to wait for each page (default: 10 seconds)

## The CSV file

The tool creates a CSV file with two columns:
1. Source URL: The link it found
2. Final URL: Where that link actually goes (useful for finding redirects)

You can open this file in:
- Excel
- Google Sheets
- Any text editor
- Whatever you like!

## Troubleshooting

If something goes wrong:

1. **It's stuck**: Press Ctrl+C and try again with a longer delay
   ```bash
   crawlit https://yourwebsite.com -d 2000
   ```

2. **It's too slow**: Try increasing concurrent connections
   ```bash
   crawlit https://yourwebsite.com -c 5
   ```

3. **It's missing pages**: Run it in debug mode to see what's happening
   ```bash
   crawlit https://yourwebsite.com --debug
   ```

4. **Other problems**: Just run it with `--debug` and see what's going on!

## Important Notes

- Don't set the concurrency too high or you might overload your website
- Some websites might block you if you crawl too fast
- It only crawls internal links (links to your own website)
- It skips things like images, PDFs, etc.

## Need Help?

If you're stuck:
1. Run the command with `--debug`
2. Copy any error messages
3. File an issue on GitHub with the error message and what you were trying to do