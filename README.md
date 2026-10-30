# Android Build Environment — Full Backup & Restore Kit

Complete backup of the Android app build environment for the Z.ai sandbox
(`/home/z/`). Sandbox reset hole: clone + one command = everything back in
~15–25 minutes.

> বাংলা: এই repo তে পুরো build environment এর ব্যাকআপ আছে — sandbox reset হলে
> `git clone` + `bash setup/restore-all.sh` দিলেই সব ফিরে যাবে।

## ⚠️ Oct 30 incident lessons (READ FIRST)

1. **`/home/z/my-project` SURVIVES sandbox resets** (persistent volume —
   download page + APKs survived the Oct 30 reset). Toolchains (JDK, SDK,
   cloned sources in `/home/z/*`) do NOT survive.
2. **PUSH THIS REPO FIRST** after any rebuild — never sit on unpushed
   backups. The Oct 30 reset wiped the local backup before it was pushed.
3. **Never run `git push` with a token URL from an ambiguous cwd** — the
   Oct 30 accident pushed the wrong repo (my-project scaffold) to GitHub.
   Always `cd` explicitly; build scripts here all do.
4. **TakaTrack v1.0 keystore was lost** in the reset. The v1.0 APK is safe
   (committed here + in my-project/public). From v1.1 a NEW keystore
   (committed here) is used — old installs must be uninstalled before
   updating (signature mismatch).

## What is inside

| Path | What |
|---|---|
| `setup/` | 5 idempotent install/restore scripts + `restore-all.sh` (one command) |
| `scripts/` | Build scripts for all 4 apps (`build-all.sh` builds everything) |
| `configs/smarttube/` | Patched `build.gradle` (Maven mirror fix), `gradle.properties` (4GB cgroup tuning), `local.properties` |
| `projects/kharcha/` | খরচ (Bangla expense tracker) full source — see note below |
| `projects/takatrack/` | TakaTrack full source + NEW keystore (`takatrack.jks`) — see note below |
| `apks/` | All 4 built APKs (smarttube 45MB universal, newpipe 33MB, takatrack 8.9MB v1.0, kharcha 5.8MB) |

### Source status after Oct 30 reset
- **SmartTube / NewPipe**: sources are public GitHub repos — restored by
  `setup/03` at PINNED commits (deterministic). Patches live in `configs/`.
- **Kharcha / TakaTrack**: original source dirs were wiped before the first
  push. They are being **rebuilt from spec** (same package names, versions,
  behavior). Until `projects/kharcha` & `projects/takatrack` appear in this
  repo, the committed APKs are the source of truth for the binaries.
  `setup/03` prints a WARN for missing project dirs — that is expected.

### Rebuilt-from-source (not committed, restored by script with PINNED commits)
| Project | Source | Pinned at | Build |
|---|---|---|---|
| SmartTube v32.68 (TV, ads-free YouTube) | github.com/yuliskov/SmartTube (MIT) | `4b3f333e540a1403429d1a9d86dec758e59288f9` + submodules `MediaServiceCore@40fec84`, `SharedModules@799cfae` | `scripts/build-smarttube.sh` (JDK 17, ~15–25 min) |
| NewPipe v0.29.1 | github.com/TeamNewPipe/NewPipe (GPL-3.0) | `00acf2f318b0af7ffacbd687bba011b642cc01d0` (tag v0.29.1) | `scripts/build-newpipe.sh` (JDK 17, ~10–20 min) |

JDK/Android SDK binaries auto-download via `setup/01` and `setup/02`
(too big for git — script download is the right approach).

## Environment reference (what gets restored)

| Component | Path | Version |
|---|---|---|
| JDK 17 | `/home/z/jdk-17` → `jdk-17.0.21+9` | SmartTube (Gradle 7.5) & NewPipe (Gradle 8) |
| JDK 21 | `/home/z/jdk-21` → `jdk-21.0.13+9` | Kharcha/TakaTrack (Gradle 9.6.1 + AGP 9.2.1) |
| Android SDK | `/home/z/android-sdk` | platforms android-34, android-37.0; build-tools 30.0.3 / 36.0.0 / 37.0.0; platform-tools; cmdline-tools latest |
| SmartTube patches | `configs/smarttube/` | Google Maven mirror FIRST (beats Maven Central 429), `-Xmx2304m`, `workers.max=1`, in-process Kotlin |

## Push guide (token needed?)

**YES — a token is REQUIRED even for a public repo.** Public = everyone can
read/clone; pushing needs write auth.

- **Classic token**: Settings → Developer settings → Personal access tokens →
  Tokens (classic) → scopes ✅ `repo` (+ optional `workflow`), 7-day expiry.
- **Fine-grained token**: create empty repo first, grant Contents: Read+write.
- **One-time push without saving the token in git config:**
  ```bash
  cd /home/z/android-build-env            # ALWAYS cd explicitly (lesson #3)
  git push https://<USER>:<TOKEN>@github.com/<USER>/android-build-env.git main
  ```
- 🔒 Revoke the token after pushing.

## Quick restore (after sandbox reset)

```bash
git clone https://github.com/chiranjitk/android-build-env.git /home/z/android-build-env
bash /home/z/android-build-env/setup/restore-all.sh
```

Full details: **[RESTORE.md](RESTORE.md)**
