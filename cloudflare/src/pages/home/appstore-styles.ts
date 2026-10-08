export const homeAppStoreStyles = String.raw`
/* App Store-inspired: icon-and-text rows, not resized cover-card walls.
   All public rows keep existing cover loading and detail listeners. */
.discover-home.store-home { max-width:1120px; margin-inline:auto; padding:0 0 60px; }
.store-home .discover-banner { width:100%; height:clamp(70px,9vw,118px); min-height:0; max-height:118px; margin:12px 0 25px; border-radius:12px; overflow:hidden; }
.store-home .store-intro { padding:0 2px 9px; }
.store-home .store-intro small { display:block; color:#b7a082; font:750 .68rem/1.2 system-ui,sans-serif; letter-spacing:.11em; }
.store-home .store-intro h1 { font:760 clamp(1.55rem,2.7vw,2.2rem)/1.18 system-ui,"Microsoft YaHei",sans-serif; margin:9px 0 5px; color:#f6f5f3; }
.store-home .store-intro p { color:#bcbab5; margin:0; font-size:.85rem; line-height:1.6; }
.store-home .discover-shelf,.store-home .devteam-recommendations { margin:27px 0 0; display:block; }
.store-home .discover-shelf-head,.store-home .devteam-recommendations-title {
  min-height:0; display:flex; align-items:end; justify-content:space-between; gap:16px;
  padding:0 0 11px; margin:0 0 4px; border:0; border-bottom:1px solid rgba(255,255,255,.16);
}
.store-home .discover-shelf-head small,.store-home .devteam-recommendations-title small {
  display:block; margin:0 0 6px; color:#b8a88e; font:650 .68rem/1.2 system-ui,sans-serif; letter-spacing:.025em;
}
.store-home .discover-shelf-head h2,.store-home .devteam-recommendations-title h2 {
  margin:0; color:#f4f2ef; font:760 clamp(1.14rem,2vw,1.4rem)/1.2 system-ui,"Microsoft YaHei",sans-serif;
}
.store-section-more { align-self:center; flex:none; padding:9px 2px 9px 12px; border:0; background:transparent; color:#cbb59a; font:.78rem system-ui,sans-serif; cursor:pointer; }
.store-section-more:hover { color:#fff; }
.store-home .discover-shelf-track { min-width:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 22px; overflow:visible; scroll-snap-type:none; padding:0; margin:0; }
.store-home .discover-shelf-item { min-width:0; width:auto; display:block; flex:none; padding:0; scroll-snap-align:none; }
.store-home .discover-shelf-track-shell { overflow:visible; }
.store-row { position:relative; min-height:84px; display:flex; flex-direction:row; align-items:center; gap:12px; padding:11px 3px;
  border:0; border-bottom:1px solid rgba(255,255,255,.08); background:transparent; box-shadow:none; border-radius:0;
  cursor:pointer; min-width:0; transition:background .13s ease; outline:none; }
.store-row:hover { background:rgba(255,255,255,.035); }
.store-row:focus-visible { outline:2px solid #d8bd96; outline-offset:-2px; border-radius:7px; }
.store-row-rank { width:24px; flex:0 0 24px; color:#a9a9a9; font:700 1.08rem/1.2 system-ui,sans-serif; font-variant-numeric:tabular-nums; text-align:center; }
.store-row .discover-card-cover-shell { flex:0 0 62px; width:62px; height:62px; aspect-ratio:1/1;
  border-radius:13px; overflow:hidden; background:#292b30; border:1px solid rgba(255,255,255,.12); box-shadow:none; transform:none; }
.store-row:hover .discover-card-cover-shell { transform:none; box-shadow:none; }
.store-row .discover-card-cover { width:100%; height:100%; background-size:cover; }
.store-row .discover-card-cover--title { display:grid; place-items:center; padding:7px; background:linear-gradient(135deg,#495064,#2a303b); }
.store-row .discover-card-cover--title span { max-width:100%; font:.66rem/1.27 system-ui,sans-serif; text-align:center; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
.store-row-copy { min-width:0; flex:1 1 auto; display:flex; flex-direction:column; gap:3px; }
.store-row-copy h3 { color:#f1efea; margin:0; font:690 .91rem/1.35 system-ui,"Microsoft YaHei",sans-serif;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.store-row-by { margin:0; color:#aaa9a6; font:.74rem/1.3 system-ui,"Microsoft YaHei",sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.store-row-stats { display:flex; align-items:center; gap:6px; color:#928f8a; font:.68rem/1.25 system-ui,sans-serif; font-variant-numeric:tabular-nums; }
.store-row-stats i { font-size:.63rem; }
.store-row-open { display:inline-flex; flex:0 0 auto; justify-content:center; min-width:53px; padding:7px 10px; background:#2d3440; color:#d8c6b0; border-radius:999px; font:.77rem/1.1 system-ui,sans-serif; font-weight:740; }
.store-row:hover .store-row-open { background:#4c4550; color:#fff; }

/* Editor selections are compact lists, never a large cover carousel. */
.store-home .devteam-curator-track { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 22px; padding:0; }
.store-home .devteam-recommend-item { min-width:0; }
.store-home .devteam-recommend-item .discover-card-cover-shell { border-radius:13px; }

/* Catalog: publicly browsable works use the same compact rows. Keep editable cards
   unchanged for authenticated authors/admins to retain their management actions. */
.workshop-shell .projects-grid.store-catalog { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 22px; display:grid; margin:0 0 16px; }
.workshop-shell .projects-grid.store-catalog .store-row { height:auto; }
.workshop-shell .projects-grid.store-catalog .projects-empty { grid-column:1/-1; }
.workshop-shell .desktop-sidebar { box-shadow:none; }

/* Existing daily draw remains reachable, but does not dominate the browse page. */
.store-home .daily-random-draw-entry { max-height:135px; overflow:hidden; }
@media (max-width:760px) {
 .store-home .discover-shelf-track,.store-home .devteam-curator-track,.workshop-shell .projects-grid.store-catalog { grid-template-columns:minmax(0,1fr); gap:0; }
 .store-home .store-intro h1 { font-size:1.56rem; }
 .store-home .discover-banner { height:clamp(58px,19vw,80px); margin:8px 0 18px; border-radius:9px; }
 .store-home .discover-shelf,.store-home .devteam-recommendations { margin-top:22px; }
 .store-row { min-height:76px; gap:10px; padding:9px 1px; }
 .store-row .discover-card-cover-shell { flex-basis:54px; width:54px; height:54px; border-radius:12px; }
 .store-row-copy h3 { font-size:.88rem; }
 .store-row-open { min-width:48px; padding:7px 8px; font-size:.72rem; }
 .store-row-rank { width:20px; flex-basis:20px; font-size:.95rem; }
}
@media (max-width:375px) {
 .store-row .discover-card-cover-shell { width:50px; height:50px; flex-basis:50px; }
 .store-row-copy { gap:2px; }
 .store-row-rank { width:18px; flex-basis:18px; }
 .store-row-open { min-width:42px; padding:6px 7px; }
}
`;
