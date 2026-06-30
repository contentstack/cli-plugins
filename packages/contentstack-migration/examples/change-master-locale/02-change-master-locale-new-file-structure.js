let fs = require('fs').promises;
let { existsSync } = require('fs');
let path = require('path');
let crypto = require('crypto');
let supportedLocales = require('./locales.json');
const { pathValidator, FsUtility, sanitizePath } = require('@contentstack/cli-utilities');

module.exports = async ({ migration, config }) => {
  let changeMasterLocale = {
    title: 'Change master locale for new structure',
    successMessage: 'Changed master locale successfully for the given data',
    failMessage: 'Failed to execute successfully',
    task: async (params) => {
      // Validate required config properties
      if (!config.data_dir) {
        throw new Error('config.data_dir is required but not provided');
      }
      if (!config.target_locale) {
        throw new Error('config.target_locale is required but not provided');
      }
      if (!supportedLocales[config.target_locale]) {
        throw new Error(
          'Please specify a supported language in config.json. For a list of all supported languages, refer to https://www.contentstack.com/docs/developers/multilingual-content/list-of-supported-languages',
        );
      }

      async function tailorData() {
        let locales = await fs.readFile(
          pathValidator(path.resolve(sanitizePath(config.data_dir), 'locales/locales.json')),
          'utf-8',
        );
        let masterLocale = await fs.readFile(
          pathValidator(path.resolve(sanitizePath(config.data_dir), 'locales/master-locale.json')),
          'utf-8',
        );

        if (masterLocale) {
          masterLocale = JSON.parse(masterLocale);
          masterLocale = Object.values(masterLocale);
          masterLocale = masterLocale[0];

          // Validate that we have a valid master locale code
          if (!masterLocale || !masterLocale.code) {
            throw new Error('Unable to determine master locale code from master-locale.json');
          }

          masterLocale = masterLocale.code;
        }
        locales = JSON.parse(locales);
        let id = crypto.randomBytes(8).toString('hex');
        if (
          Object.values(locales)
            .map((locale) => locale.code)
            .includes(config.target_locale)
        ) {
          let targetLocaleUid = Object.keys(locales)
            .filter((uid) => locales[uid].code === config.target_locale)
            .pop();
          delete locales[targetLocaleUid];
        }
        locales[id] = {};
        locales[id].uid = id;
        locales[id].code = masterLocale;
        locales[id].name = supportedLocales[masterLocale];
        locales[id].fallback_locale = config.target_locale;

        await handleEntries(masterLocale);
        await handleTaxonomies(masterLocale);
        await fs.writeFile(
          pathValidator(path.resolve(sanitizePath(config.data_dir), 'locales/locales.json')),
          JSON.stringify(locales),
        );
        masterLocale = await fs.readFile(
          pathValidator(path.resolve(config.data_dir, 'locales/master-locale.json')),
          'utf-8',
        );
        masterLocale = JSON.parse(masterLocale);
        const uid = Object.keys(masterLocale);
        masterLocale[uid].code = config.target_locale;
        masterLocale[uid].name = supportedLocales[config.target_locale];
        await fs.writeFile(
          pathValidator(path.resolve(config.data_dir, 'locales/master-locale.json')),
          JSON.stringify(masterLocale),
        );
      }

      async function handleEntries(masterLocale) {
        let contentTypes = await fs.readdir(pathValidator(path.resolve(sanitizePath(config.data_dir), 'entries')));
        for (let contentType of contentTypes) {
          let sourceMasterLocaleEntries, targetMasterLocaleEntries;

          // Check if index.json exists (if no entries, index.json won't be created)
          const indexFilePath = pathValidator(
            path.resolve(
              sanitizePath(config.data_dir),
              sanitizePath(`entries/${contentType}/${masterLocale}/index.json`),
            ),
          );
          if (!existsSync(indexFilePath)) {
            console.log(`Skipping ${contentType} - no index.json found (likely no entries)`);
            continue;
          }

          sourceMasterLocaleEntries = await fs.readFile(indexFilePath, { encoding: 'utf8' });

          // Parse the index.json to get the entries file name
          const indexData = JSON.parse(sourceMasterLocaleEntries);
          const entriesFileName = Object.values(indexData)[0];

          // Check if we have a valid entries file name
          if (!entriesFileName) {
            console.log(`Skipping ${contentType} - no entries file found in index.json`);
            continue;
          }

          const entriesFilePath = pathValidator(
            path.resolve(
              sanitizePath(config.data_dir),
              `entries/${sanitizePath(contentType)}/${sanitizePath(masterLocale)}/${entriesFileName}`,
            ),
          );

          sourceMasterLocaleEntries = await fs.readFile(entriesFilePath, { encoding: 'utf8' });
          sourceMasterLocaleEntries = JSON.parse(sourceMasterLocaleEntries);
          if (
            existsSync(pathValidator(path.resolve(config.data_dir, `entries/${contentType}/${config.target_locale}`)))
          ) {
            targetMasterLocaleEntries = await fs.readFile(
              pathValidator(path.resolve(config.data_dir, `entries/${contentType}/${config.target_locale}/index.json`)),
              { encoding: 'utf8', flag: 'a+' },
            );
            if (targetMasterLocaleEntries) {
              const targetIndexData = JSON.parse(targetMasterLocaleEntries);
              const targetEntriesFileName = Object.values(targetIndexData)[0];

              if (targetEntriesFileName) {
                targetMasterLocaleEntries = await fs.readFile(
                  pathValidator(
                    path.resolve(
                      config.data_dir,
                      `entries/${contentType}/${config.target_locale}/${targetEntriesFileName}`,
                    ),
                  ),
                  { encoding: 'utf8' },
                );
                targetMasterLocaleEntries = JSON.parse(targetMasterLocaleEntries);
              } else {
                targetMasterLocaleEntries = {};
              }
            } else {
              targetMasterLocaleEntries = {};
            }
          } else {
            targetMasterLocaleEntries = {};
          }

          Object.keys(sourceMasterLocaleEntries).forEach((uid) => {
            if (!targetMasterLocaleEntries[uid]) {
              targetMasterLocaleEntries[uid] = JSON.parse(JSON.stringify(sourceMasterLocaleEntries[uid]));
              targetMasterLocaleEntries[uid]['publish_details'] = [];
              targetMasterLocaleEntries[uid].locale = config.target_locale;
            }
          });

          if (
            existsSync(pathValidator(path.resolve(config.data_dir, `entries/${contentType}/${config.target_locale}`)))
          ) {
            let exsitingTargetMasterLocalEntries = await fs.readFile(
              pathValidator(path.resolve(config.data_dir, `entries/${contentType}/${config.target_locale}/index.json`)),
              { encoding: 'utf8', flag: 'a+' },
            );

            const existingIndexData = JSON.parse(exsitingTargetMasterLocalEntries);
            const existingEntriesFileName = Object.values(existingIndexData)[0];

            if (existingEntriesFileName) {
              await fs.writeFile(
                pathValidator(
                  path.resolve(
                    config.data_dir,
                    `entries/${contentType}/${config.target_locale}/${existingEntriesFileName}`,
                  ),
                ),
                JSON.stringify(targetMasterLocaleEntries),
              );
            }
          } else {
            const entryBasePath = path.join(config.data_dir, `entries`, contentType, config.target_locale);
            let entriesFileHelper = new FsUtility({
              moduleName: 'entries',
              indexFileName: 'index.json',
              basePath: entryBasePath,
              chunkFileSize: 5,
              keepMetadata: false,
            });
            entriesFileHelper.writeIntoFile(targetMasterLocaleEntries, { mapKeyVal: true });
            entriesFileHelper?.completeFile(true);
          }
        }
      }

      async function handleTaxonomies(masterLocale) {
        const taxonomiesDirPath = pathValidator(path.resolve(sanitizePath(config.data_dir), 'taxonomies'));
        const taxonomiesIndexPath = pathValidator(path.resolve(taxonomiesDirPath, 'taxonomies.json'));

        if (!existsSync(taxonomiesIndexPath)) {
          console.log('Skipping taxonomies - no taxonomies.json found');
          return;
        }

        let taxonomiesIndex = await fs.readFile(taxonomiesIndexPath, { encoding: 'utf8' });
        taxonomiesIndex = JSON.parse(taxonomiesIndex);

        const targetLocaleDirPath = pathValidator(path.resolve(taxonomiesDirPath, sanitizePath(config.target_locale)));

        for (const taxonomyUid of Object.keys(taxonomiesIndex)) {
          const fileName = `${sanitizePath(taxonomyUid)}.json`;
          const targetFilePath = pathValidator(path.resolve(targetLocaleDirPath, fileName));

          // Prefer the old master locale's taxonomy data, then the locale recorded at export time,
          // then fall back to any other locale that has it
          const exportedLocale = taxonomiesIndex[taxonomyUid]?.locale;
          let sourceFilePath;
          for (const localeCode of [masterLocale, exportedLocale]) {
            if (!localeCode) {
              continue;
            }
            const candidatePath = pathValidator(path.resolve(taxonomiesDirPath, sanitizePath(localeCode), fileName));
            if (existsSync(candidatePath)) {
              sourceFilePath = candidatePath;
              break;
            }
          }

          if (!sourceFilePath) {
            const localeEntries = await fs.readdir(taxonomiesDirPath, { withFileTypes: true });
            for (const localeEntry of localeEntries) {
              if (!localeEntry.isDirectory() || localeEntry.name === config.target_locale) {
                continue;
              }
              const candidatePath = pathValidator(
                path.resolve(taxonomiesDirPath, sanitizePath(localeEntry.name), fileName),
              );
              if (existsSync(candidatePath)) {
                sourceFilePath = candidatePath;
                break;
              }
            }
          }

          if (!sourceFilePath) {
            console.log(`Skipping taxonomy '${taxonomyUid}' - no source locale data found`);
            continue;
          }

          let sourceTaxonomy = await fs.readFile(sourceFilePath, { encoding: 'utf8' });
          sourceTaxonomy = JSON.parse(sourceTaxonomy);

          if (existsSync(targetFilePath)) {
            let targetTaxonomy = await fs.readFile(targetFilePath, { encoding: 'utf8' });
            targetTaxonomy = JSON.parse(targetTaxonomy);
            targetTaxonomy.terms = targetTaxonomy.terms || [];

            const existingTermUids = new Set(targetTaxonomy.terms.map((term) => term.uid));
            for (const term of sourceTaxonomy.terms || []) {
              if (!existingTermUids.has(term.uid)) {
                targetTaxonomy.terms.push(JSON.parse(JSON.stringify(term)));
              }
            }

            await fs.writeFile(targetFilePath, JSON.stringify(targetTaxonomy));
          } else {
            await fs.mkdir(targetLocaleDirPath, { recursive: true });

            const targetTaxonomy = JSON.parse(JSON.stringify(sourceTaxonomy));
            targetTaxonomy.taxonomy = targetTaxonomy.taxonomy || {};
            targetTaxonomy.taxonomy.locale = config.target_locale;

            await fs.writeFile(targetFilePath, JSON.stringify(targetTaxonomy));
          }
        }
      }

      await tailorData();
    },
  };
  migration.addTask(changeMasterLocale);
};
