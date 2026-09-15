# HeatShield 26: pitch and demo script

**Deck:** `docs/HeatShield26-Pitch.pptx`. The same script is in each slide's speaker notes (View → Notes, or Presenter View).
**Target length:** about 5 minutes including the live demo, with 2–3 minutes left for questions. Slides 11 and 13 are optional.

---

## Before you present (10 minutes before)

1. **Open the app** in a full-screen browser tab: https://heatshield26.vercel.app/planner (or `npm run dev` → http://localhost:3000/planner as a backup). Let it load fully so the map tiles are cached.
2. **Reset the planner:** reload the page. Defaults are 68,000 attendees, 98°F, Afternoon, Risk layer, 2D.
3. **Warm up Gemini:** click any zone → "Explain this recommendation" once, so the first live call isn't slow. If it returns the template, the demo still works.
4. **Set up screens:** two windows (PowerPoint in Presenter View, browser on the projector) and practice switching with **Alt+Tab**.
5. **Backup plan:** if Wi-Fi dies, slides 6–8 have screenshots of every demo state. Narrate those instead.
6. **Zoom** the browser to 90% if the projector is low-resolution.

---

## Timing plan

| # | Slide | Time | Cumulative |
|---|---|---|---|
| 1 | Title / the question | 0:20 | 0:20 |
| 2 | The problem | 0:30 | 0:50 |
| 3 | Why it's hard (data silos) | 0:20 | 1:10 |
| 4 | The solution (4 steps) | 0:25 | 1:35 |
| 5 | The index | 0:25 | 2:00 |
| 6 | **Live demo 1:** the map | 0:45 | 2:45 |
| 7 | **Live demo 2:** zone evidence + Gemini | 0:30 | 3:15 |
| 8 | **Live demo 3:** $1M optimizer | 0:40 | 3:55 |
| 9 | Data analytics rigor | 0:30 | 4:25 |
| 10 | Impact & legacy | 0:25 | 4:50 |
| 11 | How it's built *(skip if short)* | 0:15 | 5:05 |
| 12 | Close | 0:15 | 5:20 |
| 13 | *Backup: limitations (Q&A only)* | — | — |

If you have only 3 minutes, do slides 1 → 2 → 4 → 6 → 8 → 9 → 12.

---

## Word-for-word script

### Slide 1: Title *(20 s, look at the judges)*
> Hi, I'm Salman. Houston just hosted World Cup matches at NRG Stadium: sixty-eight thousand people, in one of the hottest, most humid big cities in the country.
>
> Our question is simple and practical: if Houston had one million dollars to protect people from heat at its next mega-event, where exactly should it spend it?
>
> This is HeatShield 26. It gives a city a real answer: a map, a ranked plan, and the evidence behind every recommendation.

### Slide 2: The problem *(30 s)*
> On a normal Houston summer afternoon, at ninety-eight degrees and fifty percent humidity, the heat index is a hundred and thirteen. The Weather Service calls that "Danger."
>
> But heat isn't evenly distributed. Houston's own H3AT campaign collected over four hundred thousand street-level readings and found a fourteen-degree gap between neighborhoods.
>
> Now drop sixty-eight thousand fans into that. The risk isn't the stadium bowl. It's the parking lots, the rail platforms, the security lines, and the neighborhoods around them.

### Slide 3: Why it's hard *(20 s)*
> The frustrating part is that the data already exists. Heat maps from HARC. Transit from METRO. Health data from the CDC. Tree canopy from the Forest Service. Cooling centers from the City.
>
> But it all sits in separate silos. A planner can look at any one of them. Nobody can answer the question that matters on event day: where is it dangerous, and what do we fund first?

### Slide 4: The solution *(25 s)*
> HeatShield does four things.
>
> First, it measures: we joined eleven open datasets onto about fourteen hundred hexagons, each about a tenth of a square kilometer.
> Second, it models the crowd, routing attendance from the real rail stations and the real NRG parking lots, weighted by their actual capacities.
> Third, it scores risk for every cell. Fourth, it helps you act: place interventions yourself, or give it a budget.
>
> And it's transparent. No black-box AI decides where the money goes.

### Slide 5: The index *(25 s)*
> Here's the model. It's a weighted index: forty percent heat, twenty-five percent crowd, twenty percent health and social vulnerability, ten percent shade, five percent access to cooling.
>
> Every component is scaled zero to a hundred, every weight is a slider in the app, and we're explicit that this is decision support, not a medical prediction. Anything we assume, like what a cooling hub costs, is labeled as an assumption.

### Slide 6: Live demo 1, the map *(45 s)*
**Alt+Tab to the browser.**
> This is the planner: sixty-eight thousand attendees, ninety-eight degrees, afternoon kickoff.
>
> Red is critical. It isn't the whole city. It's the NRG parking lots right at the stadium's edge, where people tailgate on asphalt, and the rail stations where fans queue. Five critical zones, seventy-nine high-risk zones, and almost nineteen thousand visitors whose route crosses a critical zone.

**Drag "Forecast air temperature" down to 88°F.**
> At eighty-eight degrees, the critical zones disappear.

**Drag it back to 98°F. Click 3D.**
> The height is risk.

**Map layer → Crowd → "Show modeled routes."**
> And these are the arrival routes we model: rail, parking, rideshare, walk-ups.

**Switch the layer back to Risk and 2D.**

### Slide 7: Live demo 2, the evidence *(30 s)*
**In the Zones tab, click row #1 (South Main).**
> Click any zone and HeatShield shows why. This one scores seventy-nine. Crowd exposure is maxed at about fifty-four hundred person-hours. Two percent tree canopy. A heat index of a hundred and twelve. The nearest cooling center is more than a mile away.

