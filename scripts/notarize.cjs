const path = require('node:path');
const { notarize } = require('@electron/notarize');

module.exports = async function notarizeMacApp(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const credentials = {
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER,
  };
  const supplied = Object.values(credentials).filter(Boolean).length;
  if (supplied === 0) {
    console.log('未提供 Apple API Key，跳过本地公证。');
    return;
  }
  if (supplied !== 3) {
    throw new Error('Apple 公证凭证不完整，需要 APPLE_API_KEY、APPLE_API_KEY_ID、APPLE_API_ISSUER');
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  await notarize({ appPath, ...credentials });
};
