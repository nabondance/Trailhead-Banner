const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register the custom fonts
const fontPathRobotoBold = path.join(process.cwd(), 'public/assets/fonts', 'Roboto-Bold.ttf');
GlobalFonts.registerFromPath(fontPathRobotoBold, 'Roboto-Bold');

const fontPathAnta = path.join(process.cwd(), 'public/assets/fonts', 'Anta.woff2');
GlobalFonts.registerFromPath(fontPathAnta, 'Anta');
