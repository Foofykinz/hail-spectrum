export const initOneSignal = () => {
  if (typeof window !== 'undefined' && window.OneSignalDeferred) {
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: "YOUR_ONESIGNAL_APP_ID",
        allowLocalhostAsSecureOrigin: true,
      });
    });
  }
};