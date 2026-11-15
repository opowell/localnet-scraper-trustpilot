// What the page's server wrote for its app (Next.js's __NEXT_DATA__): its props, or {} if it wrote none.
function trustpilotData() {
  try {
    return JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}').props?.pageProps || {}
  } catch {
    return {}
  }
}

// A review as content blocks: a comment's head (its reviewer, the reviewer's page, its likes, when it was posted and its
// own page), its stars and title ("★☆☆☆☆ Amazon 😡 STOP"), its text a block per paragraph, then the business's reply
// as a reply to it.
function trustpilotReview(review, business) {
  const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(Math.max(0, 5 - (review.rating || 0)))
  const consumer = review.consumer || {}
  const blocks = [
    commentBlock({
      author: consumer.displayName,
      authorUrl: consumer.id ? `${location.origin}/users/${consumer.id}` : undefined,
      score: review.likes || undefined,
      time: isoTime(review.dates?.publishedDate),
      url: `${location.origin}/reviews/${review.id}`,
    }),
    `${stars}${review.title ? ` ${review.title}` : ''}`,
    ...String(review.text || '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean),
  ]
  if (review.reply?.message) {
    blocks.push(
      commentBlock({ depth: 1, author: business?.displayName, time: isoTime(review.reply.publishedDate) }),
      ...review.reply.message.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean),
    )
  }
  return blocks
}

// A business's page of reviews (/review/www.amazon.com, ?page=2 for the next twenty) reads as its name, Trustpilot's
// summary of its reviews and each review on the page (see trustpilotReview), newest first. Its details are its
// TrustScore, how many reviews it has, its categories and its website. It links with weight 0.5 to its website, with 1
// to the page of the reviews after these, so a search can read further, with 0.2 to each reviewer's page, and with
// 0.3 / (1 + rank / 10) to the businesses Trustpilot calls similar.
function trustpilotBusiness(data) {
  const business = data.businessUnit
  const reviews = data.reviews || []
  const pagination = data.filters?.pagination || {}
  const next = pagination.currentPage < pagination.totalPages
    ? `${location.origin}/review/${business.identifyingName}?page=${pagination.currentPage + 1}`
    : null
  const summary = data.aiSummary?.summary
  const reviewers = new Set(reviews.map(review => review.consumer?.id).filter(Boolean))
  const similar = (data.similarBusinessUnits || []).map(unit => unit.businessUnitIdentifyingName).filter(Boolean)
  return {
    title: business.displayName,
    content: [
      ...(summary && pagination.currentPage <= 1 ? ['## Review summary', summary] : []),
      ...reviews.flatMap(review => trustpilotReview(review, business)),
    ],
    links: [
      ...(business.websiteUrl ? [{ url: business.websiteUrl, title: business.websiteTitle || business.displayName, score: 0.5 }] : []),
      ...(next ? [{ url: next, score: 1 }] : []),
      ...Array.from(reviewers, id => ({ url: `${location.origin}/users/${id}`, score: 0.2 })),
      ...similar.map((name, rank) => ({ url: `${location.origin}/review/${name}`, score: 0.3 / (1 + rank / 10) })),
    ],
    details: [
      ['trustscore', business.trustScore ?? null],
      ['reviews', business.numberOfReviews ?? null],
      ['categories', (business.categories || []).map(category => category.name || category.displayName).filter(Boolean)],
      ['website', business.websiteUrl ? { text: business.websiteTitle || business.identifyingName, url: business.websiteUrl } : null],
    ],
  }
}

// A review's own page (/reviews/6af963964969fd0fcee1b124) reads as its title and the review, linking with weight 1 to
// the business's page of reviews. Its details are its rating and the business.
function trustpilotSingleReview(data) {
  const { review, business = {} } = data
  const name = business.displayName || business.identifyingName
  const page = business.identifyingName ? `${location.origin}/review/${business.identifyingName}` : null
  return {
    title: review.title || document.title,
    content: trustpilotReview(review, business),
    links: page ? [{ url: page, title: name, score: 1 }] : [],
    details: [
      ['rating', review.rating ?? null],
      ['business', page ? { text: name, url: page } : null],
    ],
  }
}

// A page of Trustpilot: a business's reviews or a single review (see each), from the data its server writes for its
// app; any other page (a search, /search?query=…, a category, /categories/…, a reviewer's page) is a listing of the
// businesses' review pages it links to. Trustpilot's bot check says the scrape was blocked.
function parseTrustpilot(_profileId) {
  if (!/(?:^|\.)trustpilot\.com$/.test(location.hostname)) {
    return null
  }
  const data = trustpilotData()
  if (!document.getElementById('__NEXT_DATA__') && /Verifying Connection|Just a moment/i.test(document.title)) {
    return { content: [], blocked: 'Trustpilot\'s bot check' }
  }
  if (/^\/review\/[^/]+\/?$/.test(location.pathname) && data.businessUnit) {
    return trustpilotBusiness(data)
  }
  if (/^\/reviews\/[\da-f]+\/?$/.test(location.pathname) && data.review) {
    return trustpilotSingleReview(data)
  }
  const pages = linkUrls('main a[href*="/review/"]').map(url => url.split(/[?#]/)[0])
    .filter(url => /\/review\/[^/]+$/.test(url))
  return listingOf(pages) ?? { listing: true }
}

// The parser a scrape calls.
registerParser(parseTrustpilot)
