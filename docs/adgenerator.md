# Universal Ad Generator Context

Use this file as the master brief whenever an AI creates advertisements, social posts, educational carousels, launch graphics, feature announcements, or other marketing visuals for any project.

It is designed for products such as:

- Mobile applications
- Web applications and SaaS products
- Online shops and ecommerce stores
- POS and business-management systems
- Services, agencies, and local businesses
- Future products not listed here

This document has two layers:

1. **Universal rules** that should remain reusable across projects.
2. **Current Project Profile** containing facts that must be replaced when this file is copied to another project.

Never apply facts from one project to another project.

## AI Workflow

Before creating content, the AI must:

1. Read this file.
2. Inspect the current repository, product pages, screenshots, documentation, and existing assets.
3. Read the Current Project Profile near the end of this document.
4. Identify whether the request is promotional, educational, informational, or engagement-focused.
5. Verify every feature, price, platform, contact detail, and product claim before using it.
6. Choose the campaign strategy and slide count based on the request instead of repeating the previous campaign.
7. Replace the current generator files, render every slide, and visually inspect the final exports.

If an important fact cannot be verified from the project, omit it or ask the user. Do not invent a feature, benefit, statistic, testimonial, customer count, rating, discount, or guarantee.

## Project Profile Template

When using this file in another project, replace the Current Project Profile with verified information in this format:

```text
Project name:
Product type:
One-line description:
Primary audience:
Audience location/language:
Main customer problems:
Verified features or services:
Verified benefits:
Platforms and availability:
Pricing or free-plan facts:
Activation or paid-feature limitations:
Approved contact details:
Approved CTA:
Brand assets and paths:
Brand colors or style:
Claims that must not be made:
Additional legal or factual disclaimers:
```

Do not begin a product-promotional campaign until the relevant fields are known or discoverable from the repository.

## Campaign Request Template

Interpret the user's request using these fields. Infer reasonable creative details, but never infer unverified product facts.

```text
Campaign goal: promotion / education / launch / update / engagement / awareness
Topic or offer:
Target audience:
Platform: Facebook / Instagram / TikTok / marketplace / other
Language:
Slide count: fixed or flexible
Style:
Tone:
Required text:
Required assets:
Must include:
Must exclude:
Output size:
```

## Content Modes

### Promotional

Use product benefits, verified proof, objection handling, demonstrations, and a clear CTA. Contact details normally belong on the final slide, not every slide.

Suitable structures include:

- AIDA: attention, interest, desire, action
- Hook, demonstration, proof, CTA
- Problem, consequence, solution, action
- Before and after
- Feature-to-benefit walkthrough
- Audience-specific use cases
- Comparison or alternative framing
- Trust and objection handling
- Launch, update, seasonal, or offer campaign

### Educational Or Non-Promotional

Teach something independently useful to the audience. Keep branding small, omit contact details and sales CTAs, and make every slide valuable even when viewed separately.

Suitable topics include:

- Calculations and formulas
- Checklists
- Tips and common mistakes
- Selling strategies
- Operational workflows
- Definitions and comparisons
- Short case examples
- Questions that help the audience diagnose a problem

Do not force the product into an educational post. A small logo or footer attribution is enough unless the user asks for a product connection.

### Engagement Or Comment-Led

Use an honest open question, comparison, incomplete explanation, quiz, myth, or debatable choice that encourages discussion. The content must still be accurate and must not intentionally mislead people.

### Product Update Or Feature Announcement

Explain what changed, who benefits, how it works, and whether an app build, web deployment, subscription, activation, or account action is required. Verify release details before writing them.

## Ethical Psychology And Hooks

Psychology may be used to improve attention and comprehension, not to deceive.

Useful principles include:

- Curiosity gap: reveal enough to create interest without hiding essential truth.
- Loss aversion: show a realistic preventable loss without manufactured fear.
- Cognitive ease: reduce choices and explain one idea at a time.
- Specificity: use concrete examples instead of vague promises.
- Contrast: compare before/after, option A/B, or cost/value clearly.
- Social identity: speak to the audience's real role and goals without fake social proof.
- Commitment: suggest a small useful next action.
- Choice architecture: organize honest options so they are easier to compare.

