export const homeEditorialStyles = String.raw`
/* Discovery refresh: retain the existing live API data, cover fallbacks, and actions.
   This module is appended after legacy styles so the editorial view stays isolated. */
.discover-home { padding-bottom:56px; }
.discover-home .discover-banner { max-height:260px; aspect-ratio:auto; height:clamp(120px,19vw,260px); border-radius:16px; margin:10px 0 12px; }
.discover-home .discover-shelf { margin-top:32px; }
.discover-home .discover-shelf-head { margin-bottom:7px; padding:0 2px 12px; border-bottom:1px solid rgba(255,255,255,.10); }
.discover-home .discover-shelf-head small { margin-bottom:7px; color:#a9a49b; font-size:.68rem; font-weight:600; letter-spacing:.02em; text-transform:none; }
.discover-home .discover-shelf-head h2,
.discover-home .devteam-recommendations-title h2 { font-family:var(--workshop-content-font,system-ui); font-weight:780; font-size:clamp(1.16rem,2vw,1.55rem); color:#f3f0eb; line-height:1.25; }
.discover-home .discover-card-copy h3 { color:#f2efe9; font-size:.88rem; min-height:auto; }
.discover-home .discover-card-copy p,
.discover-home .discover-card-stats { color:#b6b1a9; font-size:.73rem; }
.discover-home .discover-card-cover-shell { border-radius:12px; }
.discover-home .discover-shelf-track { gap:16px; }
.discover-home .discover-shelf-item { flex-basis:clamp(164px,21%,224px); }

/* Edited recommendations are an editorial section, not a second DLC Kitchen billboard. */
.discover-home .devteam-recommendations { gap:10px; margin-top:28px; }
.discover-home .devteam-recommendations-title { padding:0 2px 11px; border-bottom:1px solid rgba(255,255,255,.10); }
.discover-home .devteam-recommendations-title small { margin-bottom:7px; color:#aaa49b; font-size:.68rem; letter-spacing:.03em; }
.discover-home .devteam-curator-block { border:0; background:transparent; box-shadow:none; overflow:visible; }
.discover-home .devteam-curator-head { padding:8px 0 11px; min-height:56px; background:transparent; border:0; gap:10px; }
.discover-home .devteam-curator-head:hover { background:transparent; }
.discover-home .devteam-curator-head img { width:40px; height:40px; border-radius:50%; }
.discover-home .devteam-curator-head h3 { font-size:.92rem; }
.discover-home .devteam-curator-head small,
.discover-home .devteam-curator-head p { color:#bab6b0; font-size:.73rem; }
.discover-home .devteam-curator-view-all { color:#d7c4a8; font-size:.73rem; }
.discover-home .devteam-curator-track { display:grid; grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr)); align-items:start; gap:14px; padding:0; }
.discover-home .devteam-recommend-item { min-width:0; }
.discover-home .devteam-recommend-item .discover-card-cover-shell { aspect-ratio:4/3; border-radius:11px; }
.discover-home .devteam-recommend-item:first-child .discover-card-cover-shell { aspect-ratio:1.4/1; }
.discover-home .devteam-recommend-comment { padding-top:7px; color:#c5c0b9; }
.discover-home .devteam-recommend-comment p { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; font-size:.74rem; line-height:1.45; }
.discover-home .devteam-recommend-item:first-child .discover-card-copy h3 { font-size:1.08rem; }
.discover-home .devteam-curator-arrow { top:56%; }
.discover-home .devteam-curator-dots { margin-top:12px; }

/* A genuinely different first shelf card, followed by smaller thumbnails. */
.discover-home .discover-shelf--spotlight .discover-shelf-item:first-child { flex-basis:clamp(255px,36%,380px); }
.discover-home .discover-shelf--spotlight .discover-shelf-item:first-child .discover-card-cover-shell { aspect-ratio:5/4; }
.discover-home .discover-shelf--spotlight .discover-shelf-item:not(:first-child) .discover-card-cover-shell { aspect-ratio:1/1; }
.discover-home .discover-shelf--spotlight .discover-shelf-item:first-child .discover-card-copy h3 { font-size:1.06rem; }
.discover-home .discover-shelf--spotlight .discover-shelf-item:not(:first-child) { flex-basis:clamp(162px,19%,210px); }

/* Updates: compact list rather than another line of identical big images. */
.discover-home .discover-shelf--compact .discover-shelf-item { flex-basis:clamp(265px,34%,380px); }
.discover-home .discover-shelf--compact .discover-card { display:grid; grid-template-columns:84px minmax(0,1fr); gap:13px; align-items:center; }
.discover-home .discover-shelf--compact .discover-card-cover-shell { aspect-ratio:3/4; }
.discover-home .discover-shelf--compact .discover-card-copy { min-width:0; padding:0; }
.discover-home .discover-shelf--compact .discover-card-copy-meta { display:block; }
.discover-home .discover-shelf--compact .discover-card-stats { margin-top:6px; }
.discover-home .discover-shelf--compact .discover-more-card { min-height:112px; }
.discover-home .discover-shelf--compact .discover-shelf-scroll { top:50%; }

@media (max-width: 1023px) {
  .discover-home .devteam-curator-track { display:flex; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; gap:12px; padding:0 4px 7px; scrollbar-width:none; }
  .discover-home .devteam-curator-track::-webkit-scrollbar { display:none; }
  .discover-home .devteam-recommend-item { flex:0 0 clamp(220px,64vw,310px); scroll-snap-align:start; }
  .discover-home .devteam-recommend-item:first-child .discover-card-cover-shell { aspect-ratio:4/3; }
  .discover-home .devteam-curator-arrow { display:none; }
  .discover-home .discover-shelf--spotlight .discover-shelf-item:first-child { flex-basis:min(75vw,330px); }
  .discover-home .discover-shelf--spotlight .discover-shelf-item:not(:first-child) { flex-basis:min(52vw,205px); }
}
@media (max-width: 600px) {
  .discover-home .discover-banner { height:clamp(112px,38vw,166px); border-radius:12px; }
  .discover-home .discover-shelf { margin-top:26px; }
  .discover-home .discover-shelf-head h2,.discover-home .devteam-recommendations-title h2 { font-size:1.22rem; }
  .discover-home .discover-shelf-item { flex-basis:min(46vw,196px); }
  .discover-home .discover-shelf-track { gap:12px; }
  .discover-home .discover-shelf--spotlight .discover-shelf-item:first-child { flex-basis:min(72vw,294px); }
  .discover-home .discover-shelf--spotlight .discover-shelf-item:not(:first-child) { flex-basis:min(46vw,186px); }
  .discover-home .discover-shelf--compact .discover-shelf-item { flex-basis:min(80vw,316px); }
  .discover-home .discover-shelf--compact .discover-card { grid-template-columns:76px minmax(0,1fr); gap:10px; }
  .discover-home .devteam-curator-head { padding:5px 0 10px; }
  .discover-home .devteam-recommend-item { flex-basis:min(72vw,282px); }
  .discover-home .devteam-curator-head p { display:none; }
}

/* Catalog, library and detail share the same quieter store language. */
.workshop-shell .projects-grid { gap:16px; grid-template-columns:repeat(auto-fill,minmax(218px,1fr)); }
.workshop-shell .project-card { border-radius:12px; background:#1b1c1f; box-shadow:none; }
.workshop-shell .project-card:hover { border-color:rgba(208,194,171,.32); }
.workshop-shell .my-projects-page-head { margin-top:18px; }
.workshop-library-head { display:flex; align-items:center; margin:18px 0 10px; padding:3px 2px 15px; border-bottom:1px solid rgba(255,255,255,.11); }
.workshop-library-head h2 { color:#f3f0eb; font-size:clamp(1.15rem,2vw,1.5rem); line-height:1.25; }
.workshop-library-head small { color:#c0a789; font-size:.7rem; }
.workshop-library-head p { margin-top:6px; color:#b7b3ad; font-size:.82rem; }
.project-detail-modal .detail-project-name { font-family:var(--workshop-content-font,system-ui); font-size:clamp(1.28rem,2.1vw,1.78rem); }
.project-detail-modal .detail-install-btn { border-radius:999px; }
.project-detail-modal .detail-cover { border-radius:12px; }
.workshop-shell .desktop-sidebar { box-shadow:none; }
@media (max-width: 600px) {
  .workshop-shell .projects-grid { grid-template-columns:repeat(auto-fill,minmax(min(100%,155px),1fr)); gap:10px; }
  .workshop-library-head { margin-top:10px; }
  .workshop-library-head p { line-height:1.5; }
}

`;