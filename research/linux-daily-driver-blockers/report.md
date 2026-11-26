# Linux Daily Driver Blockers — Research Report

## Summary

**What prevents people using Linux as a daily driver is rarely one catastrophic failure. Across first-person trials, challenge videos and forum reports the pattern is: (1) one hard, non-negotiable blocker for that person's job/game/school, plus (2) a pile-up of small friction that costs time until they quit.** XDA's synthesis of beginners puts it explicitly: "most beginners don't leave after a single catastrophic failure. They leave because of a slow accumulation of small frustrations" [XDA, Jan 2026, index].

Ranked hard blockers (appear in almost every source, and are sufficient alone to force dual-boot/return):
1. **A specific proprietary app with no native Linux version and no adequate substitute** — above all Adobe Creative Cloud and Microsoft Office 365, then Fusion 360 / other CAD, Ableton Live / FL Studio / Pro Tools, and employer/school-mandated tools.
2. **Kernel-level anti-cheat in multiplayer games** — Valorant/League, Fortnite, Apex Legends (support withdrawn Oct 2024), Destiny 2, GTA Online, Call of Duty, Battlefield/EA titles, Escape from Tarkov.
3. **Work/school lock-in the user cannot choose** — proctoring software that explicitly bans Linux, narrow MDM/Intune support, employer VPN/endpoint tools.
4. **A piece of hardware/peripheral that doesn't work, or works without its vendor software** — especially on laptops: fingerprint, Wi-Fi, Bluetooth audio, sleep drain, hybrid/Nvidia GPUs, fan/RGB/peripheral apps.

Ranked friction (works, but costs time — the actual quitting mechanism for many general users): choice overload (distro × desktop × packaging × X11/Wayland), terminal-delivered fixes, updates/kernel changes breaking drivers, unpredictable per-game/per-file behaviour, and having to self-support via forums. Confidence: high for the ranking — it repeats across enthusiast, mainstream-tech-press and hostile-to-Linux sources alike. Caveat: the public record is skewed — see Could Not Verify.

## Findings

### 1. Recurring blockers ranked — concrete vs friction

