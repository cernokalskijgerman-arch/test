import { requireNativeModule } from 'expo-modules-core';

let NothingGlyphNative = null;
try {
  NothingGlyphNative = requireNativeModule('NothingGlyph');
} catch (e) {
  // Graceful fallback for web/Expo Go simulator without native Ketchum binary
}

const createEmptyAudioMetrics = () => ({
  active: false,
  hasPermission: false,
  source: 'none',
  mixActive: false,
  signalDetected: false,
  bass: 0,
  mid: 0,
  treble: 0,
  rms: 0,
  flux: 0,
  peakDb: -96,
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
});

export const NothingGlyph = {
  initHardware: () => {
    try {
      return NothingGlyphNative?.initHardware?.() ?? false;
    } catch (e) {
      return false;
    }
  },
  isConnected: () => {
    try {
      return NothingGlyphNative?.isConnected?.() ?? false;
    } catch (e) {
      return false;
    }
  },
  getDeviceModel: () => {
    try {
      return NothingGlyphNative?.getDeviceModel?.() ?? null;
    } catch (e) {
      return null;
    }
  },
  getHardwareStatus: () => {
    try {
      return NothingGlyphNative?.getHardwareStatus?.() ?? null;
    } catch (e) {
      return null;
    }
  },
  getBatteryInfo: () => {
    try {
      return NothingGlyphNative?.getBatteryInfo?.() ?? null;
    } catch (e) {
      return null;
    }
  },
  hasAudioPermission: () => {
    try {
      return Boolean(NothingGlyphNative?.hasAudioPermission?.());
    } catch (e) {
      return false;
    }
  },
  requestAudioPermission: async () => {
    try {
      if (NothingGlyphNative?.requestAudioPermission) {
        return await NothingGlyphNative.requestAudioPermission();
      }
      return { granted: false, status: 'unavailable', canAskAgain: false };
    } catch (e) {
      return { granted: false, status: 'denied', canAskAgain: false };
    }
  },
  startAudioCapture: (sourceMode = 'auto') => {
    try {
      const mode = typeof sourceMode === 'string' && sourceMode.length > 0 ? sourceMode : 'auto';
      return (
        NothingGlyphNative?.startAudioCapture?.(mode) ?? {
          started: false,
          activeSource: 'none',
          hasPermission: false,
          mixSupported: false,
          error: 'Native audio module unavailable',
        }
      );
    } catch (e) {
      return {
        started: false,
        activeSource: 'none',
        hasPermission: false,
        mixSupported: false,
        error: e?.message || 'startAudioCapture failed',
      };
    }
  },
  stopAudioCapture: () => {
    try {
      NothingGlyphNative?.stopAudioCapture?.();
    } catch (e) {}
  },
  getAudioMetrics: () => {
    try {
      return NothingGlyphNative?.getAudioMetrics?.() ?? createEmptyAudioMetrics();
    } catch (e) {
      return createEmptyAudioMetrics();
    }
  },
  turnOff: () => {
    try {
      NothingGlyphNative?.turnOff?.();
    } catch (e) {}
  },
  setBrightness: (brightness) => {
    try {
      NothingGlyphNative?.setBrightness?.(Math.round(brightness));
    } catch (e) {}
  },
  setChannel: (channel, brightness) => {
    try {
      NothingGlyphNative?.setChannel?.(Math.round(channel), Math.round(brightness));
    } catch (e) {}
  },
  setChannels: (channels) => {
    try {
      NothingGlyphNative?.setChannels?.(channels.map((c) => Math.round(c)));
    } catch (e) {}
  },
  setArcBrightness: (arcIndex, brightness) => {
    try {
      NothingGlyphNative?.setArcBrightness?.(arcIndex, Math.round(brightness));
    } catch (e) {}
  },
  setArcsBrightness: (arc0, arc1, arc2) => {
    try {
      NothingGlyphNative?.setArcsBrightness?.(
        Math.round(arc0),
        Math.round(arc1),
        Math.round(arc2)
      );
    } catch (e) {}
  },
  setVirtualPixel: (pixelIndex, brightness = 255) => {
    try {
      NothingGlyphNative?.setVirtualPixel?.(Math.round(pixelIndex), Math.round(brightness));
    } catch (e) {}
  },
  setVirtualPixels: (pixels, brightness = 255) => {
    try {
      NothingGlyphNative?.setVirtualPixels?.(pixels.map((p) => Math.round(p)), Math.round(brightness));
    } catch (e) {}
  },
  setPixelLevels: (levels) => {
    try {
      NothingGlyphNative?.setPixelLevels?.(levels.map((l) => Number(l)));
    } catch (e) {}
  },
};

export const {
  initHardware,
  isConnected,
  getDeviceModel,
  getHardwareStatus,
  getBatteryInfo,
  hasAudioPermission,
  requestAudioPermission,
  startAudioCapture,
  stopAudioCapture,
  getAudioMetrics,
  turnOff,
  setBrightness,
  setChannel,
  setChannels,
  setArcBrightness,
  setArcsBrightness,
  setVirtualPixel,
  setVirtualPixels,
  setPixelLevels,
} = NothingGlyph;

export default NothingGlyph;
