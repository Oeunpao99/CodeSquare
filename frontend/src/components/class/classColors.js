export const CLASS_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#F2C811', '#EC4899'];

export function colorPickerValue(color) {
  if (/^#[0-9a-f]{3,4}$/i.test(color)) {
    return ('#' + [...color.slice(1, 4)].map((channel) => channel.repeat(2)).join('')).toUpperCase();
  }
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return color.slice(0, 7).toUpperCase();
  return CLASS_COLORS[0];
}

export function classBannerInk(color) {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return '#FFFFFF';
  const channels = colorPickerValue(color).slice(1).match(/../g).map((channel) => {
    const brightness = parseInt(channel, 16) / 255;
    return brightness <= 0.04045 ? brightness / 12.92 : ((brightness + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}
