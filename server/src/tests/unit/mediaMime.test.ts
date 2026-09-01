import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMimeTypeFromSignature,
  isAllowedUploadMimeType,
  normalizeUploadMimeType,
} from "../../lib/mediaMime.js";

test("detectMimeTypeFromSignature should detect common allowed file signatures", () => {
  assert.equal(detectMimeTypeFromSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectMimeTypeFromSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png"
  );
  assert.equal(detectMimeTypeFromSignature(Buffer.from("GIF89a", "ascii")), "image/gif");
  assert.equal(detectMimeTypeFromSignature(Buffer.from("%PDF-1.7", "ascii")), "application/pdf");
  assert.equal(
    detectMimeTypeFromSignature(Buffer.from("RIFF0000WEBPVP8 ", "ascii")),
    "image/webp"
  );
  assert.equal(
    detectMimeTypeFromSignature(Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])),
    "video/mp4"
  );
  assert.equal(
    detectMimeTypeFromSignature(Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20])),
    "video/quicktime"
  );
  assert.equal(
    detectMimeTypeFromSignature(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42])),
    "video/webm"
  );
});

test("detectMimeTypeFromSignature should return null for unknown signatures", () => {
  assert.equal(detectMimeTypeFromSignature(Buffer.from("plain text", "utf8")), null);
});

test("normalizeUploadMimeType should normalize aliases and allowed checks", () => {
  assert.equal(normalizeUploadMimeType(" IMAGE/JPG "), "image/jpeg");
  assert.equal(isAllowedUploadMimeType("image/jpg"), true);
  assert.equal(isAllowedUploadMimeType("application/octet-stream"), false);
});
