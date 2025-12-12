import { downloadAllReports } from "./reportDownloader.js";

async function main() {
  const command = process.argv[2] || "download";

  switch (command) {
    case "download":
      await downloadAllReports();
      break;
    default:
      console.log("Usage: npm start [command]");
      console.log("Commands:");
      console.log("  download  - Download all facility reports (default)");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
