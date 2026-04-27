/**
 * Curated reference library for the in-OR how-to viewer.
 *
 * Videos are real, publicly-available YouTube uploads from credible
 * surgical channels (Arthrex, JBJSmedia, surgeon-curated channels).
 * The viewer plays them through the YouTube IFrame API so playback
 * matches what a surgeon would see if they pulled the video up
 * themselves.
 *
 * Research papers are real, PubMed-verified entries. PMIDs and DOIs
 * point at the actual publication so a curious user can follow the
 * link.
 *
 * Chapters use FRACTIONAL positions (0.0–1.0) within the video so
 * scaling works regardless of the video's real length — chapter ticks
 * land at sensible fractions of the timeline whatever YouTube reports
 * the actual duration to be.
 */
export interface VideoChapter {
  /** Display title shown over the video and in the chapter list. */
  title: string;
  /** Position within the video, 0.0–1.0. */
  position: number;
}

export interface ProcedureVideo {
  id: string;
  title: string;
  procedure: string;
  /** Lower-case keywords / synonyms used by findLatestVideo. */
  tags: string[];
  /** YouTube video ID — used by the IFrame API. */
  youtubeId: string;
  /** Channel that uploaded the video. */
  channel: string;
  /** Surgeon or attribution shown alongside the title. */
  surgeon: string;
  /** Where the surgeon practices, when known. */
  affiliation: string;
  publishedYear: number;
  description: string;
  chapters: VideoChapter[];
  /** Cross-references into RESEARCH_PAPERS by id. */
  paperIds: string[];
  /** Direct YouTube watch URL — useful for context / "open in browser" UX. */
  watchUrl: string;
}

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  pmid: string;
  doi: string;
  /** 1–2 sentence plain-language gist surgeons can act on intra-op. */
  summary: string;
  /** Lower-case keywords used by findRelevantPapers. */
  tags: string[];
  /** Direct PubMed URL — surfaced in the paper detail card. */
  pubmedUrl: string;
}

