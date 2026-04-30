import { cliux } from '@contentstack/cli-utilities';

export const askAPIKey = async (): Promise<string> => {
  return await cliux.inquire<string>({
    type: 'input',
    message: 'Enter the stack api key',
    name: 'apiKey',
  });
};
