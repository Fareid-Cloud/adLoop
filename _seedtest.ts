import { seedDemoData } from "./lib/demoSeed";
(async () => {
  try {
    await seedDemoData("cms9nw7af0001slfixuf06rfj", "ar");
    console.log("SEED OK");
  } catch (e: any) {
    console.log("SEED FAILED:", e?.message?.slice(0, 900));
  }
  process.exit(0);
})();
