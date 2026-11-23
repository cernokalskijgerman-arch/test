import { requireNativeModule } from 'expo-modules-core';

let NothingGlyphNative = null;
try {
  NothingGlyphNative = requireNativeModule('NothingGlyph');
} catch (e) {
  // Graceful fallback for web/Expo Go simulator without native Ketchum binary
}

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

export default NothingGlyph;