Never use fake scarcity, fabricated urgency, false discounts, invented testimonials, misleading countdowns, guaranteed income, or unverified performance claims.

## Copy Rules

- Write for the Current Project Profile's audience and language.
- Prefer short, conversational wording that can be understood in one glance.
- Use familiar English terms only when the audience commonly recognizes them.
- Translate meaning naturally instead of translating word for word.
- Explain technical terms when followers may not understand them.
- Use one primary message per slide.
- Put the strongest hook on the first slide.
- Keep supporting copy shorter than the headline.
- Use examples with correct arithmetic and realistic assumptions.
- Recheck every displayed number, operator, percentage, and total.
- Do not overstate benefits with words such as “always,” “guaranteed,” or “best” unless provable.
- Keep spelling, punctuation, product naming, and terminology consistent across slides.

## Slide Count And Density

- The slide count is flexible unless the user specifies it.
- A request for “one or two slides” must not become a long carousel.
- Do not force campaigns into 9 slides or any other standard count.
- Use one section or idea per slide.
- Split genuinely different ideas across slides instead of shrinking the type.
- For a feature-list campaign, use one feature section per slide.
- For short tips, one or two slides may be better than a carousel.
- Every slide should make sense when encountered independently, especially on social feeds.

## Format And Readability

- Default social poster size: `1000 x 1600` pixels, a 10:16 portrait ratio.
- Change the dimensions when the user or target platform requires another format.
- Design for phone viewing, not desktop viewing.
- At `1000 x 1600`, body copy should generally be about `24px` or larger.
- Important supporting text should generally be about `28px` or larger.
- Use strong headline hierarchy and generous margins.
- Avoid text touching canvas edges.
- Avoid dense multi-column layouts unless the content remains readable on a phone.
- Prefer fewer words and more whitespace over tiny text.
- Keep disclaimers readable; do not hide important limitations in microscopic text.

## Visual Direction

- Match the requested style and Current Project Profile.
- A “different style” requires more than changing colors. Change composition, typography, illustration method, spacing, hierarchy, and information density.
- A “simple style” should use one clear message, one restrained visual, and generous empty space.
- Use project screenshots when they are current and helpful.
- When screenshots are unavailable, create honest CSS-based interface cards, diagrams, charts, devices, receipts, or product representations.
- Do not show controls, features, products, prices, or outcomes that do not exist.
- Keep branding proportional to the campaign goal.
- Promotional campaigns may use stronger branding and a CTA.
- Educational campaigns should prioritize the lesson over the logo.
- Do not rely on visual decoration that makes the copy harder to read.

## Assets And External Media

- Prefer assets already available in the project.
- Record exact paths in the Current Project Profile.
- Inspect an image before using it.
- Do not assume an old screenshot still represents the current product.
- Respect image ownership and licensing.
- Do not depend on remote images, hosted fonts, CDN assets, or network APIs for the final generator.
- If generated imagery is used, it must not imply unsupported product behavior or fake customer evidence.

## Generator Folder Rule

- Keep exactly one generator folder: `adsgenerator/`.
- Do not create campaign copies such as `adsgenerator-v2/`, `adsgenerator-hooks/`, or `adsgenerator-final/`.
- Replace creative files inside the existing folder when a new campaign is requested.
- Keep only the current campaign's PNG files in `adsgenerator/exports/`.
- Move or remove stale exports before rendering the replacement campaign.
- Keep generator code separate from application, website, backend, and production source code.
- Never import generator files into the product application.
- Advertising work must not require an app rebuild, OTA update, website deployment, or production release unless the user explicitly asks for one.

## Standard Generator Structure

```text
adsgenerator/
  index.html       Slide content and semantic structure
  styles.css       Complete visual design
  script.js        Navigation, overview, slide selection, capture mode
  README.md        Current campaign description and usage
  exports/         Current ready-to-post PNG files only
```

The generator should work fully offline.

## Dependency Isolation

- Prefer dependency-free HTML, CSS, and JavaScript.
- Never add advertising libraries to the product's root `package.json`, lockfile, application dependencies, native project, or production build configuration.
- If an ad-only library is genuinely necessary, keep it under `adsgenerator/` only.
- Ignore ad-only dependency and cache folders in version control:

