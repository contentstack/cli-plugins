const nock = require("nock");
const qs = require("querystring");
const {
  getContentType,
  getEntries,
  getExpectedOutput,
  getGlobalField,
  getEntriesOnlyUID,
  getEntry,
} = require("./utils");
const omitDeep = require("omit-deep-lodash");
const { isEqual, cloneDeep } = require("lodash");

function setupNockMocks(testApiUrl = "https://api.contentstack.io", token) {
  // Clear all previous mocks
  nock.cleanAll();

  // Mock content type fetch
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/content_types\/[a-zA-Z0-9_]+$/)
    .query((query) => query.include_global_field_schema === "true")
    .reply((uri) => {
      const match = uri.match(/\/v3\/content_types\/([a-zA-Z0-9_]+)/);
      return getContentType(match[1]);
    });

  // Mock entries list (only UIDs)
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/content_types\/[a-zA-Z0-9_]+\/entries/)
    .query((query) => {
      return query.include_count === "true" && query["only[Base][]"] === "uid";
    })
    .reply(200, (uri) => {
      const match = uri.match(/\/v3\/content_types\/([a-zA-Z0-9_]+)\/entries/);
      return getEntriesOnlyUID(match[1]);
    });

  // Mock entries fetch with all fields
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/content_types\/[a-zA-Z0-9_]+\/entries/)
    .query(() => true) // Match any query
    .reply(200, function (uri) {
      let query = this.req.options.search || "";
      query = query.substring(1);
      let locale = "en-us";
      const parsedQuery = qs.parse(query);
      if (parsedQuery.locale) {
        locale = parsedQuery.locale;
      }
      const match = uri.match(/\/v3\/content_types\/([a-zA-Z0-9_]+)\/entries/);
      return getEntries(match[1], locale);
    });

  // Mock get entry locales
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/content_types\/[a-zA-Z0-9_]+\/entries\/[a-zA-Z0-9_]+\/locale/)
    .query(() => true)
    .reply(200, () => {
      return {
        locales: [
          { code: "en-in", localized: true },
          { code: "en-us" },
        ],
      };
    });

  // Mock single entry fetch
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/content_types\/[a-zA-Z0-9_]+\/entries\/[a-zA-Z0-9_]+$/)
    .query(() => true)
    .reply(200, (uri) => {
      const match = uri.match(/\/v3\/content_types\/([a-zA-Z0-9_]+)\/entries\/([a-zA-Z0-9_]+)/);
      const query = qs.parse(uri.split("?")[1] || "");
      const locale = query.locale || "en-us";
      return getEntry(match[1], match[2], locale);
    });

  // Mock entry update
  nock(testApiUrl)
    .persist()
    .put(/\/v3\/content_types\/[a-zA-Z0-9_]+\/entries\/[a-zA-Z0-9_]+/)
    .query(() => true)
    .reply((uri, body) => {
      const match = uri.match(/\/v3\/content_types\/([a-zA-Z0-9_]+)\/entries\/([a-zA-Z0-9_]+)/);
      const query = qs.parse(uri.split("?")[1] || "");
      const locale = query.locale || "en-us";
      
      const responseModified = cloneDeep(omitDeep(body, ["uid"]));
      const expectedResponse = cloneDeep(omitDeep(getExpectedOutput(match[1], match[2], locale), ["uid"]));
      
      if (isEqual(responseModified, expectedResponse)) {
        return [200, { notice: "Entry updated successfully.", entry: {} }];
      }
      return [400, { notice: "Update Failed.", error_message: "Entry update failed.", entry: {} }];
    });

  // Mock global field fetch
  nock(testApiUrl)
    .persist()
    .get(/\/v3\/global_fields\/[a-zA-Z0-9_]+$/)
    .query((query) => query.include_content_types === "true")
    .reply((uri) => {
      const match = uri.match(/\/v3\/global_fields\/([a-zA-Z0-9_]+)/);
      return getGlobalField(match[1]);
    });
}

module.exports = { setupNockMocks };

