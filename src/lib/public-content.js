export const siteUrl = 'https://adrafteo.com'

export const faqItems = [
  { question: 'What is Adrafteo?', answer: 'Adrafteo is a workspace for independent resellers. Save reusable marketplace listing templates, fill in product details, and track inventory, acquisition costs, sales and profit.' },
  { question: 'How do reusable listing templates work?', answer: 'Write a title and description with placeholders such as [Brand], [Size] or [Condition]. Fill in the values for each item, review the generated text, then copy it to your marketplace.' },
  { question: 'Does Adrafteo publish listings automatically?', answer: 'No. You review and copy your listing text, then paste it into the marketplace yourself. Adrafteo is an independent tool and is not an official integration with Vinted, eBay or Depop.' },
  { question: 'Does Adrafteo use AI to generate adverts?', answer: 'No. Advert generation replaces variables in your own saved templates in your browser. No AI service is needed for this workflow.' },
  { question: 'What inventory information can I track?', answer: 'Track individual items and lots, purchase costs, acquisition shipping, allocated shipment costs, target prices, actual sale values and sale costs. Adrafteo uses these values to calculate profit and ROI.' },
  { question: 'Are my templates and inventory public?', answer: 'No. Saved templates, inventory and reusable variables belong to your authenticated account and are protected by per-user database access policies.' },
  { question: 'Is Adrafteo free?', answer: 'All currently available features are included without payment during the beta. Future plans will be communicated before changes to access or pricing.' },
]

export const articles = {
  '/listing-templates': {
    title: 'Reusable Marketplace Listing Templates',
    description: 'Save title and description templates, fill in bracket variables, and copy consistent listing text for your marketplace workflow.',
    intro: 'Write the repeatable parts once. Use bracket variables for the details that change between products, then review and copy each finished advert.',
    sections: [
      ['A template you can reuse', 'Start with a title such as “[Brand] [Item] — size [Size]” and a description such as “Condition: [Condition]. Measurements: [Measurements]. Please review the photos before buying.” Keep descriptions accurate for the individual item.'],
      ['Fill the details for each product', 'For Brand = Nike, Item = fleece and Size = M, the title becomes “Nike fleece — size M”. Adrafteo asks for your variables and replaces them in the title and description. Reusable cross variables can prefill familiar details.'],
      ['Review, copy and publish yourself', 'Copy the finished title and description to Vinted, eBay, Depop or another marketplace. Adjust the copy and required fields to the platform. Adrafteo does not automatically publish or synchronise your listings.'],
    ],
  },
  '/reseller-inventory': {
    title: 'Inventory Tracking for Independent Resellers',
    description: 'Organise resale items and lots, track acquisition costs and sales, and keep your inventory alongside reusable listing templates.',
    intro: 'Keep items, lots and their costs in the same workspace as your listing templates. See what you own, what you plan to sell and what has sold.',
    sections: [
      ['Track items and lots', 'Record item details, quantities, condition, status and marketplace platforms. Group purchases into lots while keeping individual item records. Stock views exclude kept, in-transit and sold items.'],
      ['Keep acquisition costs together', 'Track base purchase prices, individual acquisition shipping, allocated lot shipping and additional shipment costs. Lot shipping is shared by physical quantity. Import shipments can allocate additional delivery and forwarding costs to selected items.'],
      ['Separate plans from completed sales', 'A target sale price is a forecast. Record the actual sale price and sale costs when a sale happens to distinguish potential returns from realised results. Marketplace records are entered by you; they are not automatically synchronised.'],
    ],
  },
  '/reseller-profit-tracking': {
    title: 'Reseller Profit and ROI Tracking',
    description: 'Understand resale profit using acquisition costs, actual sale values and sale costs. Keep potential returns separate from realised results.',
    intro: 'A sale price alone does not show what an item earned. Track the purchase and acquisition costs alongside marketplace fees and seller-paid delivery.',
    sections: [
      ['Start with the complete acquisition cost', 'The final purchase cost includes the base purchase price, individual acquisition shipping, allocated lot shipping and allocated shipment costs. Record each acquisition charge once.'],
      ['Subtract sale costs from the sale', 'For an item costing 60 in total, sold for 100 with 18 in sale costs, profit is 100 − 60 − 18 = 22. The 18 might represent a commission of 13 plus 5 shipping to the buyer paid by the seller.'],
      ['Compare profit with the investment', 'ROI is profit divided by final purchase cost, multiplied by 100. In the example, 22 / 60 × 100 = 36.67%. ROI differs from profit margin on revenue, which would be 22 / 100 = 22%. These figures describe the recorded item costs and do not include unrecorded business overheads.'],
    ],
  },
  '/guides/reusable-listing-template': {
    title: 'How to Build a Reusable Listing Template',
    description: 'A practical guide to writing marketplace listing templates with bracket variables, an example and a review checklist.',
    intro: 'A useful listing template keeps the structure consistent while leaving room for an accurate description of each item.',
    sections: [
      ['1. Choose a repeatable structure', 'Start with the details buyers need: brand, item type, size, condition, measurements and visible flaws. Keep platform-specific delivery claims out of a template you intend to reuse across marketplaces.'],
      ['2. Mark changing details', 'Example title: “[Brand] [Item] — [Size]”. Example description: “Condition: [Condition]. Measurements: [Measurements]. Known flaws: [Flaws].” Use descriptive variable names and enter a truthful value for every item.'],
      ['3. Generate and check an example', 'For Brand = Nike, Item = fleece and Size = M, review “Nike fleece — M”. Fill condition, measurements and flaws from the actual product. Check the generated copy against your photos before posting.'],
      ['4. Reuse the structure, review every listing', 'Save the template in Adrafteo, fill in the next item’s details, and copy the result. Confirm the marketplace category, required fields and delivery options yourself. Reusing a template does not automatically publish the listing.'],
    ],
    guide: true,
  },
  '/guides/resale-cost-and-profit': {
    title: 'How to Calculate Resale Cost, Profit and ROI',
    description: 'A worked resale example separating purchase cost, acquisition shipping, sale fees, profit and return on investment.',
    intro: 'Use a complete acquisition cost and actual sale costs to understand the result of a resale. The example below uses fictitious values in one currency.',
    sections: [
      ['1. Add acquisition costs once', 'An item costs 45, individual acquisition delivery costs 5, its allocated lot shipping is 4, and additional shipment costs are 6. Total acquisition cost is 45 + 5 + 4 + 6 = 60. Do not add a delivery charge again if it is already included in another amount.'],
      ['2. Record the actual sale and sale costs', 'The item sells for 100. A commission of 13 and shipping to the buyer of 5 paid by the seller make sale costs of 18. Shipping paid directly by the buyer and never charged to you is not a seller expense in this example.'],
      ['3. Calculate profit and ROI', 'Profit = sale value − total acquisition cost − sale costs = 100 − 60 − 18 = 22. ROI = profit / total acquisition cost × 100 = 36.67%. Profit margin on revenue = profit / sale value × 100 = 22%. ROI needs a positive cost basis to be meaningful.'],
      ['4. Keep forecasts and results separate', 'Before the sale, a target price describes a potential outcome. After the sale, use the actual price and costs. These item-level calculations exclude expenses you have not recorded, such as labour or general business overheads. This example is not tax advice.'],
    ],
    guide: true,
  },
}

