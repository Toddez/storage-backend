import crypto from "crypto";
import base32Decode from "base32-decode";

export function generateHOTP(secret, counter) {
  const decodedSecret = base32Decode(secret, "RFC4648");

  const buffer = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    buffer[7 - i] = counter & 0xff;
    counter = counter >> 8;
  }

  const hmac = crypto.createHmac("sha1", Buffer.from(decodedSecret));
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return `${code % 10 ** 6}`.padStart(6, "0");
}

export function generateTOTP(secret, window = 0) {
  const counter = Math.floor(Date.now() / 30000);
  return generateHOTP(secret, counter + window);
}

export function verifyTOTP(token, secret, window = 1) {
  for (let errorWindow = -window; errorWindow <= +window; errorWindow++) {
    const totp = generateTOTP(secret, errorWindow);
    if (token === totp) {
      return true;
    }
  }
  return false;
}
