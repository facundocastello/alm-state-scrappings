/**
 * Arizona CareCheck API Client
 * Interfaces with AZDHS Salesforce Aura API
 */
import got from "got";
import type {
  FacilityDetails,
  Inspection,
  InspectionDetails,
  Attachment,
  FacilityMetadata,
  AuraResponse,
} from "./types.js";

const BASE_URL = "https://azcarecheck.azdhs.gov/s/sfsites/aura";

const AURA_CONTEXT = {
  mode: "PROD",
  fwuid: "MXg4UmtXaFlzZ0JoYTJBejdMZEtWdzFLcUUxeUY3ZVB6dE9hR0VheDVpb2cxMy4zMzU1NDQzMi41MDMzMTY0OA",
  app: "siteforce:communityApp",
  loaded: {
    "APPLICATION@markup://siteforce:communityApp": "1414_JnVqyfJtnxwn08WU8yKzPg",
  },
  dn: [],
  globals: {},
  uad: true,
};

const HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  Origin: "https://azcarecheck.azdhs.gov",
  Referer: "https://azcarecheck.azdhs.gov/s/facility-details",
};

export class AZCareCheckAPI {
  private actionCounter = 0;

  private getNextActionId(): string {
    return `${++this.actionCounter};a`;
  }

  private async callAura<T>(
    classname: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const message = {
      actions: [
        {
          id: this.getNextActionId(),
          descriptor: "aura://ApexActionController/ACTION$execute",
          callingDescriptor: "UNKNOWN",
          params: {
            namespace: "",
            classname,
            method,
            params,
            cacheable: false,
            isContinuation: false,
          },
        },
      ],
    };

    const form = new URLSearchParams();
    form.append("message", JSON.stringify(message));
    form.append("aura.context", JSON.stringify(AURA_CONTEXT));
    form.append("aura.pageURI", "/s/facility-details");
    form.append("aura.token", "null");

    const response = await got.post(`${BASE_URL}?r=1&aura.ApexAction.execute=1`, {
      headers: HEADERS,
      body: form.toString(),
      timeout: { request: 30000 },
      retry: { limit: 3 },
    });

    const data = JSON.parse(response.body) as AuraResponse<T>;

    if (data.actions[0].state !== "SUCCESS") {
      throw new Error(
        `API error: ${JSON.stringify(data.actions[0].error)}`
      );
    }

    return data.actions[0].returnValue.returnValue;
  }

  /**
   * Get facility metadata (available tabs)
   */
  async getMetadata(facilityId: string): Promise<FacilityMetadata> {
    return this.callAura<FacilityMetadata>(
      "AZCCFacilityHeaderController",
      "getCustomMetadataInfo",
      { accountId: facilityId, licenseId: null }
    );
  }

  /**
   * Get full facility details
   */
  async getFacilityDetails(facilityId: string): Promise<FacilityDetails> {
    return this.callAura<FacilityDetails>(
      "AZCCFacilityDetailsTabController",
      "getFacilityDetails",
      { facilityId }
    );
  }

  /**
   * Get list of inspections for a facility
   */
  async getInspections(facilityId: string): Promise<Inspection[]> {
    const result = await this.callAura<Inspection[] | null>(
      "AZCCInspectionHistoryController",
      "getFacilityOrLicenseInspections",
      { facilityId, licenseId: null }
    );
    return result || [];
  }

  /**
   * Get detailed inspection info including deficiencies
   */
  async getInspectionDetails(
    facilityId: string,
    inspectionId: string
  ): Promise<InspectionDetails> {
    return this.callAura<InspectionDetails>(
      "AZCCInspectionHistoryController",
      "getInspectionAndFacilityDetailsForPrintView",
      { facilityId, inspectionId, licenseId: null }
    );
  }

  /**
   * Get attachments for an inspection
   */
  async getAttachments(recordId: string): Promise<Attachment[]> {
    const result = await this.callAura<Attachment[] | null>(
      "AttachFilesModalController",
      "getFilesFromRecordPublicSite",
      { recordId, titlePrefix: "" }
    );
    return result || [];
  }

  /**
   * Download a file attachment
   */
  async downloadAttachment(url: string): Promise<Buffer> {
    const response = await got.get(url, {
      headers: {
        "User-Agent": HEADERS["User-Agent"],
      },
      timeout: { request: 60000 },
      retry: { limit: 3 },
      responseType: "buffer",
    });
    return response.body;
  }
}

export const api = new AZCareCheckAPI();
