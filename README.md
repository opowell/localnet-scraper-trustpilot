# Trustpilot scraper for Localnet

Reads `trustpilot.com` pages for Localnet, a browser extension that is a personal search engine.
Localnet pulls it from here the first time it scrapes such a page, through the
[localnet-scrapers](https://github.com/opowell/localnet-scrapers) scraper source.

- `source.json`: what Localnet reads to know the scraper: its name, the URLs it reads, how the site is searched, and the file to run.
- `trustpilot.js`: the parser. It is injected into the scraped page after Localnet's DOM helpers (content-scripts/utils/dom.js) and defines `window.__dynamicParser`.
- `trustpilot.test.ts`: its unit tests, run from a Localnet checkout (`pnpm parsers pull`, then `pnpm test parsers/localnet-scraper-trustpilot`).
- `saved-pages/` (not in git): real pages saved from the site, which Localnet's `e2e/saved-pages.test.ts` scrapes. See Localnet's README.
  Trustpilot answers a plain request with its bot check, so pages are saved from a browser (`pnpm saved-pages snippet`).

## What it reads

The scraper reads what Trustpilot's server writes for its app (Next.js's `__NEXT_DATA__`), not its markup.

- A business's page of reviews (`/review/www.amazon.com`, `?page=2` for the next twenty) reads as its name, on its
  first page Trustpilot's summary of its reviews, and each review on the page, newest first. A review is headed as a
  comment is (its reviewer, the reviewer's page, its likes, when it was posted and its own page,
  `/reviews/6af963964969fd0fcee1b124`), then its stars and title (`"★☆☆☆☆ Amazon Prime is a JOKE"`) and its text, a
  block per paragraph; the business's reply follows as a reply to it. Its details are its TrustScore, how many reviews
  it has, its categories and its website. It links with weight 0.5 to its website, with 1 to the page of the reviews
  after these, so a search can read further back, with 0.2 to each reviewer's page, and with `0.3 / (1 + rank / 10)` to
  the businesses Trustpilot calls similar.
- A review's own page (`/reviews/…`) reads as its title and the review, linking with weight 1 to the business's page
  of reviews. Its details are its rating and the business.
- Any other page (a search, `/search?query=pizza`, a category, a reviewer's page) is a listing of the businesses'
  review pages it links to.
- A page that is Trustpilot's bot check ("Verifying Connection") says the scrape was blocked.
