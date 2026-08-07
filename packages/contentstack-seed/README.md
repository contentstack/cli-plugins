## Description
The “seed” command in Contentstack CLI allows users to import content to your stack, from Github repositories. It's an effective command that can help you to migrate content to your stack with minimal steps.

To import content to your stack, you can use either of the following:

**Curated official stacks**: When you run the seed command without a full `owner/repo` on `--repo`, the CLI offers a fixed list of official Contentstack seed repositories on GitHub (no GitHub search API).

**Any GitHub repository**: You can also import content from another GitHub repository by passing `--repo` in `owner/repository` form (organization, user, or enterprise account).

<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-seed
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-seed/2.0.0 darwin-arm64 node-v22.21.1
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
## Commands
<!-- commands -->
* [`csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y] [--alias <value>]`](#csdx-cmstacksseed---repo-value---org-value---stack-api-key-value---stack-name-value--y---alias-value)

## `csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y] [--alias <value>]`

Create a stack from existing content types, entries, assets, etc

```
USAGE
  $ csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y]
    [--alias <value>]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Provide stack API key to seed content to
  -n, --stack-name=<value>     Name of a new stack that needs to be created.
  -y, --yes                    [Optional] Skip the stack confirmation.
      --org=<value>            Provide Organization UID to create a new stack
      --repo=<value>           GitHub organization name or GitHub user name/repository name.

DESCRIPTION
  Create a stack from existing content types, entries, assets, etc

EXAMPLES
  $ csdx cm:stacks:seed

  $ csdx cm:stacks:seed --repo "account"

  $ csdx cm:stacks:seed --repo "account/repository"

  $ csdx cm:stacks:seed --repo "account/repository" --stack-api-key "stack-api-key" //seed content into specific stack

  $ csdx cm:stacks:seed --repo "account/repository" --org "your-org-uid" --stack-name "stack-name" //create a new stack in given org uid
```

_See code: [src/commands/cm/stacks/seed.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-seed/src/commands/cm/stacks/seed.ts)_
<!-- commandsstop -->

## Advanced Flags
The following flags allow you to host and import Stacks from your own GitHub repository.
The account name can be a personal user account, organization account, or enterprise account.

```
  $ csdx cm:stacks:seed -r "account/repository"
```

**Step 1.** Export a Stack

Identify a Stack that you would like to export.
This stack might be used in conjunction with a sample web site or mobile app you have created.

Now, run `csdx cm:stacks:export` against it. The following documentation explains the [Export Plugin](https://www.contentstack.com/docs/headless-cms/export-content-using-the-cli).

In most cases, running `csdx cm:stacks:export -A` or `csdx cm:stacks:export -a "management token"` should work for you.

The `csdx cm:stacks:seed` plugin uses the same libraries as `csdx cm:stacks:import`.

**Step 2.** GitHub

Once the Stack is exported:

* Create a GitHub repository.
    * By convention, your repository name should be prefixed with `stack-`. For example: `stack-your-starter-app`.
      Doing so will allow the stack names to be found by the interactive prompt when running `csdx cm:stacks:seed -r "account"`.
      This step is optional. You can fully qualify the repository name if required: `csdx cm:stacks:seed -r "account/repo`.
* Create a folder named `stack` within the newly created GitHub repository
* Take the content from **Step 1** and commit it to the `stack` folder
* Create a [Release](https://docs.github.com/en/free-pro-team@latest/github/administering-a-repository/managing-releases-in-a-repository)

The latest release will be downloaded and extracted, when a user attempts to install a Stack using:

```
$ csdx cm:stacks:seed -r "account"
$ csdx cm:stacks:seed -r "account/repository"
```

## Documentation
To get more detailed documentation of this command, visit the Seed command documentation on our [docs](https://www.contentstack.com/docs/headless-cms/import-content-using-the-seed-command).
