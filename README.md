# Raw Photo Processor HDR

An OpenCode V2 plugin for AI-guided processing of five-shot RAW brackets with Adobe Photoshop **Merge to HDR Pro**, Adobe Camera Raw, and Photoshop on Windows.

## Use

Install this folder as `.opencode/plugins/raw-photo-processor-HDR`, restart OpenCode, then run:

```text
/raw-photo-processor-hdr C:\absolute\path\to\raws
```

The command defaults to `openai/gpt-6-luna` and falls back to `openai/gpt-5.6-terra` if Luna is unavailable.

## HDR workflow

The plugin scans one folder non-recursively and reads Exposure Bias metadata. A `0 EV` frame immediately followed by four non-zero-EV frames is treated as one complete bracket set. Other or incomplete sequences are skipped.

For each set, the plugin:

1. Queues all five attachment-safe previews for AI assessment.
2. Runs Photoshop's installed **Merge to HDR Pro** automation with alignment, automatic best-frame deghosting, 32 Bits/Channel output, and **Complete Toning in Adobe Camera Raw**.
3. Applies restrained model-selected Camera Raw settings across Light, Color, Effects, Curve, Color Mixer, Color Grading, and Detail.
4. Applies a conservative Photoshop finishing pass using Brightness/Contrast, Levels, Curves, Exposure, Vibrance, and Hue/Saturation.
5. Flattens the image and converts the 32-bit merge to 16 Bits/Channel with model-selected Photoshop HDR Toning settings for a realistic, vibrant, non-washed-out result.
6. Restores any metadata missing from the merge using the first bracket frame, then applies automatic geometric-distortion, chromatic-aberration, and vignette correction with Photoshop's Lens Correction filter and installed lens profiles.
7. Saves the flattened 16 Bits/Channel result as `<source>\PSDs\<first-frame>_HDR.psd`.
8. Changes the working document to 8 Bits/Channel and saves `<source>\JPEGs\<first-frame>_HDR.jpg` at JPEG quality 12.
9. Queues a maximum-1600-pixel rendering of the finished JPEG for identification, then writes matching metadata to the full-resolution PSD and JPEG.

Existing outputs are skipped unless `overwrite` is enabled. Source RAW files and existing XMP sidecars are not modified.

## Identification and metadata

Metadata follows the baseline `raw-photo-processor` workflow:

- Objective, photo-specific IPTC Description and keywords
- No identification of individual people
- Verified structured City, State/Province, Country, ISO Country Code, and optional >90%-confidence Sublocation
- Optional official IPTC Scene-NewsCodes
- Creator, copyright, XMP Rights, and Usage Terms preservation
- Duplicate Description and complete-keyword-set rejection within a batch

GPS coordinates from the **first frame of each five-shot set** are explicitly copied to both HDR outputs when present. If source GPS is absent, landmark GPS may be inferred only for a visually distinctive landmark identified above 90% confidence and independently verified.

## Configuration

Select another model before restarting the OpenCode service:

```powershell
$env:RAW_PHOTO_PROCESSOR_HDR_MODEL = "openai/gpt-5.6-terra"
opencode service restart
```

Compaction defaults to 65% context pressure or eight completed HDRs. Tune it with `RAW_PHOTO_PROCESSOR_HDR_COMPACT_AT` (0.4–0.9), `RAW_PHOTO_PROCESSOR_HDR_COMPACT_EVERY` (2–50), or equivalent plugin options `compactAt` and `compactEvery`.

## Requirements and notes

- Windows, Adobe Photoshop, and Adobe Camera Raw are required.
- Photoshop's installed `Presets/Scripts/Merge To HDR.jsx` and required HDR plug-ins must be available.
- Supported inputs include ARW, CR2/CR3, DNG, NEF, RAF, ORF, RW2, and other common proprietary RAW formats.
- Photoshop remains visible during COM automation. Do not interact with it while a batch is running.
- Lens Correction requires a matching installed Adobe lens profile. The plugin restores missing camera/lens metadata from the first frame before profile matching.
