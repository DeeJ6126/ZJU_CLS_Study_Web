import { cc98VerificationCodes } from '../src/data/config/cc98VerificationCodes.js';

export function getSeedVerificationCodes() {
  return cc98VerificationCodes.map((item) => ({
    code: item.code,
    cc98Name: item.cc98Nickname,
  }));
}
