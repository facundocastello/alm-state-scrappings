import { parse } from "csv-parse/sync";
import { createObjectCsvWriter } from "csv-writer";
import { readFileSync } from "fs";

interface StateFacility {
  facility_id: string;
  facility_name: string;
  license_number: string;
  license_level: string;
  capacity: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
  services: string;
  contact_person: string;
  latitude: string;
  longitude: string;
  profile_url: string;
}

interface CMSFacility {
  "CMS Certification Number (CCN)": string;
  "Provider Name": string;
  "Provider Address": string;
  "City/Town": string;
  State: string;
  "ZIP Code": string;
  "Telephone Number": string;
  "County/Parish": string;
  "Ownership Type": string;
  "Number of Certified Beds": string;
  "Overall Rating": string;
  "Health Inspection Rating": string;
  "QM Rating": string;
  "Staffing Rating": string;
  "Rating Cycle 1 Standard Survey Health Date": string;
  "Rating Cycle 1 Total Number of Health Deficiencies": string;
  "Rating Cycle 2 Standard Health Survey Date": string;
  "Rating Cycle 2/3 Total Number of Health Deficiencies": string;
  "Number of Fines": string;
  "Total Amount of Fines in Dollars": string;
  "Total Number of Penalties": string;
  "Number of Substantiated Complaints": string;
  "Special Focus Status": string;
  Latitude: string;
  Longitude: string;
}

// Normalize strings for matching
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

// Normalize phone for matching
const normalizePhone = (p: string): string => p.replace(/\D/g, "");