```gitignore
adsgenerator/node_modules/
adsgenerator/vendor/
adsgenerator/.cache/
```

- Do not commit third-party ad libraries, caches, temporary browser profiles, or rendering tools.
- Do not modify product dependencies just to generate advertisements.
- Final generator source and exported PNGs may be committed only when the project's workflow calls for them.

## Capture Interface

The default slide URL convention is:

```text
adsgenerator/index.html?slide=1&capture=1
```

Expected behavior:

- `slide=N` displays slide N.
- `capture=1` hides controls and removes page padding.
- Previous and next buttons work in normal preview mode.
- Arrow keys may navigate between slides.
- Overview mode may display all slides for review.

## Rendering And Verification

Before finishing any campaign:

1. Count the slide elements in `index.html`.
2. Ensure only one `adsgenerator/` folder exists.
3. Clear or archive stale PNG exports.
4. Render every slide at the requested exact dimensions.
5. Visually inspect every rendered slide.
6. Confirm no headline, paragraph, badge, logo, disclaimer, or footer is clipped.
7. Confirm text remains readable on a phone.
8. Verify every number, formula, currency amount, percentage, and arithmetic operator.
9. Confirm the export count matches the HTML slide count.
10. Confirm all exports have the same requested dimensions.
11. Confirm the campaign contains no unsupported claims or accidental information from another project.
12. Confirm product dependency files were not changed by advertising work.

Do not report completion after editing HTML alone. A campaign is complete only after rendering and visual inspection.

## Final Response

After generating a campaign, briefly report:

- Campaign topic and strategy
- Number of slides
- Export dimensions
- Export folder
- Whether all slides were visually inspected
- Whether any external libraries or product dependencies were added

## Current Project Profile: MK POS

This profile applies only while this file is used in the MK POS repository. Replace this entire section when copying the file to another project.

### Identity

- Project name: MK POS
- Product type: Offline-first Android point-of-sale application
- One-line description: A simple phone-based POS for Myanmar small shops
- Primary audience: Myanmar small-shop owners who may not be technically experienced
- Primary languages: Burmese and English
- Main icon: `assets/mkicon.png`
- Generator icon reference: `../assets/mkicon.png`

### Verified Features

- Offline operation with local SQLite storage on the phone
- Product management and search
- Product categories
- Product size and color
- User-defined price types such as Retail, Wholesale, or Debt price
- Sale entry with quantity, cash received, change, and sale remarks
- Customer selection and search by name or phone
- Walk-in customers
- Customer debt receivable and shop debt payable records
- Customer and shop payment history with remarks
- Automatic stock reduction after a completed sale
- Configurable low-stock levels and a full low-stock screen
- Daily sales, estimated profit, expenses, and reports
- Transaction history and sale editing
- Receipt printing and sharing
- Bluetooth ESC/POS thermal printing for 58mm and 80mm paper
- Burmese receipt rendering
- Backup and restore
- Burmese and English application languages

### Positioning

- Run everyday shop records from one phone
- Track sales, estimated profit, stock, expenses, and customer debt
- Continue selling without internet access
- Print compact Burmese thermal receipts
- Reduce dependence on handwritten notebooks

### Pricing And Limitations

- The application may be described as a free POS.
- Shop-detail receipt customization is activation-controlled.
- Do not imply that every customization feature is free.
- Use `အခမဲ့ ဖုန်းနဲ့သုံးနိုင်သော POS` only when the user requests that message for a promotional campaign.

### Approved Contact Details

- Viber: `09792104209`
- Telegram: `@moekaungdev`

Use contact details mainly on the final promotional CTA slide. Omit them from educational or non-promotional content unless explicitly requested.

### Unsupported Claims

Do not advertise these unless they are later implemented and verified:

- Barcode scanning
- Cloud synchronization
- Multi-user accounts
- Online ordering
- Guaranteed profit or sales growth
- Any feature not confirmed by the current repository

## Instruction For Future AI

Treat the universal sections as persistent rules. Treat the Current Project Profile as replaceable data. When this file is copied to another project, inspect that project and rewrite the profile before generating ads. Never carry MK POS features, contacts, pricing, assets, or audience assumptions into a web app, online shop, service, or unrelated product.
