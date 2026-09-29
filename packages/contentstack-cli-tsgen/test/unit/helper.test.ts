// Mock cli-utilities' logger before importing the module under test, so
// printFormattedError writes to spies instead of the real logger.
jest.mock("@contentstack/cli-utilities", () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  // Real lookup - the region-name-to-endpoint mapping is what these tests check.
  resolveCanonicalEndpoints: jest.requireActual(
    "@contentstack/cli-utilities/lib/region-endpoints",
  ).resolveCanonicalEndpoints,
}));

import { log } from "@contentstack/cli-utilities";
import {
  sanitizePath,
  printFormattedError,
  resolveGraphqlHost,
} from "../../src/lib/helper";

const errorMock = log.error as jest.Mock;
const warnMock = log.warn as jest.Mock;
const infoMock = log.info as jest.Mock;

describe("helper", () => {
  describe("sanitizePath", () => {
    it("leaves a normal relative path unchanged", () => {
      expect(sanitizePath("contentstack/generated.d.ts")).toBe(
        "contentstack/generated.d.ts",
      );
    });

    it("normalizes 2+ leading slashes to './'", () => {
      expect(sanitizePath("//etc/passwd")).toBe("./etc/passwd");
      expect(sanitizePath("///a/b")).toBe("./a/b");
    });

    it("collapses runs of slashes into a single '/'", () => {
      expect(sanitizePath("foo//bar///baz")).toBe("foo/bar/baz");
    });

    it("converts backslashes to forward slashes", () => {
      expect(sanitizePath("path\\to\\file")).toBe("path/to/file");
    });

    it("strips directory-traversal segments ('../' and '..\\')", () => {
      expect(sanitizePath("foo/../bar")).toBe("foo/bar");
      expect(sanitizePath("foo\\..\\bar")).toBe("foo/bar");
    });

    it("strips repeated leading traversal segments", () => {
      expect(sanitizePath("../../etc/passwd")).toBe("etc/passwd");
    });

    it("neutralizes a mixed traversal + multi-slash payload", () => {
      // leading '//' -> './', slashes collapsed, '../' removed
      expect(sanitizePath("//..//..//secret")).toBe("./secret");
    });

    it("returns undefined for a nullish input (optional-chaining guard)", () => {
      expect(sanitizePath(undefined as any)).toBeUndefined();
      expect(sanitizePath(null as any)).toBeUndefined();
    });
  });

  describe("printFormattedError", () => {
    beforeEach(() => {
      errorMock.mockClear();
      warnMock.mockClear();
      infoMock.mockClear();
    });

    it("prints the raw message and returns early for numeric-identifier validation errors", () => {
      printFormattedError(
        {
          error_code: "VALIDATION_ERROR",
          error_message:
            "Content type uids contain numeric identifiers which are invalid.",
        },
        "tsgen",
      );

      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(errorMock).toHaveBeenCalledWith(
        "Content type uids contain numeric identifiers which are invalid.",
      );
      // early return -> no hint / context / timestamp
      expect(warnMock).not.toHaveBeenCalled();
      expect(infoMock).not.toHaveBeenCalled();
    });

    it("maps AUTHENTICATION_FAILED to its message, hint, and context", () => {
      printFormattedError({ error_code: "AUTHENTICATION_FAILED" }, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Authentication failed. Check your credentials and try again.",
      );
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Please check your API key, token, and region.",
      );
      expect(infoMock).toHaveBeenCalledWith("Error context: tsgen");
    });

    it("maps INVALID_CREDENTIALS to the credential-verification hint", () => {
      printFormattedError({ error_code: "INVALID_CREDENTIALS" }, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Invalid credentials. Please verify and re-enter your login details.",
      );
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Please verify your API key, token, and region.",
      );
    });

    it.each([
      "INVALID_INTERFACE_NAME",
      "INVALID_CONTENT_TYPE_UID",
      "INVALID_GLOBAL_FIELD_REFERENCE",
    ])("maps %s to the TS-syntax-error message and prefix hint", (code) => {
      printFormattedError({ error_code: code }, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Generated types contain a TypeScript syntax error.",
      );
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Use a prefix to ensure all interface names are valid TypeScript identifiers.",
      );
    });

    it("uses the raw error_message as the hint for a generic VALIDATION_ERROR", () => {
      printFormattedError(
        { error_code: "VALIDATION_ERROR", error_message: "schema is invalid" },
        "tsgen",
      );

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Type generation failed due to a validation error.",
      );
      expect(warnMock).toHaveBeenCalledWith("Tip: schema is invalid");
    });

    it("uses the raw error_message as the hint for TYPE_GENERATION_FAILED", () => {
      printFormattedError(
        { error_code: "TYPE_GENERATION_FAILED", error_message: "disk full" },
        "tsgen",
      );

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Type generation failed due to a system error. Try again.",
      );
      expect(warnMock).toHaveBeenCalledWith("Tip: disk full");
    });

    it("falls back to the default validation hint when a VALIDATION_ERROR has no message", () => {
      printFormattedError({ error_code: "VALIDATION_ERROR" }, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Type generation failed due to a validation error.",
      );
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Type generation failed due to a validation error.",
      );
    });

    it("falls back to the default system hint when TYPE_GENERATION_FAILED has no message", () => {
      printFormattedError({ error_code: "TYPE_GENERATION_FAILED" }, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: Type generation failed due to a system error. Try again.",
      );
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Unexpected error during type generation. Try again.",
      );
    });

    it("falls back to error_message for an unknown error_code", () => {
      printFormattedError(
        { error_code: "SOMETHING_ELSE", error_message: "boom" },
        "graphql",
      );

      expect(errorMock).toHaveBeenCalledWith("Type generation failed: boom");
      expect(warnMock).toHaveBeenCalledWith(
        "Tip: Check the error details and try again.",
      );
      expect(infoMock).toHaveBeenCalledWith("Error context: graphql");
    });

    it("falls back to the default message when no code or message is present", () => {
      printFormattedError({}, "tsgen");

      expect(errorMock).toHaveBeenCalledWith(
        "Type generation failed: An unexpected error occurred. Try again.",
      );
    });

    it("logs the provided timestamp verbatim when present", () => {
      printFormattedError(
        {
          error_code: "AUTHENTICATION_FAILED",
          timestamp: "2020-01-01T00:00:00.000Z",
        },
        "tsgen",
      );

      expect(infoMock).toHaveBeenCalledWith(
        "Timestamp: 2020-01-01T00:00:00.000Z",
      );
    });

    it("generates an ISO timestamp when none is provided", () => {
      printFormattedError({ error_code: "AUTHENTICATION_FAILED" }, "tsgen");

      const timestampCall = infoMock.mock.calls.find((c) =>
        String(c[0]).startsWith("Timestamp: "),
      );
      expect(timestampCall).toBeDefined();
      const value = String(timestampCall![0]).replace("Timestamp: ", "");
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

describe("resolveGraphqlHost", () => {
  // The regression: region names are stored as "AWS-NA"/"AZURE-EU"/..., so a
  // lookup keyed on "US"/"AZURE_NA" misses and the CDA host gets used instead,
  // which answers a GraphQL query with a 403.
  it.each([
    ["AWS-NA", "graphql.contentstack.com"],
    ["AWS-EU", "eu-graphql.contentstack.com"],
    ["AWS-AU", "au-graphql.contentstack.com"],
    ["AZURE-NA", "azure-na-graphql.contentstack.com"],
    ["AZURE-EU", "azure-eu-graphql.contentstack.com"],
    ["GCP-NA", "gcp-na-graphql.contentstack.com"],
    ["GCP-EU", "gcp-eu-graphql.contentstack.com"],
  ])("resolves %s by name to %s", (name, expected) => {
    expect(resolveGraphqlHost({ name })).toBe(expected);
  });

  it.each(["AWS-NA", "AWS-EU", "AZURE-EU", "GCP-NA"])(
    "never returns a CDA host for %s",
    (name) => {
      const host = resolveGraphqlHost({ name });

      expect(host).toContain("graphql");
      expect(host).not.toContain("cdn.");
    },
  );

  it("prefers the endpoints already on the region object", () => {
    expect(
      resolveGraphqlHost({
        name: "AWS-NA",
        endpoints: { graphqlDelivery: "https://custom-graphql.example.com/" },
      }),
    ).toBe("custom-graphql.example.com");
  });

  it("returns undefined for a custom region with no GraphQL endpoint", () => {
    expect(resolveGraphqlHost({ name: "my-pilot-region" })).toBeUndefined();
  });
});