const main = async () => {
  // Read state facilities
  const stateData = readFileSync("output/facilities.csv", "utf8");
  const stateFacilities: StateFacility[] = parse(stateData, {
    columns: true,
    skip_empty_lines: true,
  });

  // Read CMS facilities
  const cmsData = readFileSync("output/cms_nursing_homes.csv", "utf8");
  const cmsFacilities: CMSFacility[] = parse(cmsData, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`State facilities: ${stateFacilities.length}`);
  console.log(`CMS facilities: ${cmsFacilities.length}`);

  // Create lookup maps for CMS data
  const cmsByPhone = new Map<string, CMSFacility>();
  const cmsByNormName = new Map<string, CMSFacility>();
  const cmsByZipName = new Map<string, CMSFacility>();

  for (const cms of cmsFacilities) {
    const phone = normalizePhone(cms["Telephone Number"] || "");
    if (phone.length >= 10) {
      cmsByPhone.set(phone.slice(-10), cms);
    }

    const normName = normalize(cms["Provider Name"] || "");
    cmsByNormName.set(normName, cms);

    const zip = (cms["ZIP Code"] || "").slice(0, 5);
    const zipNameKey = zip + "_" + normName.slice(0, 10);
    cmsByZipName.set(zipNameKey, cms);
  }

  // Merge data
  const merged: Record<string, string>[] = [];
  const matchedCmsIds = new Set<string>();
  let matchCount = 0;

  for (const state of stateFacilities) {
    const record: Record<string, string> = {
      // State data
      source: "state",
      facility_id: state.facility_id,
      facility_name: state.facility_name,
      license_number: state.license_number,
      license_level: state.license_level,
      capacity: state.capacity,
      address: state.address,
      city: state.city,
      state: state.state,
      zip: state.zip,
      phone: state.phone,
      fax: state.fax,
      services: state.services,
      contact_person: state.contact_person,
      latitude: state.latitude,
      longitude: state.longitude,
      profile_url: state.profile_url,
      // CMS data (empty by default)
      cms_ccn: "",
      cms_provider_name: "",
      cms_beds: "",
      cms_ownership: "",
      cms_county: "",
      cms_overall_rating: "",
      cms_health_inspection_rating: "",
      cms_qm_rating: "",
      cms_staffing_rating: "",
      cms_last_inspection_date: "",
      cms_deficiencies: "",
      cms_fines: "",
      cms_fine_amount: "",
      cms_penalties: "",
      cms_complaints: "",
      cms_special_focus: "",
    };

    // Try to match by phone
    const phone = normalizePhone(state.phone || "");
    let cms: CMSFacility | undefined;

    if (phone.length >= 10) {
      cms = cmsByPhone.get(phone.slice(-10));
    }

    // Try to match by normalized name if no phone match
    if (!cms) {
      const normName = normalize(state.facility_name || "");
      cms = cmsByNormName.get(normName);
    }

    // Try to match by zip + partial name
    if (!cms) {
      const zip = (state.zip || "").slice(0, 5);
      const normName = normalize(state.facility_name || "");
      const zipNameKey = zip + "_" + normName.slice(0, 10);
      cms = cmsByZipName.get(zipNameKey);
    }

    if (cms) {
      matchCount++;
      matchedCmsIds.add(cms["CMS Certification Number (CCN)"]);
      record.cms_ccn = cms["CMS Certification Number (CCN)"];
      record.cms_provider_name = cms["Provider Name"];
      record.cms_beds = cms["Number of Certified Beds"];
      record.cms_ownership = cms["Ownership Type"];
      record.cms_county = cms["County/Parish"];
      record.cms_overall_rating = cms["Overall Rating"];
      record.cms_health_inspection_rating = cms["Health Inspection Rating"];
      record.cms_qm_rating = cms["QM Rating"];
      record.cms_staffing_rating = cms["Staffing Rating"];
      record.cms_last_inspection_date = cms["Rating Cycle 1 Standard Survey Health Date"];
      record.cms_deficiencies = cms["Rating Cycle 1 Total Number of Health Deficiencies"];
      record.cms_fines = cms["Number of Fines"];
      record.cms_fine_amount = cms["Total Amount of Fines in Dollars"];
      record.cms_penalties = cms["Total Number of Penalties"];
      record.cms_complaints = cms["Number of Substantiated Complaints"];
      record.cms_special_focus = cms["Special Focus Status"];
      // Use CMS lat/long if state doesn't have it
      if (!record.latitude && cms.Latitude) {
        record.latitude = cms.Latitude;
      }
      if (!record.longitude && cms.Longitude) {
        record.longitude = cms.Longitude;
      }
    }

    merged.push(record);
  }

  // Add unmatched CMS facilities
  for (const cms of cmsFacilities) {
    if (!matchedCmsIds.has(cms["CMS Certification Number (CCN)"])) {
      merged.push({
        source: "cms",
        facility_id: "",
        facility_name: cms["Provider Name"],
        license_number: "",
        license_level: "",
        capacity: "",
        address: cms["Provider Address"],
        city: cms["City/Town"],
        state: cms.State,
        zip: cms["ZIP Code"],
        phone: cms["Telephone Number"],
        fax: "",
        services: "",
        contact_person: "",
        latitude: cms.Latitude,
        longitude: cms.Longitude,
        profile_url: "",
        cms_ccn: cms["CMS Certification Number (CCN)"],
        cms_provider_name: cms["Provider Name"],
        cms_beds: cms["Number of Certified Beds"],
        cms_ownership: cms["Ownership Type"],
        cms_county: cms["County/Parish"],
        cms_overall_rating: cms["Overall Rating"],
        cms_health_inspection_rating: cms["Health Inspection Rating"],
        cms_qm_rating: cms["QM Rating"],
        cms_staffing_rating: cms["Staffing Rating"],
        cms_last_inspection_date: cms["Rating Cycle 1 Standard Survey Health Date"],
        cms_deficiencies: cms["Rating Cycle 1 Total Number of Health Deficiencies"],
        cms_fines: cms["Number of Fines"],
        cms_fine_amount: cms["Total Amount of Fines in Dollars"],
        cms_penalties: cms["Total Number of Penalties"],
        cms_complaints: cms["Number of Substantiated Complaints"],
        cms_special_focus: cms["Special Focus Status"],
      });
    }
  }

  console.log(`Matched: ${matchCount} facilities`);
  console.log(`Total merged: ${merged.length} facilities`);

  // Write merged CSV
  const csvWriter = createObjectCsvWriter({
    path: "output/facilities_merged.csv",
    header: [
      { id: "source", title: "source" },
      { id: "facility_id", title: "facility_id" },
      { id: "facility_name", title: "facility_name" },
      { id: "license_number", title: "license_number" },
      { id: "license_level", title: "license_level" },
      { id: "capacity", title: "capacity" },
      { id: "address", title: "address" },
      { id: "city", title: "city" },
      { id: "state", title: "state" },
      { id: "zip", title: "zip" },
      { id: "phone", title: "phone" },
      { id: "fax", title: "fax" },
      { id: "services", title: "services" },
      { id: "contact_person", title: "contact_person" },
      { id: "latitude", title: "latitude" },
      { id: "longitude", title: "longitude" },
      { id: "profile_url", title: "profile_url" },
      { id: "cms_ccn", title: "cms_ccn" },
      { id: "cms_provider_name", title: "cms_provider_name" },
      { id: "cms_beds", title: "cms_beds" },
      { id: "cms_ownership", title: "cms_ownership" },
      { id: "cms_county", title: "cms_county" },
      { id: "cms_overall_rating", title: "cms_overall_rating" },
      { id: "cms_health_inspection_rating", title: "cms_health_inspection_rating" },
      { id: "cms_qm_rating", title: "cms_qm_rating" },
      { id: "cms_staffing_rating", title: "cms_staffing_rating" },
      { id: "cms_last_inspection_date", title: "cms_last_inspection_date" },
      { id: "cms_deficiencies", title: "cms_deficiencies" },
      { id: "cms_fines", title: "cms_fines" },
      { id: "cms_fine_amount", title: "cms_fine_amount" },
      { id: "cms_penalties", title: "cms_penalties" },
      { id: "cms_complaints", title: "cms_complaints" },
      { id: "cms_special_focus", title: "cms_special_focus" },
    ],
  });

  await csvWriter.writeRecords(merged);
  console.log("Wrote output/facilities_merged.csv");
};

main().catch(console.error);
