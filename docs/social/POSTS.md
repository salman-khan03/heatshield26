# HeatShield 26: social posts

All numbers below come from the app's default scenario (68,000 attendees, 98°F afternoon) and its cited open data. Don't add results the app doesn't show, such as awards, users, or city adoption, unless they actually happen.

**Assets in this folder:**

| File | Use |
|---|---|
| `linkedin-cover.png` (1200×1200) | LinkedIn post image |
| `linkedin-carousel.pdf` | LinkedIn document/carousel post (same 5 slides as Instagram) |
| `instagram-carousel-1…5.png` (1080×1350) | Instagram carousel, in order |
| `story-1…3.png` (1080×1920) | Instagram/LinkedIn stories, in order |
| `reel.mp4` (1080×1920, ~19 s, silent) | Instagram Reel, TikTok, YouTube Short, LinkedIn video |

Links: **Live:** https://heatshield26.vercel.app · **Code:** https://github.com/salman-khan03/heatshield26

---

## LinkedIn post

**Format:** upload `linkedin-carousel.pdf` as a document (best reach), or `linkedin-cover.png` as a single image. Put the links in the post; LinkedIn doesn't penalize a single link at the end much, but if you want maximum reach, move them to the first comment.

> Where should Houston spend $1M to protect 68,000 World Cup fans from heat? 🔥
>
> For the Rice Urban Sustainability Hackathon (Track 3: Public Health & the Built Environment), I built **HeatShield 26**, a geospatial decision-support tool covering Houston inside Loop 610 — NRG Stadium, Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium and Rice Stadium, all in one model.
>
> The problem: at 98°F and 50% humidity, Houston's heat index hits 113°F, which the National Weather Service calls "Danger." And heat isn't evenly spread. Houston's H3AT campaign measured a 14°F gap between neighborhoods. The data to plan around this already exists, but it's scattered: heat models from HARC, transit from METRO, health data from the CDC, tree canopy from the USDA Forest Service, cooling centers from the City.
>
> HeatShield joins 11 open datasets onto 3,434 hex cells and:
> → routes a crowd scenario from real METRORail stations and each venue's own nearby lots and garages (by actual or estimated capacity) — generically, not hand-typed per venue
> → scores a transparent Heat Event Risk Index for every block (heat, crowd, health vulnerability, shade, cooling access)
> → lets planners place cooling hubs, shade, water stations or shuttles and see the impact instantly
> → optimizes a budget: for NRG's flagship scenario, a $1M plan takes critical zones from 3 to 0 and visitors routed through them from 17,109 to 0
>
> What I learned: the data corrected me more than once. Houston's 2020 and 2024 heat campaigns actually disagree where they overlap (r = −0.19), so I didn't blend them. A high-resolution canopy layer silently covered only some neighborhoods (it said Hermann Park had 0% trees), so I switched to a consistent national dataset. Gap-filling is used only where spatial cross-validation shows it helps.
>
> Built with Next.js, TypeScript, MapLibre GL and open government data. AI (Gemini, with a Groq fallback) only writes plain-language explanations; the scoring and optimization are deterministic and auditable.
>
> FIFA is the case study. The same approach works for the Rodeo, Texans games, marathons, and heat emergencies.
>
> 🔗 Try it: https://heatshield26.vercel.app
> 💻 Code: https://github.com/salman-khan03/heatshield26
>
> #UrbanSustainability #PublicHealth #ClimateResilience #Houston #GIS #DataScience #Hackathon #RiceUniversity #NextJS #ExtremeHeat

---

## Instagram carousel post

**Format:** upload `instagram-carousel-1.png` through `-5.png` in order. Add a location tag for Houston, TX or NRG Stadium.

**Caption:**
> Where should Houston spend $1M to protect 68,000 fans from heat? 🔥🏟️
>
> I built HeatShield 26 for the Rice Urban Sustainability Hackathon: a live map that finds where crowds, extreme heat, health vulnerability, missing shade and far-away cooling overlap at 6 real Houston venues, then tells planners what to fund first.
>
> 📊 11 open datasets · 3,434 blocks scored · 6 venues
> 🌡️ 113°F heat index on a normal 98°F day
> 💧 $1M plan: critical zones 3 → 0
>
> Try it 👉 link in bio (heatshield26.vercel.app)
>
> #Houston #ExtremeHeat #ClimateAction #UrbanPlanning #PublicHealth #DataViz #GIS #WorldCup2026 #Hackathon #RiceUniversity #TechForGood #Sustainability

*Put `heatshield26.vercel.app` in your bio link before posting.*

---

## Instagram / LinkedIn stories (3 frames)

Post in order, one after another:

1. **`story-1.png` (hook)**. Add a **poll sticker** in the lower third: *"Guess: where's the most dangerous spot on game day?"* with the options **"Inside the stadium"** and **"The parking lots"**.
2. **`story-2.png` (result)**. Add a **slider emoji sticker 🔥**, or text: *"Critical zones 3 → 0 with a $1M plan"*.
3. **`story-3.png` (CTA)**. Place a **link sticker** over the dashed box, pointing to `https://heatshield26.vercel.app`. Optionally add a **mention sticker** for the hackathon's account.

---

## Reel

**File:** `reel.mp4` (about 19 seconds, 1080×1920, silent so you can add trending audio in-app).

**Timeline:**

| Time | On screen |
|---|---|
| 0.0–2.5 s | "68,000 fans. 98°F." (Houston · World Cup · Heat) |
| 2.5–7.0 s | Map zooms from the city into NRG Stadium. *"Where does heat actually hurt people?"* |
| 7.0–10.5 s | Map rises into 3D; height = risk. *"One risk score for every block"* |
| 10.5–11.7 s | *"Now give it $1M."* |
| 11.7–15.7 s | Camera orbits the optimized plan with intervention markers. *"Critical zones 3 → 0"* |
| 15.7–18.7 s | End card: HeatShield 26 · heatshield26.vercel.app |

**Audio:** pick an upbeat instrumental that's trending in the Reels audio library, and cut the beat drop at 10.5 s (the "$1M" card).

**Caption:**
> 68,000 fans. 98°F. Where does the heat actually hurt people? 🔥
>
> I built HeatShield 26 for the Rice Urban Sustainability Hackathon: real Houston heat, health, shade and transit data turned into a live planning map for 6 real venues. Give it $1M and it builds a plan that takes critical heat zones from 3 to 0.
>
> Try it 👉 link in bio
>
> #Houston #ExtremeHeat #DataViz #UrbanPlanning #ClimateTech #3DMap #Hackathon #TechForGood #WorldCup2026 #PublicHealth

**Optional voiceover** (record in-app, about 17 s):
> "Sixty-eight thousand fans, ninety-eight degrees. So where does heat actually hurt people? I combined Houston's heat, health, shade and transit data into one risk score for every block. Then I gave it a million-dollar budget. Critical zones: three to zero. Try it, link in bio."

---

## Posting checklist

- [ ] Bio link set to https://heatshield26.vercel.app
- [ ] Open the live site on your phone first, to confirm it loads before you post
- [ ] Tag the hackathon's official account and Rice University where appropriate
- [ ] Post the LinkedIn carousel on a weekday morning; post the reel and stories the same day
- [ ] Pin a comment with the GitHub link on LinkedIn
