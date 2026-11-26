const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNothingGlyph(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. Add Nothing OS Permissions
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    const permissions = [
      'com.nothing.ketchum.permission.ENABLE',
      'com.nothing.glyph.permission.GLYPH',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ];
    for (const perm of permissions) {
      if (!androidManifest['uses-permission'].some((p) => p.$?.['android:name'] === perm)) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // 2. Add queries for Nothing OS Glyph Service IPC binding
    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }
    const hasQuery = androidManifest.queries.some((q) =>
      q.package?.some((p) => p.$?.['android:name'] === 'com.nothing.thirdparty')
    );
    if (!hasQuery) {
      androidManifest.queries.push({
        package: [{ $: { 'android:name': 'com.nothing.thirdparty' } }],
        intent: [{ action: [{ $: { 'android:name': 'com.nothing.thirdparty.bind_glyphservice' } }] }],
      });
    }

    // 3. Add NothingKey and targetNothingSDKVersion meta-data
    const app = androidManifest.application[0];
    if (!app['meta-data']) {
      app['meta-data'] = [];
    }
    const metadata = [
      { name: 'NothingKey', value: 'test' },
      { name: 'targetNothingSDKVersion', value: '140101' },
    ];
    for (const meta of metadata) {
      const existing = app['meta-data'].find((m) => m.$?.['android:name'] === meta.name);
      if (existing) {
        existing.$['android:value'] = meta.value;
      } else {
        app['meta-data'].push({
          $: {
            'android:name': meta.name,
            'android:value': meta.value,
          },
        });
      }
    }

    return config;
  });
};
