#!/usr/bin/env node

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { promises as fs } from 'fs';
import PQueue from 'p-queue';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import os from 'os';
import path from 'path';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <url> [options]')
  .option('c', {
    alias: 'concurrency',
    describe: 'Number of concurrent connections',
    type: 'number',
    default: 3
  })
  .option('d', {
    alias: 'delay',
    describe: 'Delay between requests in milliseconds',
    type: 'number',
    default: 1000
  })
  .option('o', {
    alias: 'output',
    describe: 'Output CSV filename',
    type: 'string',
    default: path.join(os.homedir(), 'Desktop', 'crawled-urls.csv')
  })
  .option('debug', {
    describe: 'Enable debug logging',
    type: 'boolean',
    default: false
  })
  .option('t', {
    alias: 'timeout',
    describe: 'Request timeout in milliseconds',
    type: 'number',
    default: 10000
  })
  .demandCommand(1, 'Please provide a URL to crawl')
  .help('h')
  .alias('h', 'help')
  .parse();

class WebsiteCrawler {
  constructor(baseUrl, options = {}) {
    this.baseUrl = new URL(baseUrl);
    this.visited = new Set();
    this.pending = new Set();
    this.queue = new PQueue({
      concurrency: options.concurrency || 5,
      timeout: options.timeout || 10000,
      throwOnTimeout: true
    });
    this.rateLimitMs = options.rateLimitMs || 1000;
    this.outputFile = options.outputFile || 'crawled-urls.csv';
    this.urlMap = new Map();
    this.debug = options.debug || false;
    this.timeout = options.timeout || 10000;
    this.startTime = Date.now();

    // Setup queue event listeners
    this.queue.on('completed', (result) => {
      this.log('Task completed');
    });

    this.queue.on('error', (error) => {
      this.logError(`Queue error: ${error.message}`);
    });

    this.queue.on('timeout', (next) => {
      this.logError('Task timed out');
      next();
    });
  }

  log(message) {
    if (this.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  logError(message) {
    console.error(`[ERROR] ${message}`);
  }

  isInternalUrl(urlStr) {
    try {
      const url = new URL(urlStr, this.baseUrl);
      return url.hostname === this.baseUrl.hostname;
    } catch (error) {
      return false;
    }
  }

  normalizeUrl(url) {
    return url.split('#')[0].replace(/\/$/, '');
  }

  async fetchWithTimeout(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await axios.get(url, {
        signal: controller.signal,
        maxRedirects: 5,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrawlitBot/1.0;)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
        throw new Error(`Timeout fetching ${url}`);
      }
      throw error;
    }
  }

  async fetchUrl(url) {
    try {
      this.log(`Fetching: ${url}`);
      const response = await this.fetchWithTimeout(url);

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('html')) {
        this.log(`Skipping non-HTML: ${url} (${contentType})`);
        return null;
      }

      this.urlMap.set(url, response.request.res.responseUrl);
      return response.data;
    } catch (error) {
      this.logError(`Fetch error for ${url}: ${error.message}`);
      return null;
    }
  }

  extractLinks(html, baseUrl) {
    const links = new Set();
    try {
      const $ = cheerio.load(html);

      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, baseUrl).toString();
            if (this.isInternalUrl(absoluteUrl)) {
              const normalizedUrl = this.normalizeUrl(absoluteUrl);
              links.add(normalizedUrl);
              this.log(`Found link: ${normalizedUrl}`);
            }
          } catch (error) {
            // Skip invalid URLs
          }
        }
      });
    } catch (error) {
      this.logError(`Parse error for ${baseUrl}: ${error.message}`);
    }

    return Array.from(links);
  }

  async processUrl(url) {
    if (this.visited.has(url) || this.pending.has(url)) {
      return;
    }

    this.pending.add(url);

    try {
      const html = await this.fetchUrl(url);
      this.visited.add(url);

      if (html) {
        const links = this.extractLinks(html, url);

        for (const link of links) {
          if (!this.visited.has(link) && !this.pending.has(link)) {
            await new Promise(resolve => setTimeout(resolve, this.rateLimitMs));
            this.queue.add(() => this.processUrl(link))
              .catch(error => {
                this.logError(`Failed to process ${link}: ${error.message}`);
              });
          }
        }
      }
    } catch (error) {
      this.logError(`Process error for ${url}: ${error.message}`);
    } finally {
      this.pending.delete(url);
    }
  }

  printProgress() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const urlsPerSecond = this.urlMap.size / elapsed;
    console.log('\nProgress Update:');
    console.log(`URLs found: ${this.urlMap.size}`);
    console.log(`URLs visited: ${this.visited.size}`);
    console.log(`URLs pending: ${this.pending.size}`);
    console.log(`Queue size: ${this.queue.size}`);
    console.log(`Queue pending: ${this.queue.pending}`);
    console.log(`Time elapsed: ${elapsed}s`);
    console.log(`Rate: ${urlsPerSecond.toFixed(2)} URLs/s\n`);
  }

  async crawl() {
    console.log(`Starting crawl of ${this.baseUrl.toString()}`);

    const progressInterval = setInterval(() => {
      this.printProgress();
    }, 5000);

    try {
      await this.processUrl(this.baseUrl.toString());

      // Wait for the queue to be empty and no pending tasks
      while (this.queue.size > 0 || this.queue.pending > 0 || this.pending.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      clearInterval(progressInterval);
      await this.generateCsv();
      this.printProgress();
      console.log('Crawl completed!');
    }
  }

  async generateCsv() {
    try {
      const csvRows = ['Source URL,Final URL'];
      for (const [sourceUrl, finalUrl] of this.urlMap) {
        csvRows.push(`${sourceUrl},${finalUrl}`);
      }
      await fs.writeFile(this.outputFile, csvRows.join('\n'));
      console.log(`CSV file generated: ${this.outputFile}`);
    } catch (error) {
      this.logError(`CSV generation error: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const url = argv._[0];

  const crawler = new WebsiteCrawler(url, {
    concurrency: argv.concurrency,
    rateLimitMs: argv.delay,
    outputFile: argv.output,
    debug: argv.debug,
    timeout: argv.timeout
  });

  await crawler.crawl();
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});