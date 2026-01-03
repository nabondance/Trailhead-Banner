const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

class FontUtils {
  static #fontsLoaded = false;
  static #loadedFonts = new Map(); // Store loaded font mappings

  // Font family mappings constant
  static FONT_MAPPINGS = {
    anta: 'Anta',
    'anta-regular': 'Anta Regular',
    'dela-gothic-one': 'Dela Gothic One',
    spacegrotesk: 'Space Grotesk',
    salesforcesans: 'Salesforce Sans',
    roboto: 'Roboto',
    opensans: 'Open Sans',
    montserrat: 'Montserrat',
    inter: 'Inter',
    poppins: 'Poppins',
    playfair: 'Playfair Display',
    merriweather: 'Merriweather',
    lato: 'Lato',
    nunito: 'Nunito',
    source: 'Source Sans Pro',
    fira: 'Fira Sans',
    ubuntu: 'Ubuntu',
    raleway: 'Raleway',
  };

  static async loadFonts() {
    if (this.#fontsLoaded) {
      return;
    }

    try {
      // Path to public assets fonts directory
      const fontsDir = path.join(process.cwd(), 'public', 'assets', 'fonts');

      // Check if fonts directory exists
      if (!fs.existsSync(fontsDir)) {
        console.warn('Fonts directory not found at:', fontsDir);
        return;
      }

      // Read all files in the fonts directory
      const files = fs.readdirSync(fontsDir);

      // Filter for .ttf files
      const ttfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.ttf');

      if (ttfFiles.length === 0) {
        console.warn('No .ttf font files found in:', fontsDir);
        return;
      }

      // Load each .ttf file
      for (const ttfFile of ttfFiles) {
        try {
          const fontPath = path.join(fontsDir, ttfFile);

          // Extract font family name from filename
          // Example: "SpaceGrotesk-Medium.ttf" -> "Space Grotesk"
          // Example: "SalesforceSans-Regular.ttf" -> "Salesforce Sans"
          const fontFamily = this.#extractFontFamily(ttfFile);

          GlobalFonts.registerFromPath(fontPath, fontFamily);

          // Store the mapping for dynamic access
          const baseName = ttfFile.split(/[-_]/)[0].toLowerCase().replace('.ttf', '');
          this.#loadedFonts.set(baseName, fontFamily);
        } catch (fontError) {
          console.error(`Error loading font ${ttfFile}:`, fontError);
        }
      }

      this.#fontsLoaded = true;
      console.debug(`${ttfFiles.length} Available font families:`, this.getAvailableFontFamilies());
    } catch (error) {
      console.error('Error loading all fonts:', error);
      // Continue execution even if fonts fail to load - will fallback to system fonts
    }
  }

  static #extractFontFamily(filename) {
    // Remove .ttf extension
    const nameWithoutExt = path.parse(filename).name;

    // Extract base name (before first dash or underscore)
    const baseName = nameWithoutExt.split(/[-_]/)[0].toLowerCase();

    // Check if we have a mapping for this font in our constant
    if (this.FONT_MAPPINGS[baseName]) {
      return this.FONT_MAPPINGS[baseName];
    }

    // Fallback: capitalize first letter and add spaces before capital letters
    const fallbackName = nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (c) => c.toUpperCase());

    return fallbackName;
  }

  static getFontFamily(fontName) {
    // Normalize the input font name
    const normalizedName = fontName.toLowerCase().replace(/[-_\s]/g, '');

    // First, check if we have this font loaded dynamically
    if (this.#loadedFonts.has(normalizedName)) {
      return this.#loadedFonts.get(normalizedName);
    }

    // Check our static mappings (for compatibility)
    if (this.FONT_MAPPINGS[normalizedName]) {
      return this.FONT_MAPPINGS[normalizedName];
    }

    // Legacy support for hyphenated names
    const legacyMap = {
      'space-grotesk': 'Space Grotesk',
      'salesforce-sans': 'Salesforce Sans',
    };

    if (legacyMap[fontName]) {
      return legacyMap[fontName];
    }

    // Fallback: return the input name as-is
    return fontName;
  }

  static getFontString(weight, size, family) {
    // Create a font string in the format: "weight size family"
    // Example: "bold 16px Salesforce Sans"
    return `${weight} ${size}px "${family}"`;
  }

  static isLoaded() {
    return this.#fontsLoaded;
  }

  static getLoadedFonts() {
    // Return a copy of the loaded fonts map
    return new Map(this.#loadedFonts);
  }

  static getAvailableFontFamilies() {
    // Return all available font family names
    return Array.from(this.#loadedFonts.values());
  }

  static getFontMappings() {
    // Return the static font mappings constant
    return { ...this.FONT_MAPPINGS };
  }
}

module.exports = FontUtils;
