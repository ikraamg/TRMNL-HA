/**
 * BMP image encoder for e-ink displays
 * Supports 1-bit (monochrome) and 24-bit (RGB) formats
 * @module bmp
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Supported bits per pixel values for BMP encoding
 * @type {number[]}
 */
const SUPPORTED_BITS_PER_PIXEL = [1, 24];

// =============================================================================
// BMP ENCODER CLASS
// =============================================================================

/**
 * Encodes raw image data into BMP format
 * Optimized for e-ink display output
 * @class
 */
export class BMPEncoder {
  /**
   * @param {number} width - Image width in pixels
   * @param {number} height - Image height in pixels
   * @param {number} bitsPerPixel - Color depth (1 or 24)
   * @throws {Error} If bits per pixel is not supported
   */
  constructor(width, height, bitsPerPixel) {
    if (!SUPPORTED_BITS_PER_PIXEL.includes(bitsPerPixel)) {
      throw new Error(`Unsupported bits per pixel. Supported: ${SUPPORTED_BITS_PER_PIXEL.join(", ")}`);
    }

    this.width = width;
    this.height = height;
    this.bitsPerPixel = bitsPerPixel;

    // Calculate row padding (BMP rows must be 4-byte aligned)
    const rowBytes = this.width * (this.bitsPerPixel / 8);
    const padding = (4 - (rowBytes % 4)) % 4;
    this.padding = padding;
    this.paddedWidthBytes = Math.ceil(rowBytes) + padding;
  }

  /**
   * Encodes raw image data to BMP format
   * @param {Buffer} data - Raw pixel data (RGB for 24-bit, grayscale for 1-bit)
   * @returns {Buffer} Complete BMP file buffer
   */
  encode(data) {
    const header = this.createHeader();
    const pixelData = this.createPixelData(data);
    return Buffer.concat([header, pixelData]);
  }

  /**
   * Creates the BMP file header
   * @returns {Buffer} BMP header (54 bytes for 24-bit, 62 bytes for 1-bit with palette)
   * @private
   *
   * BMP Header Structure:
   * - Bytes 0-1:   Signature "BM"
   * - Bytes 2-5:   File size
   * - Bytes 6-9:   Reserved (0)
   * - Bytes 10-13: Pixel data offset
   * - Bytes 14-17: DIB header size (40)
   * - Bytes 18-21: Image width
   * - Bytes 22-25: Image height
   * - Bytes 26-27: Color planes (1)
   * - Bytes 28-29: Bits per pixel
   * - Bytes 30-33: Compression (0 = none)
   * - Bytes 34-37: Image data size
   * - Bytes 38-45: Resolution (0)
   * - Bytes 46-49: Colors in palette
   * - Bytes 50-53: Important colors
   * - Bytes 54-61: Color palette (1-bit only)
   */
  createHeader() {
    // 1-bit BMP needs color palette (8 extra bytes)
    const headerSize = this.bitsPerPixel === 1 ? 62 : 54;
    const fileSize = headerSize + this.height * this.paddedWidthBytes;
    const header = Buffer.alloc(headerSize);

    // BMP signature
    header.write("BM", 0, 2, "ascii");

    // File header
    header.writeUInt32LE(fileSize, 2);           // File size
    header.writeUInt32LE(0, 6);                  // Reserved
    header.writeUInt32LE(headerSize, 10);        // Pixel data offset

    // DIB header (BITMAPINFOHEADER)
    header.writeUInt32LE(40, 14);                // DIB header size
    header.writeInt32LE(this.width, 18);         // Width
    header.writeInt32LE(this.height, 22);        // Height (positive = bottom-up)
    header.writeUInt16LE(1, 26);                 // Color planes
    header.writeUInt16LE(this.bitsPerPixel, 28); // Bits per pixel
    header.writeUInt32LE(0, 30);                 // Compression (none)

    // Image data size
    const imageSize = this.width * this.height * (this.bitsPerPixel / 8);
    header.writeUInt32LE(imageSize, 34);

    // Resolution and palette info
    header.writeInt32LE(0, 38);                  // X pixels per meter
    header.writeInt32LE(0, 42);                  // Y pixels per meter

    // Palette entries (only for 1-bit)
    const paletteSize = this.bitsPerPixel === 1 ? 2 : 0;
    header.writeUInt32LE(paletteSize, 46);       // Colors in palette
    header.writeUInt32LE(paletteSize, 50);       // Important colors

    // Color palette for 1-bit (black and white)
    if (this.bitsPerPixel === 1) {
      header.writeUInt32LE(0x00000000, 54);      // Index 0: Black (BGR + reserved)
      header.writeUInt32LE(0x00FFFFFF, 58);      // Index 1: White (BGR + reserved)
    }

    return header;
  }

  /**
   * Converts raw pixel data to BMP pixel format
   * BMP stores rows bottom-to-top and uses BGR color order
   * @param {Buffer} imageData - Raw pixel data from Sharp
   * @returns {Buffer} BMP-formatted pixel data
   * @private
   */
  createPixelData(imageData) {
    const pixelData = Buffer.alloc(this.height * this.paddedWidthBytes);
    let offset = 0;

    if (this.bitsPerPixel === 1) {
      // 1-bit monochrome: pack 8 pixels per byte
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const pixel = imageData[y * this.width + x];
          // BMP stores rows bottom-to-top
          const byteIndex = (this.height - 1 - y) * this.paddedWidthBytes + Math.floor(x / 8);
          const bitIndex = x % 8;
          const currentByte = pixelData.readUInt8(byteIndex);

          // Set or clear bit (MSB first within each byte)
          if (pixel === 0xFF) {
            pixelData.writeUInt8(currentByte | (1 << (7 - bitIndex)), byteIndex);
          } else {
            pixelData.writeUInt8(currentByte & ~(1 << (7 - bitIndex)), byteIndex);
          }
        }

        // Add row padding
        offset += Math.ceil(this.width / 8);
        for (let p = 0; p < this.padding; p++) {
          pixelData.writeUInt8(0, offset++);
        }
      }

    } else if (this.bitsPerPixel === 24) {
      // 24-bit RGB: convert to BGR and flip vertically
      for (let y = this.height - 1; y >= 0; y--) {
        for (let x = 0; x < this.width; x++) {
          // Source data is RGB from Sharp (without padding)
          const sourceIndex = (y * this.width + x) * 3;
          const r = imageData[sourceIndex];
          const g = imageData[sourceIndex + 1];
          const b = imageData[sourceIndex + 2];

          // BMP uses BGR order
          pixelData.writeUInt8(b, offset++);
          pixelData.writeUInt8(g, offset++);
          pixelData.writeUInt8(r, offset++);
        }

        // Add row padding
        for (let p = 0; p < this.padding; p++) {
          pixelData.writeUInt8(0, offset++);
        }
      }
    }

    return pixelData;
  }
}