export const publicRoutes = {
  '/': { title: 'Listing Templates & Reseller Inventory | Adrafteo', description: 'Create reusable marketplace listings and track resale inventory, acquisition costs, sales and profit. Free during the Adrafteo beta.' },
  '/pricing': { title: 'Pricing — Free During Beta | Adrafteo', description: 'Explore the features included free during the Adrafteo beta: listing templates, inventory, lots, shipment costs and profit tracking.' },
  '/faq': { title: 'Frequently Asked Questions | Adrafteo', description: 'Answers about Adrafteo listing templates, bracket variables, inventory tracking, privacy and free beta access.' },
  '/legal': { title: 'Legal Notice | Adrafteo', description: 'Website editor and hosting information for Adrafteo.', noindex: true },
  '/privacy': { title: 'Privacy Policy | Adrafteo', description: 'How Adrafteo handles account, template, inventory and feedback data.', noindex: true },
  '/terms': { title: 'Terms of Use | Adrafteo', description: 'Terms for using the Adrafteo reseller workspace.', noindex: true },
  ...Object.fromEntries(Object.entries(articles).map(([path, article]) => [path, { title: `${article.title} | Adrafteo`, description: article.description }])),
}

export function structuredData(path) {
  const page = publicRoutes[path]
  if (!page || page.noindex) return []
  const result = [{ '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${siteUrl}${path}#page`, url: `${siteUrl}${path}`, name: page.title, description: page.description, inLanguage: 'en' }]
  if (path === '/') result.push({ '@context': 'https://schema.org', '@type': 'WebApplication', '@id': `${siteUrl}/#application`, name: 'Adrafteo', url: `${siteUrl}/`, description: page.description, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', featureList: ['Reusable listing templates', 'Bracket variables', 'Inventory and lots', 'Acquisition cost allocation', 'Profit and ROI tracking'] })
  if (path === '/' || path === '/faq') result.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) })
  if (articles[path]?.guide) result.push({ '@context': 'https://schema.org', '@type': 'Article', headline: articles[path].title, description: page.description, mainEntityOfPage: `${siteUrl}${path}`, author: { '@type': 'Person', name: 'Antoine Marmol' }, inLanguage: 'en' })
  return result
}