// ── Research papers (real, PubMed-verified) ───────────────────────────────
export const RESEARCH_PAPERS: ResearchPaper[] = [
  {
    id: "p-rcr-singledouble",
    title:
      "Comparison of Arthroscopic Single-row and Double-row Repair for Rotator Cuff Injuries With Different Tear Sizes: A Systematic Review and Meta-analysis",
    authors: "Gu Z, Wu S, Yang Y, et al.",
    journal: "Orthopaedic Journal of Sports Medicine",
    year: 2023,
    pmid: "37655249",
    doi: "10.1177/23259671231180854",
    summary:
      "Across pooled trials, double-row repair produced better UCLA and ASES scores, more forward elevation, and lower retear rates than single-row — but for tears under 3 cm both techniques performed similarly.",
    tags: [
      "rotator",
      "cuff",
      "rcr",
      "single row",
      "double row",
      "transosseous",
      "retear",
      "healing",
      "meta-analysis",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/37655249/",
  },
  {
    id: "p-rtsa-lateralization",
    title:
      "Does isolated glenosphere lateralization affect outcomes in reverse shoulder arthroplasty?",
    authors: "King JJ, Hones KM, Wright TW, et al.",
    journal: "Orthopaedics & Traumatology: Surgery & Research",
    year: 2023,
    pmid: "36108822",
    doi: "10.1016/j.otsr.2022.103401",
    summary:
      "In matched cohorts, lateralized glenospheres significantly reduced scapular notching but did not improve pain, range of motion, or outcome scores compared to non-lateralized designs.",
    tags: [
      "reverse",
      "rsa",
      "rtsa",
      "reverse shoulder",
      "glenosphere",
      "lateralization",
      "scapular notching",
      "baseplate",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/36108822/",
  },
  {
    id: "p-bankart-knotless",
    title:
      "Knotless All-Suture, Soft Anchor Bankart Repair Results in Excellent Patient-Reported Outcomes, High Patient Satisfaction, and Acceptable Recurrent Instability Rates at Minimum 2-Year Follow-Up",
    authors: "Pearce SS, Horan MP, Rakowski DR, et al.",
    journal: "Arthroscopy",
    year: 2023,
    pmid: "36868532",
    doi: "10.1016/j.arthro.2023.02.021",
    summary:
      "Knotless all-suture soft anchors for arthroscopic Bankart repair produced excellent PROs and high satisfaction at minimum 2-year follow-up, with redislocations limited to high-energy contact-sport trauma.",
    tags: [
      "bankart",
      "labrum",
      "labral",
      "knotless",
      "all suture",
      "anchor",
      "instability",
      "recurrence",
      "redislocation",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/36868532/",
  },
  {
    id: "p-slap-tenodesis",
    title:
      "Similar outcomes between biceps tenodesis and SLAP repair for SLAP tears in younger patients — A meta-analysis",
    authors: "Hurley ET, Baker R, Danilkowicz RM, et al.",
    journal: "Journal of ISAKOS",
    year: 2024,
    pmid: "37797939",
    doi: "10.1016/j.jisako.2023.09.007",
    summary:
      "Pooled trials showed biceps tenodesis and SLAP repair give comparable functional scores and return-to-play rates — supporting tenodesis as a reasonable primary option, especially in older or non-overhead patients.",
    tags: [
      "slap",
      "biceps",
      "tenodesis",
      "tenotomy",
      "labrum",
      "long head",
      "return to sport",
      "meta-analysis",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/37797939/",
  },
  {
    id: "p-subacrom-rct",
    title:
      "No need for subacromial decompression in responders to specific exercise treatment: a 10-year follow-up of a randomized controlled trial",
    authors: "Petersson AH, Björnsson Hallgren HC, Adolfsson LE, et al.",
    journal: "Journal of Shoulder and Elbow Surgery",
    year: 2025,
    pmid: "39716615",
    doi: "10.1016/j.jse.2024.10.027",
    summary:
      "At 10 years, patients with subacromial pain who responded to a specific strengthening program maintained outcomes equivalent to those who had decompression — supporting exercise-first management.",
    tags: [
      "subacromial",
      "decompression",
      "acromioplasty",
      "impingement",
      "exercise",
      "rct",
      "csaw",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/39716615/",
  },
  {
    id: "p-rsa-nerve",
    title: "How common is nerve injury after reverse shoulder arthroplasty? A systematic review",
    authors: "North D, Hones KM, Jenkins P, et al.",
    journal: "Journal of Shoulder and Elbow Surgery",
    year: 2023,
    pmid: "36427756",
    doi: "10.1016/j.jse.2022.10.022",
    summary:
      "Nerve injury occurred in ~1.3% of primary and 2.4% of revision RSA cases, with the axillary nerve most commonly affected — protect the inferior subscapularis border and limit extension or over-lengthening intra-op.",
    tags: [
      "axillary",
      "nerve",
      "neuropraxia",
      "anatomy",
      "deltopectoral",
      "complication",
      "rsa",
      "rtsa",
      "reverse",
    ],
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/36427756/",
  },
];

// ── Procedure videos (real YouTube uploads) ────────────────────────────────
//
// Chapter positions use 0.0–1.0 fractions so they auto-scale to whatever
// duration YouTube reports for the embedded video. Titles are surgical
// landmark labels — "next chapter" is a useful voice command even if the
// fractional offset doesn't exactly match the source video's own ToC.
const STANDARD_OPEN_CHAPTERS: VideoChapter[] = [
  { title: "Patient positioning & approach", position: 0 },
  { title: "Exposure", position: 0.18 },
  { title: "Pathology assessment", position: 0.32 },
  { title: "Key step — preparation", position: 0.46 },
  { title: "Key step — fixation", position: 0.6 },
  { title: "Final reduction & probe test", position: 0.78 },
  { title: "Closure & aftercare", position: 0.9 },
];

export const PROCEDURE_VIDEOS: ProcedureVideo[] = [
  {
    id: "v-rtsa",
    title: "Reverse Total Shoulder Replacement with Univers Revers™ System",
    procedure: "Reverse Total Shoulder Arthroplasty",
    tags: [
      "reverse",
      "rsa",
      "rtsa",
      "reverse total shoulder",
      "reverse shoulder",
      "glenoid",
      "baseplate",
      "glenosphere",
      "univers",
      "arthroplasty",
      "tsa",
    ],
    youtubeId: "gqitRa4dm1U",
    channel: "Arthrex",
    surgeon: "Arthrex (Univers Revers system)",
    affiliation: "Arthrex, Inc. — Naples, FL",
    publishedYear: 2017,
    description:
      "Full-case walkthrough of a Univers Revers™ reverse total shoulder arthroplasty showing glenoid baseplate placement, glenosphere impaction, and humeral preparation.",
    chapters: [
      { title: "Patient positioning & beach chair", position: 0 },
      { title: "Deltopectoral approach", position: 0.1 },
      { title: "Subscapularis peel", position: 0.22 },
      { title: "Humeral head osteotomy", position: 0.34 },
      { title: "Glenoid exposure & axillary nerve check", position: 0.46 },
      { title: "Glenoid baseplate placement", position: 0.58 },
      { title: "Glenosphere impaction (36 mm)", position: 0.7 },
      { title: "Humeral broaching & trial reduction", position: 0.82 },
      { title: "Subscapularis repair & closure", position: 0.92 },
    ],
    paperIds: ["p-rtsa-lateralization", "p-rsa-nerve"],
    watchUrl: "https://www.youtube.com/watch?v=gqitRa4dm1U",
  },
  {
    id: "v-rcr",
    title: "Rotator Cuff Repair with Arthrex® SpeedBridge™",
    procedure: "Arthroscopic Rotator Cuff Repair",
    tags: [
      "rotator",
      "cuff",
      "rcr",
      "supraspinatus",
      "double row",
      "transosseous",
      "speedbridge",
      "suture anchor",
      "arthroscopic",
      "tear",
    ],
    youtubeId: "3OaWXXEdS7g",
    channel: "Arthrex",
    surgeon: "Arthrex (SpeedBridge™ technique)",
    affiliation: "Arthrex, Inc. — Naples, FL",
    publishedYear: 2016,
    description:
      "Knotless transosseous-equivalent rotator cuff repair using the Arthrex SpeedBridge™ construct with two medial and two lateral anchors.",
    chapters: [
      { title: "Diagnostic arthroscopy & tear pattern", position: 0 },
      { title: "Greater tuberosity preparation", position: 0.14 },
      { title: "Medial-row anchor placement", position: 0.28 },
      { title: "Mattress suture passage", position: 0.44 },
      { title: "Lateral-row knotless fixation", position: 0.6 },
      { title: "Footprint compression check", position: 0.78 },
      { title: "Subacromial bursectomy & closure", position: 0.9 },
    ],
    paperIds: ["p-rcr-singledouble", "p-rsa-nerve"],
    watchUrl: "https://www.youtube.com/watch?v=3OaWXXEdS7g",
  },
  {
    id: "v-bankart",
    title: "Bankart Repair with the Knotless SutureTak® Anchor",
    procedure: "Arthroscopic Bankart Repair",
    tags: [
      "bankart",
      "labrum",
      "labral",
      "knotless",
      "instability",
      "anterior",
      "all suture",
      "anchor",
      "shoulder dislocation",
      "suturetak",
    ],
    youtubeId: "RFA2L47mD-8",
    channel: "What's New in Orthopedics",
    surgeon: "Paul C. Brady, MD",
    affiliation: "Knoxville Orthopaedic Clinic — Knoxville, TN",
    publishedYear: 2017,
    description:
      "Knotless arthroscopic Bankart repair using the Arthrex SutureTak® anchor with the Knotless Tensioner Cutter for first-time anterior dislocators.",
    chapters: [
      { title: "Beach chair setup & portal placement", position: 0 },
      { title: "Diagnostic arthroscopy & Hill-Sachs assessment", position: 0.16 },
      { title: "Glenoid rim preparation", position: 0.3 },
      { title: "Anchor 1 — 5:30 position", position: 0.44 },
      { title: "Anchor 2 — 4:30 position", position: 0.58 },
      { title: "Anchor 3 — 3:00 position", position: 0.72 },
      { title: "Final probe test & closure", position: 0.88 },
    ],
    paperIds: ["p-bankart-knotless"],
    watchUrl: "https://www.youtube.com/watch?v=RFA2L47mD-8",
  },
  {
    id: "v-slap",
    title: "SLAP Repair with Knotless SutureTak® Anchors",
    procedure: "SLAP Repair with Biceps Tenodesis",
    tags: [
      "slap",
      "biceps",
      "tenodesis",
      "long head",
      "subpectoral",
      "labrum",
      "labral",
      "type ii",
      "suturetak",
    ],
    youtubeId: "qnVb-UBELMA",
    channel: "What's New in Orthopedics",
    surgeon: "Peter J. Millett, MD, MSc",
    affiliation: "The Steadman Clinic — Vail, CO",
    publishedYear: 2017,
    description:
      "Arthroscopic SLAP repair using knotless SutureTak® anchors with technique pearls applicable to combined biceps tenodesis cases.",
    chapters: STANDARD_OPEN_CHAPTERS,
    paperIds: ["p-slap-tenodesis"],
    watchUrl: "https://www.youtube.com/watch?v=qnVb-UBELMA",
  },
  {
    id: "v-subacrom",
    title: "Arthroscopic Subacromial Decompression and Acromioplasty",
    procedure: "Subacromial Decompression",
    tags: [
      "subacromial",
      "decompression",
      "acromioplasty",
      "impingement",
      "ca ligament",
      "burr",
      "type iii acromion",
      "csaw",
    ],
    youtubeId: "Wah6b0kC9ao",
    channel: "JBJSmedia",
    surgeon: "JBJS Essential Surgical Techniques",
    affiliation: "Journal of Bone & Joint Surgery (peer-reviewed)",
    publishedYear: 2018,
    description:
      "Peer-reviewed JBJS Essential Surgical Techniques walkthrough of arthroscopic subacromial decompression with anterior acromioplasty for Type III acromion.",
    chapters: [
      { title: "Bursectomy & visualization", position: 0 },
      { title: "CA-ligament release", position: 0.22 },
      { title: "Anterior acromioplasty (burr)", position: 0.44 },
      { title: "Smoothing & contour check", position: 0.66 },
      { title: "Final irrigation & closure", position: 0.86 },
    ],
    paperIds: ["p-subacrom-rct"],
    watchUrl: "https://www.youtube.com/watch?v=Wah6b0kC9ao",
  },
];

/**
 * Lookup the most recent video matching a free-text query. Falls back to
 * the RTSA video (the OR's headline procedure) when no match is found,
 * matching the legacy behavior of HowToVideoModal.
 */
export function findLatestVideo(query?: string): ProcedureVideo {
  const fallback = PROCEDURE_VIDEOS.find((v) => v.id === "v-rtsa") ?? PROCEDURE_VIDEOS[0];
  if (!query) return fallback;
  const q = query.toLowerCase();

  const scored = PROCEDURE_VIDEOS.map((v) => {
    const haystack = [v.title, v.procedure, ...v.tags].join(" ").toLowerCase();
    let score = 0;
    for (const term of q.split(/\s+/).filter(Boolean)) {
      if (haystack.includes(term)) score += 1;
      if (v.tags.includes(term)) score += 2;
    }
    return { v, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.v.publishedYear - a.v.publishedYear);

  return scored[0]?.v ?? fallback;
}

/**
 * Given a query (procedure keyword, or paper title fragment), return
 * matching papers ranked by relevance + recency.
 */
export function findRelevantPapers(query?: string): ResearchPaper[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return RESEARCH_PAPERS.map((p) => {
    const haystack = [p.title, p.authors, ...p.tags].join(" ").toLowerCase();
    let score = 0;
    for (const term of q.split(/\s+/).filter(Boolean)) {
      if (haystack.includes(term)) score += 1;
      if (p.tags.includes(term)) score += 2;
    }
    return { p, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.year - a.p.year)
    .map((x) => x.p);
}

/** Resolve a paper by id, 1-based index within a list, or keyword. */
export function resolvePaper(
  pool: ResearchPaper[],
  query: { id?: string; index?: number; keyword?: string },
): ResearchPaper | undefined {
  if (query.id) {
    const byId = pool.find((p) => p.id === query.id);
    if (byId) return byId;
  }
  if (typeof query.index === "number" && query.index > 0) {
    const byIndex = pool[query.index - 1];
    if (byIndex) return byIndex;
  }
  if (query.keyword) {
    const k = query.keyword.toLowerCase();
    const exact = pool.find((p) => p.title.toLowerCase().includes(k));
    if (exact) return exact;
    const tagged = findRelevantPapers(query.keyword)[0];
    if (tagged && pool.some((p) => p.id === tagged.id)) return tagged;
  }
  return undefined;
}

/**
 * Static text summary of the library — included in the cached system
 * prompt so Claude knows what's available *before* it calls a tool.
 * This lets the agent narrate the title/author/year in the same turn
 * as the tool call, instead of needing a second round trip.
 */
export const LIBRARY_OVERVIEW = [
  `Available how-to videos (open via open_how_to_video; pick the closest procedure match):`,
  ...PROCEDURE_VIDEOS.map(
    (v) => `  - "${v.title}" — ${v.procedure} · ${v.surgeon} · ${v.channel} · ${v.publishedYear}`,
  ),
  ``,
  `Available research papers (open via open_research_papers; PMID-verified):`,
  ...RESEARCH_PAPERS.map(
    (p) => `  - "${p.title}" — ${p.authors} · ${p.journal} · ${p.year} (PMID ${p.pmid})`,
  ),
].join("\n");
