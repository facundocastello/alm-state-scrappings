import path from "path";

export const config = {
  baseUrl: "https://gensearch.ky.gov",
  urls: {
    imageUpload: (itemId: string) =>
      `https://gensearch.ky.gov/ImageUpload.aspx?TK=342&Item=${itemId}&Child=0&GrdChd=0`,
    tkImage: (imageId: string) =>
      `https://gensearch.ky.gov/TKImage.aspx?IM=${imageId}`,
  },
  paths: {
    input: path.join(process.cwd(), "input"),
    output: path.join(process.cwd(), "output"),
    reports: path.join(process.cwd(), "reports"),
    data: path.join(process.cwd(), "data"),
    reportsListHtml: path.join(process.cwd(), "input", "reportslist.html"),
    facilityItemsJson: path.join(process.cwd(), "data", "facility-items.json"),
    reportsFinished: path.join(process.cwd(), "data", "reports-finished.csv"),
  },
  concurrency: {
    facilities: parseInt(process.env.KY_FACILITY_CONCURRENCY || "3", 10),
    reports: parseInt(process.env.KY_REPORT_CONCURRENCY || "5", 10),
  },
  userAgent:
    process.env.KY_USER_AGENT ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  skipCompleted: process.env.KY_SKIP_COMPLETED !== "false",
};