**Click "Explain this recommendation."**
> This is the only place we use AI. Gemini turns these exact numbers into a short memo a planner could paste into a briefing. It's only allowed to use these facts; the scores themselves come from plain, deterministic code.

### Slide 8: Live demo 3, the $1M plan *(40 s, the money moment; pause after clicking)*
**Optimize tab → "Optimize $1M plan."**
> Knowing where the problem is isn't enough. Cities need to know what to do. So I give it the budget: one million dollars.
>
> In about a tenth of a second it evaluates over eleven thousand options and builds a portfolio: water and misting stations, shade over the queues, a cooling hub, a shuttle loop.

**Point at the KPI strip at the bottom of the map.**
> Critical zones go from five to zero. Visitors routed through critical zones go from nearly nineteen thousand to zero. Total exposure burden drops eighteen percent, for nine hundred and eighty thousand dollars.
>
> The costs and effect sizes are planning assumptions, labeled that way. A city would swap in its real procurement numbers.

**Alt+Tab back to the slides.**

### Slide 9: Data analytics *(30 s, slow down; this earns the analytics points)*
> We didn't just stack layers. We tested them, and the data corrected us more than once.
>
> Houston ran heat campaigns in 2020 and 2024. Where they overlap, their afternoon maps actually disagree; the correlation is negative. So instead of averaging two inconsistent maps, we use one primary source and document why.
>
> We only fill heat gaps by interpolation where cross-validation shows it beats a flat guess. We caught that the high-resolution LiDAR canopy only covers certain neighborhoods (it said Hermann Park had no trees) and switched to a consistent national dataset.
>
> And the optimizer's results match a full re-scoring exactly.

### Slide 10: Impact & legacy *(25 s)*
> Why does this matter beyond the World Cup? The tournament is over, but NRG Park hosts the Rodeo and Texans games every year, and Houston's heat season isn't getting shorter.
>
> It's feasible today. It only uses data Houston already publishes, it recommends things a city can actually buy, and it runs in a browser. And every cooling hub placed for one event becomes a resilience hub for the neighborhood next door.

### Slide 11: How it's built *(15 s, optional)*
> Quickly on the build: a Node pipeline pulls live government map services and samples the heat and canopy rasters onto a hex grid. The model and optimizer are TypeScript that runs entirely in the browser, which is why every slider is instant. The front end is Next.js with MapLibre. It's all open source on GitHub.

### Slide 12: Close *(15 s, then stop talking)*
> So: where should Houston invest a million dollars to protect people from heat at its next mega-event?
>
> Now there's an answer: a map, a plan, and the evidence behind every dollar. FIFA was the case study. HeatShield is built for every event Houston hosts next.
>
> Thank you. I'd love your questions.

---

## How to present (delivery tips)

- **Open without "um, so…".** Memorize the first two sentences of slide 1 and the whole of slide 12.
- **Talk to the judges, not the screen.** Glance at the slide, then turn back to them.
- **Pause after the optimizer click.** Let the map change before you speak; that silence is the best moment of the demo.
- **Say numbers slowly,** and round them when speaking ("almost nineteen thousand," not "eighteen thousand nine hundred seventy-eight").
- **Use the rubric's words** without sounding scripted: *impact*, *data analytics*, *feasible*, *legacy*, *visualization*.
- **Own the assumptions before they're raised.** Saying "these are labeled planning assumptions" builds credibility; never overclaim accuracy.
- **If something breaks live,** say "let me show you the captured run," go back to slides 6–8, and keep going. Judges care that you recover, not that the Wi-Fi works.
- **Rehearse twice with a timer:** once at full speed, once with the 3-minute cut.

---

## Likely judge questions, with answers

**"Is this real data?"**
> Yes. Heat comes from HARC's H3AT modeled heat-index rasters, canopy from the USDA Forest Service, health from CDC SVI and CDC PLACES, cooling sites from the City of Houston, rail from H-GAC, and parking lots with capacities from OpenStreetMap. The crowd flows are modeled, because no public FIFA pedestrian counts exist, and every routing assumption is a slider.

**"How accurate is the risk score?"**
> It's a decision-support index, not a clinical prediction, so accuracy means "does it rank places sensibly and transparently." We validated the parts we could: heat gap-filling is chosen by spatial cross-validation, the two heat campaigns' disagreement is documented, and the optimizer is checked against a full re-score. Validating against EMS heat-illness calls would be the next step.

**"Where did the costs come from?"**
> They're placeholders for comparison, labeled as assumptions in the app and on the methodology page. The model is built so a city can drop in its procurement numbers.

**"Why these weights?"**
> Heat is the hazard, so it carries the most weight; crowd and vulnerability decide who's exposed. They're a starting point, and every weight is adjustable live, so a health department can re-weight and immediately see whether the ranking changes.

**"Why use AI at all?"**
> Only for communication. Gemini turns the numbers into a planner memo and is limited to the facts shown. Scoring and optimization are deterministic, so results are reproducible and auditable.

**"Does it work for other events or cities?"**
> The pipeline is parameterized by bounding box and venue. Attendance, arrival modes and tailgating are sliders, and the data sources are national (CDC, USFS) plus Houston-specific ones that most large cities have equivalents for.

**"What would you do with more time?"**
> Real walking networks instead of straight-line routes, event-day weather forecasts, cooling-center operating hours, and validation against EMS heat-illness calls from past NRG events.