**Concrete blockers** (specific thing fails, no workaround the user accepts):
- Missing app (Adobe, Office, CAD, DAW — §2)
- Blocked game (anti-cheat — §3)
- Blocked exam / job access (proctoring, MDM — §6)
- Hardware function absent: e.g. a 2020 week-long Pop!_OS trial on an AMD laptop found no Wi-Fi driver at all — and fixing it required internet access [UpThrust, 2020, index: http://upthrust.co/2020/10/i-tried-linux-and-changed-back-to-windows/amp]

**Friction / annoyance** (works, eventually, at a time cost):
- **Pile-up effect:** XDA (Jan 2026) lists fingerprint reader not working, function keys odd, Bluetooth audio reconnecting inconsistently, sleep draining battery overnight, external monitors waking in wrong order — individually ignorable, collectively the reason people leave [https://www.xda-developers.com/5-reasons-why-linux-beginners-always-end-up-going-back-to-windows/, index].
- **Time as the price:** XDA's "I regret switching to Linux" (2026): "Linux is only 'free' to an extent — the cost is your time"; the author was "too tired of fiddling with settings to even enjoy a game" [https://www.XDA-Developers.com/i-regret-switching-to-linux-even-though-i-wanted-to-love-it/, index]. The Verge's successful switcher (§7) quantifies the same cost from the other side: "dozens of hours combing through Reddit threads, analyzing old Stack Overflow solutions" in a year.
- **Unpredictability, not just incompatibility:** XDA's 30-day gaming trial (Oct 2025, §3/§8) returned to Windows primarily because games that *did* work crashed randomly — unpredictability, explicitly distinct from the anti-cheat titles he was willing to dual-boot for.

Distinguish anecdote vs pattern: the pile-up, time-cost and unpredictability themes appear in at least 4 independent sources each (XDA ×3, MakeUseOf, LTT 2021 and 2026, Verge). Single-anecdote items (e.g. one laptop's Wi-Fi) are flagged as such below.

### 2. Software gaps — specific apps/categories

This is the #1 category. Four distinct mechanisms recur — do not conflate them:

**a) App itself missing, no native version:**
- **Adobe Creative Cloud — Photoshop, Premiere Pro, After Effects, Lightroom.** Cited in nearly every source. XDA Jun 2025: workflow is Photoshop/Premiere/AE; MakeUseOf May 2026: Adobe CC and Office 365 "are not natively available… Wine… tied to Windows-specific services like DRM, cloud syncing… won't work or will randomly crash" [https://www.makeuseof.com/linux-tempting-but-these-windows-features-keep-pulling-me-back/, verified live/open]. How-To Geek Apr 2026: lack of first-party support for "Fusion 360, the Adobe suite, and other software that I rely on daily" is the stated reason [https://www.howtogeek.com/why-i-dont-use-linux-on-my-desktop/, index].
- **Microsoft Office 365 desktop** — same sources. Web Office and LibreOffice are the usual substitutes; see (b).
- **Engineering/CAD/CAM:** Fusion 360 (Autodesk staff on its own forum: "Fusion is not supported on Linux and there are no plans to do so… no major CAD players… [have] a current version natively on Linux"), SolidWorks, AutoCAD; How-To Geek also cites CNC-machining software that is Windows-only even vs macOS [https://forums.autodesk.com/t5/fusion-design-validate-document/does-autodesk-fusion-360-support-linux-os/m-p/10769576, index].
- **Music production:** No Ableton Live, FL Studio, Cubase, Pro Tools, or Logic Pro. LinuxAudio.dev FAQ: DAWs *do* exist (Bitwig Studio, Reaper, Ardour, Mixbus) but "when it comes to… audio software and plugins, Linux still lags," iLok is not available for Linux, and audio-interface driver/software support is limited [https://www.linuxaudio.dev/frequently-asked-questions, index].
- **Video/photo pro:** Premiere/After Effects and Final Cut Pro missing; CapCut desktop, Descript, ScreenFlow/Camtasia-style tools cited as gaps for creators [https://yarygintech.com/articles/linux-for-content-creators-edit-record-publish/, index].

**b) File-format / collaboration compatibility (app exists, ecosystem doesn't):**
- Premiere **.prproj project files shared with collaborators/clients** — dual-boot is "your only option" if deliverables depend on them, regardless of how good Kdenlive/DaVinci are for solo work (creator analyses, index).
- Office fidelity: LibreOffice/OnlyOffice open .docx/.xlsx but formatting, fonts, macros and advanced Excel features are the recurring complaint in forum/MakeUseOf accounts; several switchers report keeping Office web or a Windows VM for client documents. Evidence here is mostly repeated assertion rather than controlled testing — flag as pattern-of-claims, not measured.
- Photoshop .PSD / plugin ecosystems: GIMP historically missing non-destructive editing; Affinity via Wine "doesn't really work well yet" and rasterizes text layers in PSDs (Lemmy discussion, index).

**c) Plugin ecosystem:** Premiere/AE commercial plugins, VST/AU music plugins and iLok-licensed plugins, Photoshop plugins — even where a host alternative exists, the plugin library the user paid for/trained on does not transfer. An Autodesk forum user sums the lock-in across categories: "only three things hold me back from using Linux for my daily driver: Lack of Office, Ableton Live and Fusion 360… there are good alternatives there, if I'm willing to trash my substantial license investment and know-how, which I'm not yet" — and a Windows VM fails for Fusion/Ableton because of inadequate GPU passthrough [Autodesk forum, index].

**d) Alternative exists but lags / retraining cost:** XDA Jun 2025 is honest that this is partly unwillingness to relearn: "I'm just not willing to learn another application at the moment… if this were the only thing holding me back, I might just bite the bullet" [https://www.xda-developers.com/3-things-linux-needs-to-have-before-i-can-make-the-swap/, index]. DaVinci Resolve is the major exception — native on Linux and genuinely pro — **but** the free version on Linux lacks H.264/H.265 codec support that the Windows/Mac free versions have, a hidden trap repeatedly flagged for creators. OBS Studio, Blender, VS Code, browsers, Slack/Zoom web, and dev tools are *not* gaps — multiple sources praise them.

Categories with adequate coverage (counterweight): software development (often *better* on Linux), web/office-light work, 3D (Blender is native/first-class), streaming/recording (OBS native).

### 3. Gaming

**What works now:** Most single-player Steam libraries via Proton. Even returners concede this: XDA Oct 2025 was "shocked at just how many games in my library supported Linux… they ran just as well, or even better"; The Verge's year-long user: "Everything in my Steam library runs great with Proton."

**Hard block — publisher anti-cheat decisions, not technical limits.** Current status from anti-cheat tracking summaries (Nov 2026 check) [https://www.fosslinux.com/164288/moving-from-windows-to-linux-gaming.htm, index]:
| Game | Anti-cheat / publisher position | Status |
|---|---|---|
| Valorant, League of Legends | Riot Vanguard, kernel-mode, no Linux build; Riot says Linux can't attest boot/kernel state | Blocked, no plan |
| Fortnite | Epic has not enabled Easy Anti-Cheat Proton mode | Blocked |
| Apex Legends | EA withdrew Linux/Steam Deck access 31 Oct 2024 ("no reliable way to differentiate a legitimate Steam Deck from a malicious cheat"); later moved to EA Javelin | Blocked — a *regression*: it used to work |
| Destiny 2 | Bungie does not support Proton; bypass attempts "met with a game ban" | Blocked, ban risk |
| GTA Online | BattlEye added Sep 2024, Rockstar hasn't enabled Linux mode (Story Mode runs) | Online blocked |
| Call of Duty / Warzone | Ricochet, no Linux version | Blocked |
| Battlefield 6 / EA FC online | EA Javelin kernel anti-cheat | Blocked |
| Escape from Tarkov | BattlEye implementation doesn't support Linux | Blocked |

Easy Anti-Cheat and BattlEye *can* support Linux/Proton — the developer must opt in. That opt-in model is why this persists (§9).

**Other gaming friction cited:**
- **Unpredictability/crashes in supported games:** War Thunder and Arma Reforger crashing randomly with unhelpful errors in XDA's 30-day Ubuntu trial (Radeon RX 9070 XT, Mesa drivers didn't fix it) — the author's actual deal-breaker [https://www.xda-developers.com/gaming-on-linux-still-isnt-perfect-heres-why-i-switched-off-of-it/, verified open].
- **Launchers:** non-Steam launchers (EA App — reported broken/installer not finishing in tracker summaries; Battle.net, Epic, Ubisoft) require workarounds (Lutris/Heroic/non-Steam Proton entries). The Verge user got WoW working only by adding Battle.net as a non-Steam game.
- **Peripherals/VR:** Meta Quest PC Link app is Windows-only (ALVR+SteamVR is the workaround); racing wheels, capture cards and vendor RGB/peripheral software have partial community coverage (OpenRazer, Oversteer) rather than vendor tools.
- **Performance nuance:** competitive players report titles that *run* (e.g. Counter-Strike 2, native) still "feel" less responsive/input-lag differences vs Windows — single-source claim (Mem's Tech Tips), treat as anecdote. Day-one releases and mods/mod managers are also recurring forum complaints, evidence thinner.

### 4. Hardware and drivers

Pattern: **desktops and ThinkPad/Framework-class laptops are usually fine; brand-new laptops, hybrid-GPU laptops, and peripherals dependent on Windows vendor software are where accounts break down.**

- **Nvidia GPUs:** the single most-named hardware villain in older and many recent accounts. XDA regret piece: kernel updates broke Nvidia drivers requiring recompiling/fixing repeatedly, and getting full GPU power working was a struggle. MakeUseOf: closed drivers "delayed and generally just broken," improving with open kernel modules from RTX 20/40-series onward but still behind AMD/Intel. Counterpoint: Pop!_OS Nvidia edition / distro-packaged drivers make this a non-event for many 2024-25 users — hardware- and distro-dependent, not universal.
- **Hybrid graphics (iGPU+dGPU laptops):** UpThrust 2020: no automatic GPU switching, high idle temps, worse battery; still cited in 2025-26 laptop-fix guides (PRIME offload incantations, external HDMI ports wired to dGPU, black screen after driver install / Secure Boot MOK enrollment).
- **Wi-Fi:** chipset-dependent (Broadcom and some newer MediaTek/Realtek modules historically worst); the catch-22 anecdote — no Wi-Fi driver, fix requires internet — recurs. Most Intel Wi-Fi is fine out of box.
- **Bluetooth:** inconsistent audio reconnect/pairing, cited in XDA pile-up list; LTT 2026 cited Xbox controller pairing friction.
- **Fingerprint readers:** frequently simply unsupported (vendor has no Linux driver) — in XDA pile-up list; some ThinkPads work via libfprint, many don't.
- **Sleep/suspend & battery:** s2idle/Modern Standby-only laptops draining in a bag ("hot bag"), battery life shorter than Windows due to power tuning/vendor optimisations being Windows-side, sleep draining overnight (XDA pile-up). This remains one of the most consistent *laptop-specific* complaints in 2024-25 accounts.
- **HiDPI / fractional scaling / multi-monitor:** Historically blurry X11 apps under fractional scaling. Now: Wayland (GNOME/KDE) handles per-monitor and fractional scaling much better, but XWayland apps still blur, and MakeUseOf (2026, index) notes XWayland apps "don't do well with fractional scaling" and mixed-refresh-rate inconsistency. Monitors waking in wrong order/arrangement also in pile-up lists.
- **Docking:** Thunderbolt docks mostly work in recent accounts (improved vs 5 years ago), but dock + hybrid GPU + external display routing still generates failure reports; evidence is anecdotal.
- **Printers/scanners:** CUPS works for many printers (often better than Windows for old models), but multifunction scanner/vendor software and some newer printers remain pain points — cited less often in 2024-25 than 2015-20, suggesting improvement; thin recent evidence either way.
- **Webcams/mics:** usually work (UVC class devices); vendor noise-cancellation / camera-effect software does not. Wayland screen-sharing/capture was a major early-2020s complaint (PipeWire portals fixed much of it); LTT 2026 still cited display capture on Wayland as friction for streaming/recording workflows.
- **Peripheral vendor software absent:** Razer Synapse, Logitech G Hub, Corsair iCUE, fan-curve/RGB/battery-optimisation utilities — hardware works at basic level, full feature set (macros, DPI profiles, fan curves) requires Windows app or community replacements (OpenRazer, Piper, Solaar) [MakeUseOf, verified open].

### 5. System / UX friction

- **Choice/fragmentation as a first hurdle:** MakeUseOf Mar 2026 (long-time Linux user quitting): the user must choose distro, desktop (GNOME vs KDE vs Cinnamon — "materially different" daily), update philosophy (rolling vs stable — determines "when a Wi-Fi chip starts working or when a GPU regression is resolved"), packaging (Snap vs Flatpak vs native — none "universally right"), and display server (X11 vs Wayland mid-transition) [https://www.makeuseof.com/i-cant-use-linux-as-my-daily-driver-anymore/, index]. XDA adds "choosing the wrong distro / wrong desktop environment" as a top beginner-quitting cause — e.g. starting on Arch and drowning.
- **Terminal dependency:** fixes and even normal tasks arrive as terminal commands in forum answers. The Verge stayer: terminal is "an unavoidable part of the Linux experience, even with… Snap Store and Flathub." LTT 2021 is the canonical demonstration (§8). Note: modern Mint/Ubuntu/KDE users can do most daily tasks in GUI — the complaint is specifically that *when something goes wrong*, the fix is a command.
- **Updates breaking things:** kernel updates breaking Nvidia/out-of-tree drivers (XDA), rolling-release (Arch-family) update breakage cited by multiple returners; conversely LTS/Mint users report boring stability. Distro-dependent, but the *fear* is widely cited.
- **Codec/DRM streaming:** no native Netflix/Prime/Disney+ apps; browser playback capped by Widevine L3 on Linux — sources disagree on the exact cap: one recent summary says 720p SD and no HDR [https://daily.dev/posts/linux-finally-has-working-hdr-but-you-still-can-t-use-it-for-most-streaming-services-5kvkjhtdt, index], MakeUseOf says browser limit 1080p. Report as **720p–1080p depending on service/browser, no 4K/HDR** — the consistent point is it is worse than Windows/Edge or a native app. HDR itself: Wayland-only, inconsistent washed-out/gamma issues, HDMI 2.1 VRR broken on AMD Linux (HDMI Forum licensing) [MakeUseOf, verified open].
- **Office file fidelity & fonts:** .docx/.xlsx rendering differences, missing Microsoft fonts (Calibri etc.) changing pagination, Excel macros/VBA not working in LibreOffice — forces web Office or VM for collaborative/professional documents. Pattern-of-claims; few sources do side-by-side tests.
- **Workflow differences:** PDF signing, adding fonts, compressing/uploading files were unexpectedly hard in LTT Pt.3's timed simple-tasks test (2021); file-manager differences, middle-click paste, screenshot tools, and "doesn't work like Windows therefore broken" friction recur. Some of this is genuine missing polish, some is unfamiliarity — LTT's own community critics made that point forcefully.
- **Support burden / community:** no vendor to call; support = forums/Discord/Reddit. Experiences split sharply: stayers praise community help; returners cite "RTFM"/hostile replies and contradictory distro advice ("you chose the wrong distro" in response to any problem — noted even by XDA's sympathetic gaming returner, who pre-empts comments saying he configured it wrong). LTT 2026 cited "inconsistent community responses."

### 6. Work / school lock-in

Often absolute, and not the user's choice:
- **Proctoring/exam software explicitly bans Linux:** Pearson VUE OnVUE (used by NICET and many cert bodies): "All Linux/Unix Operating Systems are strictly prohibited" [https://www.nicet.org/exams/remote/, index]. Examity: "does not support Linux or Chrome OS" [https://www.queensu.ca/registrar/academic-info/exams/remote-proctoring/examity, index]. ProctorU/Guardian Browser: Linux listed unsupported. The irony is documented by the Linux Professional Institute itself: OnVUE supports only Windows/macOS, so Linux-certification candidates must find a Windows/Mac machine or test in person; LPI has lobbied Pearson since OnVUE launched [https://www.lpi.org/onvue_linux_support/, index]. Respondus LockDown Browser and similar school tools are likewise Windows/Mac-only (widely reported; not separately verified here).
- **MDM / device compliance:** Microsoft Intune *does* now enrol Linux — but only Ubuntu Desktop 22.04/24.04 LTS and RHEL 8/9, GNOME, x86_64, and corporate-owned devices only; personal-device enrolment not supported [https://LEARN.MICROSOFT.COM/en-us/intune/intune-service/user-help/enroll-device-linux, index]. Any other distro, or an employer whose Conditional Access requires full Intune compliance/endpoint agent (CrowdStrike, GlobalProtect, Zscaler, Cisco Secure Client — Linux clients exist for some, with reduced features/parity lags), can lock a Linux user out of email/VPN/internal apps. In practice many employers simply issue a Windows/Mac laptop and forbid alternatives — the most common form of this blocker, and the least documented in public first-person posts (people don't blog about IT policy).
- **Collaboration mandates:** Teams/Zoom *do* work on Linux (native/web) — not blockers per se — but feature lag (Teams Linux client historically behind, screen-share on Wayland quirks), plus mandated Office desktop for shared documents, pulls office workers back. Evidence: moderate, mostly forum-level.
- **VPN:** mainstream VPNs (WireGuard/OpenVPN native; major commercial clients) generally work; proprietary corporate VPN/zero-trust agents are the exception that generates "can't do my job" posts.

### 7. Who gives up vs who stays

| User type | Typical outcome | Why |
|---|---|---|
| Competitive multiplayer gamer (Valorant/Fortnite/Apex/CoD with friends) | Gives up / dual-boots | Anti-cheat hard block; social lock-in — friends are on those titles |
| Creator in Adobe ecosystem / client work | Gives up / dual-boots | Premiere/Photoshop files, plugins, collaborators; alternatives don't read the workflow |
| Engineer/CAD, CNC, specialised Windows business software | Gives up | Fusion/SolidWorks/CNC/industry apps Windows-only; VM GPU passthrough inadequate |
| Office worker in Microsoft-365 org / student with proctored exams | Gives up or never allowed | Employer/school mandates (§6); Office fidelity |
| Developer / sysadmin / data (Python etc.) | **Stays** — highest success rate | Toolchain is native/better on Linux; terminal is a plus, not friction |
| Casual/web-centric user (browser, media, light office) | **Stays if hardware cooperates** | Almost everything is a web app; LibreOffice suffices; failure mode is a laptop hardware pile-up, not software |
| Single-player / indie gamer | **Stays** | Proton covers library; may accept losing 1-2 titles |
| Privacy/tinker-motivated switcher (incl. PewDiePie-type) | **Stays** | Motivated by leaving Windows/Google, willing to pay time cost; customisation is the reward |

**What stayers say they accepted/worked around** (Verge year-long user, LTT 2026 Luke/Elijah, developer retrospectives):
- Replaced, not replicated, apps: LibreOffice for Office, RawTherapee for Lightroom, GIMP/Krita, DaVinci/Kdenlive — and accepted relearning.
- Accepted losing anti-cheat titles ("I don't play these types of games, so that didn't matter to me" — Verge).
- Accepted self-support as the model: dozens of hours in forums; learning fstab, Flatpak permissions, Proton launch options. The Verge verdict: "Linux isn't especially complicated on a daily basis, but you have to be willing to solve your own problems" [https://copyinvisible.com/i-spent-a-year-on-linux-and-forgot-to-miss-windows/, verified open].
- Often keep an escape hatch: dual-boot, a second Windows/Mac machine, or a work-issued laptop — "pure" single-OS switchers are the minority even among success stories. LTT 2026: Luke and Elijah stayed primarily on Linux; Linus — whose job is reviewing Windows hardware/games — did not (§8).
- Chose boring/stable setups (Mint, Fedora, Ubuntu LTS, Bazzite for gaming) and Linux-friendly hardware (AMD GPU, ThinkPad/Framework) rather than fighting hostile hardware.

### 8. Notable specific videos / creators / articles

1. **Linus Tech Tips — "Linux HATES Me – Daily Driver Challenge" Pt.1-4, Nov-Dec 2021.** Linus Sebastian + Luke Lafreniere, ~1 month. Linus chose Pop!_OS, Luke Linux Mint. Pt.1 (2021-11-09, ~4.5M views in index): installing Steam via apt on Pop!_OS prompted removal of essential packages `pop-desktop`/`pop-session`; Linus typed "Yes, do as I say!" at the warning and deleted his desktop environment, booting to a shell — it prompted an actual apt fix (apt 2.3.12 no longer removes Essential packages). Pt.3 (Dec 4, 2021): timed simple tasks — digitally signing PDFs, adding fonts, compressing/uploading proved unexpectedly difficult. Deal-breakers were cumulative UX/terminal/gaming friction, not one app. [https://hacker-tube.org/watch/0506yDSgU7M, index]. Caveat: heavily criticised within Linux community for ignoring warnings/copy-pasting commands — both readings are in the record.
2. **Linus Tech Tips — Linux Challenge revisit, "FINE! I'll Try Linux ONE MORE TIME…" / "I Don't Think I Can Go Back To Windows…", Mar-Jun 2026** (note: *after* the 2024-25 window the mission emphasised — included because it is the direct sequel). Linus (Bazzite), Luke, Elijah (CachyOS), >1 month. Verdict split: Luke and Elijah stayed primarily on Linux; Linus praised speed/Proton game compatibility but stayed on Windows for his reviewer workflow and unsupported anti-cheat games. Remaining friction named: Wayland display capture, Xbox controller pairing, middle-mouse/search behaviour, inconsistent community help. The contrast with 2021 is itself the best §9 evidence. [https://rosetta.to/u/linustechtips/2026, index]
3. **The Verge — Stevie Bonifield, "I spent a year on Linux and forgot to miss Windows", Jan 2025 switch, published ~Jan 2026.** Ubuntu → Fedora/KDE, full year, work+gaming+photo/video. **Stayed.** See §7 for accepted trade-offs; explicitly names Fortnite/Valorant anti-cheat and terminal aversion as legitimate deal-breakers for others. [https://copyinvisible.com/i-spent-a-year-on-linux-and-forgot-to-miss-windows/, verified open — mirror of Verge piece]
4. **XDA — Ty, "Gaming on Linux still isn't perfect — here's why I switched off of it", Oct 1, 2025.** Ubuntu, 30 days dual-boot, RX 9070 XT. **Gave up** on unpredictability (War Thunder, Arma Reforger crashes), not primarily anti-cheat — he was willing to keep a Windows drive for Battlefield 6/Tarkov. [verified open, URL in §3]
5. **XDA — "I regret switching to Linux, even though I wanted to love it", 2026.** **Gave up:** Apex anti-cheat withdrawal, Nvidia drivers breaking on kernel updates, proprietary accessories never working, time cost. [index, URL in §1]
6. **PewDiePie (Felix Kjellberg) — "I switched to Linux" / ricing videos, Apr 2025.** Linux Mint → Arch + Hyprland. **Stayed** — the highest-profile *successful* creator switch; motivated by leaving Windows/Google, de-Googling (Nextcloud etc.). Not a failure case; useful as the counter-example showing motivation/hardware choice predict success. [index]
7. **MakeUseOf — "I can't use Linux as my daily driver anymore", Mar 2026.** A *decade-long* Linux user quitting, not a beginner: reasons are fragmentation/choice burden and changed form-factor needs — evidence that attrition isn't only newbies. [index]
8. **Reddit/forum pattern (no single canonical thread verified):** r/linux, r/linux_gaming, distro subreddits and Lemmy recur on the same short list — Adobe, anti-cheat, Office, "one program" (e.g. Arturia music software, FL Studio in a 4chan /g/ "why did you go back" thread, index) — plus the Autodesk forum Fusion thread (§2) as a representative first-person artefact. Treat forum evidence as pattern-confirming, not quantified.

### 9. Changes over time — what improved, what persists

**Common 3-5+ years ago, cited much less / materially improved by 2024-25:**
- **"Games don't run on Linux" (general):** Proton/Steam Deck (2022 onward) flipped the default — most single-player libraries now work; even returners concede this. LTT 2021→2026 contrast is the emblem.
- **Installing Nvidia drivers / basic drivers generally:** distro-packaged drivers, Pop!_OS/Bazzite/Nobara/CachyOS gaming images, and kernel inclusion mean the 2015-era compile-your-driver story is now a minority (new-hardware) experience.
- **Wayland basics:** fractional scaling, multi-monitor mixed DPI, screen sharing via PipeWire portals, Nvidia-on-Wayland (driver 555+) — all substantially matured 2023-25. Remaining complaints are edge cases (XWayland blur, capture, HDR) not "Wayland is unusable."
- **App availability for everyday life:** Flatpak/Flathub made installing Slack/Discord/Spotify/Zoom etc. one-click; browsers, OBS, Blender, DaVinci, VS Code native. The old "can't even install normal apps / MP3 codecs" class of complaint has largely vanished.
- **Wi-Fi/printers out of box** on mainstream (especially Intel-based) hardware: improved, fewer reports.

**Persisting in 2024-2025 (and 2026 follow-ups) — essentially unchanged:**
- **Adobe Creative Cloud and Office desktop: still no native Linux versions, no announced plans.** The #1 blocker in 2020 is the #1 blocker in 2025.
- **Kernel anti-cheat:** if anything *regressed* — Apex withdrew support (Oct 2024), GTA Online added BattlEye (Sep 2024), EA moved to kernel Javelin. EAC/BattlEye opt-in exists but top publishers don't opt in.
- **Proctoring/MDM lock-in:** OnVUE still Windows/Mac only despite years of LPI lobbying; Intune Linux support exists but is narrow (Ubuntu/RHEL only).
- **Laptop power/sleep:** s2idle drain and shorter battery vs Windows still routinely reported; no structural fix because tuning is vendor/Windows-centric.
- **Peripheral vendor software, fingerprint readers, CAD/DAW niches (Fusion, Ableton, iLok/plugins), streaming DRM caps (no 4K/HDR).**
- **The meta-complaint:** "free as in time" / self-support burden and fragmentation choice — present in 2021 LTT, present in 2026 quitters.

Net trajectory in the sources: **the floor rose dramatically (a web+Steam+dev user in 2025 has a genuinely good experience), the ceiling blockers did not move, because they are publisher/vendor business decisions, not Linux engineering gaps.**

## Could not verify / limitations

- **Evidence base is skewed:** public first-person accounts over-represent (a) tech-press listicles (XDA/MakeUseOf/How-To Geek publish many near-identical "dealbreakers" pieces — several cited here are *prospective* ("keeps me from switching") rather than reports of an actual trial, notably MakeUseOf May 2026), (b) enthusiasts who succeeded, and (c) gamers/creators. Ordinary office workers who quietly fail rarely publish. No reliable survey quantifying blocker frequency was found — ranking is by recurrence across sources, not measured incidence.
- **Dates:** several indexed sources are dated 2026 (the research date is Nov 2026 per the mission clock); the mission asked especially for 2024-2025 persistence — 2026 sources were used for that check and flagged where used (LTT sequel). A few search-index dates/attributions (e.g. a "Proton 11 / Steam 3.95% Oct 2026" tracker article) could not be independently corroborated and were not relied on for core claims.
- **Streaming cap discrepancy:** 720p (Widevine L3 summary) vs 1080p (MakeUseOf) — reported as a range in §5.
- **Reddit:** direct Reddit threads were not opened (index results surfaced few specific threads); forum pattern claims rest on Lemmy/Autodesk/4chan mirrors and secondary citations — thinner than the video/article evidence.
- No page instructions were followed; all pages were treated as source material only. One search result was flagged by the system as failing an injection check — nothing in it was acted on beyond ordinary source evaluation.

## Sources

Index = found/read via web search index; Open = full page opened and read, 2026-11-25.

- XDA, Gaming on Linux still isn't perfect, Oct 1 2025 — Open — https://www.xda-developers.com/gaming-on-linux-still-isnt-perfect-heres-why-i-switched-off-of-it/
- MakeUseOf, Linux is tempting but these 6 dealbreakers…, May 13 2026 — Open — https://www.makeuseof.com/linux-tempting-but-these-windows-features-keep-pulling-me-back/
- The Verge / Bonifield, I spent a year on Linux…, Jan 2025-26 — Open (mirror) — https://copyinvisible.com/i-spent-a-year-on-linux-and-forgot-to-miss-windows/
- XDA, 5 harsh realities…, Jan 2026 — Index — https://www.xda-developers.com/5-reasons-why-linux-beginners-always-end-up-going-back-to-windows/
- XDA, I regret switching to Linux… — Index — https://www.XDA-Developers.com/i-regret-switching-to-linux-even-though-i-wanted-to-love-it/
- XDA, 3 things Linux needs…, Jun 25 2025 — Index — https://www.xda-developers.com/3-things-linux-needs-to-have-before-i-can-make-the-swap/
- MakeUseOf, I can't use Linux as my daily driver anymore, Mar 2026 — Index — https://www.makeuseof.com/i-cant-use-linux-as-my-daily-driver-anymore/
- How-To Geek, Why I don't use Linux on my desktop, Apr 2026 — Index — https://www.howtogeek.com/why-i-dont-use-linux-on-my-desktop/
- LTT Daily Driver Challenge Pt.1, 2021-11-09 — Index — https://hacker-tube.org/watch/0506yDSgU7M
- LTT 2026 challenge summaries — Index — https://rosetta.to/u/linustechtips/2026
- Autodesk Forums, Fusion 360 Linux support — Index — https://forums.autodesk.com/t5/fusion-design-validate-document/does-autodesk-fusion-360-support-linux-os/m-p/10769576
- LinuxAudio.dev FAQ — Index — https://www.linuxaudio.dev/frequently-asked-questions
- Linux for Content Creators, 2026 — Index — https://yarygintech.com/articles/linux-for-content-creators-edit-record-publish/
- FOSSLinux, Moving to Linux for Gaming: What Breaks — Index — https://www.fosslinux.com/164288/moving-from-windows-to-linux-gaming.htm
- NICET OnVUE requirements (Linux prohibited) — Index — https://www.nicet.org/exams/remote/
- Queen's Examity (Linux unsupported) — Index — https://www.queensu.ca/registrar/academic-info/exams/remote-proctoring/examity
- LPI, OnVUE Linux Support — Index — https://www.lpi.org/onvue_linux_support/
- Microsoft Intune, Enroll a Linux device — Index — https://LEARN.MICROSOFT.COM/en-us/intune/intune-service/user-help/enroll-device-linux
- Daily.dev summary, Linux HDR / Widevine L3 — Index — https://daily.dev/posts/linux-finally-has-working-hdr-but-you-still-can-t-use-it-for-most-streaming-services-5kvkjhtdt
- UpThrust, I Tried Linux For A Week, 2020 — Index — http://upthrust.co/2020/10/i-tried-linux-and-changed-back-to-windows/amp
