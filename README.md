# Contentstack CLI


Contentstack is a headless CMS with an API-first approach that puts content at the centre. It is designed to simplify the process of publication by separating code from content.

CLI supports content management scripts through which you can perform the following tasks:

- Bulk publish content
- Export content
- Import content
- Clone Stack
- Seed Stack from GitHub
- Perform Launch operations
- Migrate content
- Migrate HTML RTE to JSON RTE content
- Change Master Locale
- Use Bootstrap plugin
- Manage Developer Hub apps (`app:*` via `@contentstack/apps-cli`)
- Use Tsgen plugin


## Installing CLI
### Prerequisites
Contentstack account
Node.js version 16 or above

### Installation
To install CLI on your system, run the below command in your terminal:

```
npm install -g @contentstack/cli
```

To verify the installation, run `csdx` in the command window.

## Usage
After the successful installation of CLI, use the `--help` parameter to display the help section of the CLI. You can even combine this parameter with a specific command to get the help section of that command.

```shell
$ csdx --help
```

## Namespaces
**auth**: To perform [authentication-related](/packages/contentstack-auth) activities

**cm**: To perform content management activities such as [bulk publish](/packages/contentstack-bulk-publish), [import](/packages/contentstack-import), and [export](/packages/contentstack-export), [export-to-csv] (/packages/contentstack-export-to-csv), [seed] (/packages/contentstack-seed)

**help**: To list the helpful commands in CLI

**config**: To set regions and customize them

## Documentation

To get a more detailed documentation for every command, visit the [CLI section](https://www.contentstack.com/docs/developers/cli) in our docs.

## Useful Plugins

- [Generate TypeScript typings from a Stack](https://github.com/Contentstack-Solutions/contentstack-cli-tsgen)
- [Manage Content Types (list, details, audit, compare, diagram)](https://github.com/contentstack/cli-plugins/tree/main/packages/contentstack-content-type) (`contentstack-cli-content-type`)
- [Validate regex fields in Content Types and Global Fields](https://github.com/contentstack/cli-plugins/tree/main/packages/contentstack-cli-cm-regex-validate) (`@contentstack/cli-cm-regex-validate`)
- [Generate TypeScript typings from a Stack](https://github.com/contentstack/cli-plugins/tree/v1-dev/packages/contentstack-cli-tsgen) (`contentstack-cli-tsgen`)
