import { cliux, validatePath } from '@contentstack/cli-utilities';
import * as path from 'path';

export const askPassword = async () => {
  return cliux.inquire<string>({
    message: 'CLI_AUTH_LOGIN_ENTER_PASSWORD',
    name: 'password',
    transformer: (pswd: string) => {
      let pswdMasked = '';
      for (let i = 0; i < pswd.length; i++) {
        pswdMasked += '*';
      }
      return pswdMasked;
    },
    type: 'input',
  });
};

export const askOTPChannel = async (): Promise<string> => {
  return cliux.inquire<string>({
    choices: [
      { name: 'Authy App', value: 'authy' },
      { name: 'SMS', value: 'sms' },
    ],
    message: 'CLI_AUTH_LOGIN_ASK_CHANNEL_FOR_OTP',
    name: 'otpChannel',
    type: 'list',
  });
};

export const askOTP = async (): Promise<string> => {
  return cliux.inquire({
    message: 'CLI_AUTH_LOGIN_ENTER_SECURITY_CODE',
    name: 'tfaToken',
    type: 'input',
  });
};

export const askUsername = async (): Promise<string> => {
  return cliux.inquire<string>({
    message: 'CLI_AUTH_LOGIN_ENTER_EMAIL_ADDRESS',
    name: 'username',
    type: 'input',
  });
};

export const askExportDir = async (): Promise<string> => {
  let result = await cliux.inquire<string>({
    message: 'Enter the path for storing the content: (current folder)',
    name: 'dir',
    type: 'input',
    validate: validatePath,
  });
  if (!result) {
    return process.cwd();
  } else {
    result = result.replace(/['"]/g, '');
    return path.resolve(result);
  }
};

export const askAPIKey = async (): Promise<string> => {
  return await cliux.inquire<string>({
    message: 'Enter the stack api key',
    name: 'apiKey',
    type: 'input',
  });
};
