# RESTORE.md — Fresh Sandbox থেকে Full Environment Restore

Sandbox reset হলে এই guide follow করো। Total time: **~15–25 min**
(বেশিরভাগ সময় download এ: SDK ~500MB + JDK ~400MB + sources)।

> **Oct 30 lesson:** reset হলে `/home/z/my-project` (download page + APKs)
> বেঁচে থাকে — persistent volume। শুধু toolchain (JDK/SDK/cloned sources)
> restore করতে হয়। আর **প্রথমেই এই repo push করে ফেলো** — unpushed backup
> reset এ হারায়!

---

## Step 0 — Clone this repo (~1 min)

```bash
git clone https://github.com/chiranjitk/android-build-env.git /home/z/android-build-env
```

## Step 1 — ONE COMMAND restore (recommended)

```bash
bash /home/z/android-build-env/setup/restore-all.sh
```

এক command এ: JDK 17+21 → Android SDK → SmartTube/NewPipe/Kharcha/TakaTrack
→ APK placement → verify।

- Overwrite: `FORCE=1 bash setup/restore-all.sh`
- my-project বাঁচে থাকলে ধরে রাখতে: `SKIP=1 bash setup/restore-all.sh`

## Step 2 — Dev server (background)

```bash
cd /home/z/my-project
(bun run dev > /dev/null 2>&1 &)
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000   # expect: 200
```

## Step 3 — Verify checklist (`setup/05-verify.sh` এমনিতেই চালায়)

- [ ] `jdk-17` / `jdk-21` symlink কাজ করছে
- [ ] SDK: platforms (android-34, android-37.0) + build-tools (30.0.3, 37.0.0) + adb
- [ ] SmartTube: gradlew executable, 2 submodule, build.gradle এ mirror patch
- [ ] `my-project/public/` এ 4টা APK
- [ ] Browser preview তে download page (4 cards + TV guide)

---

## App build commands (JDK mapping খুব important!)

| App | Command | JAVA_HOME | Notes |
|---|---|---|---|
| **SmartTube v32.68** | `bash scripts/build-smarttube.sh` | `/home/z/jdk-17` | Gradle 7.5 — JDK 21 দিলে FAIL! ~15–25 min. Largest output APK = universal |
| **NewPipe v0.29.1** | `bash scripts/build-newpipe.sh` | `/home/z/jdk-17` | ~10–20 min |
| **Kharcha** | `bash scripts/build-kharcha.sh` | `/home/z/jdk-21` | Gradle 9.6.1 + AGP 9.2.1, fast |
| **TakaTrack** | `bash scripts/build-takatrack.sh` | `/home/z/jdk-21` | release-signed (`takatrack.jks` repo তে) |
| **সব একসাথে** | `bash scripts/build-all.sh` | auto per-app | order: newpipe → kharcha → takatrack → smarttube |

> ⚠️ **TakaTrack signing:** v1.0 keystore Oct 30 reset এ হারায়। এখন থেকে
> v1.1+ এই repo র NEW keystore ব্যবহার করে — পুরনো installed v1.0 এর উপর
> update install হবে না (uninstall লাগবে)।

প্রতিটা build script built APK `/home/z/my-project/public/` এ copy করে দেয়।

---

## Manual step-by-step (restore-all.sh না চালাতে চাইলে)

```bash
cd /home/z/android-build-env
bash setup/01-install-jdks.sh          # JDK 17 + 21 (~2 min)
bash setup/02-install-android-sdk.sh   # SDK (~5-10 min)
bash setup/03-restore-projects.sh      # sources (~3-5 min)
SKIP=1 bash setup/04-restore-myproject.sh   # APK placement only (my-project বাঁচে থাকলে)
bash setup/05-verify.sh                # checklist
cd /home/z/my-project && (bun run dev > /dev/null 2>&1 &)
```

---

## Troubleshooting (আগের সেশনের শেখা লেসন)

1. **Maven Central `429 Too Many Requests`** — `configs/smarttube/build.gradle`
   এ Google mirror (`https://maven-central.storage-download.googleapis.com/maven2`)
   প্রথমে আছে। `setup/03` ওটা overwrite করে দেয়।

2. **4GB memory cgroup** — `gradle.properties` এ টিউনিং আছে:
   `-Xmx2304m -XX:MaxMetaspaceSize=384m -XX:+UseSerialGC`, `workers.max=1`,
   Kotlin in-process। বাড়াবেন না।

3. **Background process মরে যায় tool call শেষে** — লম্বা build foreground chunks এ:
   `timeout -s INT 555 ./gradlew assembleStstableDebug` (tool timeout 590s)।
   Gradle incremental — interrupt হলেও আবার চালালে সেখান থেকেই শুরু হয়।
   Progress: `grep -c "^> Task" log-file`।

4. **`gradlew: Permission denied`** — `chmod +x gradlew` (scripts এমনিতেই করে)।

5. **AGP 9 needs KGP at runtime** — Kharcha র `build.gradle.kts` এ
   `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10")` workaround।

6. **`platforms;android-37.0`** — AGP 9 এর জন্য এই naming ই (SDK script এ ঠিক আছে)।

7. **Disk space** — `rm -rf /home/z/*/*/build` (APK আগে public/ এ কপি হয়)।

8. **GitHub API rate limit** — unauthenticated call ঘণ্টায় 60টা। Token দিয়ে:
   `curl -s -H "Authorization: token <TOKEN>" https://api.github.com/...` (5000/hr)।

9. **Push accident prevention** — token URL push সবসময় explicit `cd` এর পরে,
   আর push এর পর `git remote -v` দিয়ে দেখে নিও ঠিক repo তে গেছে।

---

## Version pins (reference)

| Thing | Value |
|---|---|
| SmartTube commit | `4b3f333e540a1403429d1a9d86dec758e59288f9` (master), v32.68 stable |
| SmartTube submodules | MediaServiceCore `40fec843eb24bc264e9c8b429fcee25068e230e2`, SharedModules `799cfae8a2f5c609b99e87fc673fc62de1c0199a` |
| NewPipe | tag `v0.29.1`, commit `00acf2f318b0af7ffacbd687bba011b642cc01d0` |
| Kharcha | `com.kharcha.app`, minSdk 26 / target 35, SQLite, NO permissions |
| TakaTrack | v1.0 APK (old keystore, LOST) + v1.1+ NEW keystore `takatrack.jks` (alias `takatrack`) |
| SmartTube APK | `org.smarttube.stable` 32.68, universal 45MB |
| Gradle | SmartTube/NewPipe: wrapper (7.5 / 8.x); Kharcha/TakaTrack: wrapper 9.6.1 |
| cmdlinetools zip | `commandlinetools-linux-11076708_latest.zip` |
| JDK | Temurin 17.0.21+9, 21.0.13+9 (pinned URL + API fallback) |
