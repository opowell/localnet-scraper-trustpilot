import { afterEach, describe, expect, it } from 'vitest'
import { parserLoader, resetPage, visit } from '#scraper-test'

// The parser, evaluated with the helpers it is injected with, as a scrape runs it.
const load = parserLoader(__dirname)

afterEach(resetPage)

// A page whose server wrote these props for its app.
function nextData(props: object) {
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: props } })}</script>`
}

const review = {
  id: 'abc123',
  rating: 2,
  title: 'Late again',
  text: 'First paragraph.\n\nSecond paragraph.',
  likes: 3,
  dates: { publishedDate: '2026-11-13T10:00:00.000Z' },
  consumer: { displayName: 'Gwyneth', id: 'u1' },
  reply: { message: 'Dear Gwyneth,\n\nSorry.', publishedDate: '2026-11-13T14:41:06.000Z' },
}

describe('trustpilot', () => {
  it('reads a business\'s reviews, each with its stars and the business\'s reply, and links to the next page', () => {
    const { parseTrustpilot } = load('trustpilot.js', ['parseTrustpilot'])
    visit('https://www.trustpilot.com/review/www.hellofresh.co.uk', nextData({
      businessUnit: { displayName: 'HelloFresh UK', identifyingName: 'www.hellofresh.co.uk', trustScore: 4.3, numberOfReviews: 1200, websiteUrl: 'https://www.hellofresh.co.uk', categories: [{ name: 'Meal Kit' }] },
      reviews: [review],
      filters: { pagination: { currentPage: 1, totalPages: 60 } },
      aiSummary: { summary: 'Most liked it.' },
      similarBusinessUnits: [{ businessUnitIdentifyingName: 'gousto.co.uk' }],
    }))
    const parsed = parseTrustpilot()
    expect(parsed.title).toBe('HelloFresh UK')
    expect(parsed.content).toEqual([
      '## Review summary',
      'Most liked it.',
      '<comment depth="0" author="Gwyneth" author-url="https://www.trustpilot.com/users/u1" score="3" time="2026-11-13T10:00:00.000Z" url="https://www.trustpilot.com/reviews/abc123">',
      '★★☆☆☆ Late again',
      'First paragraph.',
      'Second paragraph.',
      '<comment depth="1" author="HelloFresh UK" time="2026-11-13T14:41:06.000Z">',
      'Dear Gwyneth,',
      'Sorry.',
    ])
    expect(parsed.links).toEqual([
      { url: 'https://www.hellofresh.co.uk', title: 'HelloFresh UK', score: 0.5 },
      { url: 'https://www.trustpilot.com/review/www.hellofresh.co.uk?page=2', score: 1 },
      { url: 'https://www.trustpilot.com/users/u1', score: 0.2 },
      { url: 'https://www.trustpilot.com/review/gousto.co.uk', score: 0.3 },
    ])
    expect(Object.fromEntries(parsed.details)).toMatchObject({ trustscore: 4.3, reviews: 1200, categories: ['Meal Kit'] })
  })

  it('reads a review\'s own page, linking to its business', () => {
    const { parseTrustpilot } = load('trustpilot.js', ['parseTrustpilot'])
    visit('https://www.trustpilot.com/reviews/abc123', nextData({ review: { ...review, reply: null }, business: { displayName: 'HelloFresh UK', identifyingName: 'www.hellofresh.co.uk' } }))
    const parsed = parseTrustpilot()
    expect(parsed.title).toBe('Late again')
    expect(parsed.content).toHaveLength(4)
    expect(parsed.links).toEqual([{ url: 'https://www.trustpilot.com/review/www.hellofresh.co.uk', title: 'HelloFresh UK', score: 1 }])
  })

  it('reads a search as a listing of the businesses it finds', () => {
    const { parseTrustpilot } = load('trustpilot.js', ['parseTrustpilot'])
    visit('https://www.trustpilot.com/search?query=pizza', '<main><a href="/review/www.pizzahut.com?utm=1">Pizza Hut</a><a href="/review/www.pizzahut.com/location">x</a></main>')
    expect(parseTrustpilot()).toEqual({ listing: true, links: [{ url: 'https://www.trustpilot.com/review/www.pizzahut.com', score: 1 }] })
  })
})
