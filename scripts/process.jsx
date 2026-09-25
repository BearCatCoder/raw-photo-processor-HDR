#target photoshop

(function () {
    function fileExists(value) { return new File(value).exists; }
    function px(value) { return value.as("px"); }
    function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    function number(value, fallback, low, high) {
        value = Number(value);
        if (!isFinite(value)) value = fallback;
        return clamp(value, low, high);
    }
    function integer(value, fallback, low, high) { return Math.round(number(value, fallback, low, high)); }
    function putInt(desc, key, value, fallback, low, high) {
        desc.putInteger(charIDToTypeID(key), integer(value, fallback, low, high));
    }
    function curveList(curve) {
        var list = new ActionList();
        var y1 = integer(64 + Number(curve && curve.shadows || 0), 64, 1, 125);
        var y2 = integer(128 + Number(curve && curve.midtones || 0), 128, y1 + 1, 190);
        var y3 = integer(192 + Number(curve && curve.highlights || 0), 192, y2 + 1, 254);
        var values = [0, 0, 64, y1, 128, y2, 192, y3, 255, 255];
        for (var i = 0; i < values.length; i += 1) list.putInteger(values[i]);
        return list;
    }

    function cameraRawDescriptor(edit) {
        edit = edit || {};
        var desc = new ActionDescriptor();
        desc.putString(charIDToTypeID("CMod"), "Photoshop Filter");
        desc.putEnumerated(charIDToTypeID("Sett"), charIDToTypeID("Sett"), charIDToTypeID("Cst "));

        // Light and Color
        if (edit.temperature !== undefined || edit.tint !== undefined) {
            desc.putEnumerated(charIDToTypeID("WBal"), charIDToTypeID("WBal"), charIDToTypeID("Cst "));
        }
        putInt(desc, "Temp", edit.temperature, 0, -100, 100);
        putInt(desc, "Tint", edit.tint, 0, -100, 100);
        desc.putDouble(charIDToTypeID("Ex12"), number(edit.exposure, 0, -5, 5));
        putInt(desc, "Cr12", edit.contrast, 0, -100, 100);
        putInt(desc, "Hi12", edit.highlights, 0, -100, 100);
        putInt(desc, "Sh12", edit.shadows, 0, -100, 100);
        putInt(desc, "Wh12", edit.whites, 0, -100, 100);
        putInt(desc, "Bk12", edit.blacks, 0, -100, 100);
        putInt(desc, "Vibr", edit.vibrance, 0, -100, 100);
        putInt(desc, "Strt", edit.saturation, 0, -100, 100);

        // Effects and point curve
        putInt(desc, "Cl12", edit.clarity, 0, -100, 100);
        putInt(desc, "Dhze", edit.dehaze, 0, -100, 100);
        desc.putInteger(stringIDToTypeID("Texture"), integer(edit.texture, 0, -100, 100));
        desc.putList(charIDToTypeID("Crv "), curveList(edit.curve));

        // Color Mixer (HSL)
        var mixer = edit.mixer || {};
        var channels = [
            ["red", "R"], ["orange", "O"], ["yellow", "Y"], ["green", "G"],
            ["aqua", "A"], ["blue", "B"], ["purple", "P"], ["magenta", "M"]
        ];
        for (var channel = 0; channel < channels.length; channel += 1) {
            var name = channels[channel][0];
            var code = channels[channel][1];
            putInt(desc, "HA_" + code, mixer[name + "Hue"], 0, -100, 100);
            putInt(desc, "SA_" + code, mixer[name + "Saturation"], 0, -100, 100);
            putInt(desc, "LA_" + code, mixer[name + "Luminance"], 0, -100, 100);
        }

        // Color Grading. Current ACR uses the long IDs; the legacy split-toning
        // IDs are also supplied so compatible older ACR releases preserve the look.
        var grade = edit.colorGrading || {};
        var shadowHue = integer(grade.shadowHue, 0, 0, 360);
        var shadowSat = integer(grade.shadowSaturation, 0, 0, 100);
        var midtoneHue = integer(grade.midtoneHue, 0, 0, 360);
        var midtoneSat = integer(grade.midtoneSaturation, 0, 0, 100);
        var highlightHue = integer(grade.highlightHue, 0, 0, 360);
        var highlightSat = integer(grade.highlightSaturation, 0, 0, 100);
        var balance = integer(grade.balance, 0, -100, 100);
        desc.putInteger(stringIDToTypeID("ColorGradeShadowHue"), shadowHue);
        desc.putInteger(stringIDToTypeID("ColorGradeShadowSat"), shadowSat);
        desc.putInteger(stringIDToTypeID("ColorGradeMidtoneHue"), midtoneHue);
        desc.putInteger(stringIDToTypeID("ColorGradeMidtoneSat"), midtoneSat);
        desc.putInteger(stringIDToTypeID("ColorGradeHighlightHue"), highlightHue);
        desc.putInteger(stringIDToTypeID("ColorGradeHighlightSat"), highlightSat);
        desc.putInteger(stringIDToTypeID("ColorGradeBlending"), integer(grade.blending, 50, 0, 100));
        desc.putInteger(stringIDToTypeID("ColorGradeBalance"), balance);
        putInt(desc, "STSH", shadowHue, 0, 0, 360);
        putInt(desc, "STSS", shadowSat, 0, 0, 100);
        putInt(desc, "STHH", highlightHue, 0, 0, 360);
        putInt(desc, "STHS", highlightSat, 0, 0, 100);
        putInt(desc, "STB ", balance, 0, -100, 100);

        // Detail
        var detail = edit.detail || {};
        putInt(desc, "Shrp", detail.sharpening, 0, 0, 150);
        desc.putDouble(charIDToTypeID("ShpR"), number(detail.radius, 1, 0.5, 3));
        putInt(desc, "ShpD", detail.detail, 25, 0, 100);
        putInt(desc, "ShpM", detail.masking, 0, 0, 100);
        putInt(desc, "LNR ", detail.luminanceNoiseReduction, 0, 0, 100);
        putInt(desc, "CNR ", detail.colorNoiseReduction, 25, 0, 100);
        return desc;
    }

    function applyPhotoshopFinish(doc, finish) {
        if (!finish) return;
        if (doc.activeLayer.kind === LayerKind.SMARTOBJECT) {
            doc.activeLayer.rasterize(RasterizeType.ENTIRELAYER);
        }
        var brightness = integer(finish.brightness, 0, -50, 50);
        var contrast = integer(finish.contrast, 0, -50, 50);
        if (brightness || contrast) doc.activeLayer.adjustBrightnessContrast(brightness, contrast);

        var levelsBlack = integer(finish.levelsBlack, 0, 0, 40);
        var levelsWhite = integer(finish.levelsWhite, 255, 215, 255);
        var levelsGamma = number(finish.levelsGamma, 1, 0.5, 1.5);
        if (levelsBlack || levelsWhite !== 255 || Math.abs(levelsGamma - 1) > 0.001) {
            doc.activeLayer.adjustLevels(levelsBlack, levelsWhite, levelsGamma, 0, 255);
        }

        var curve = {
            shadows: number(finish.curveShadows, 0, -30, 30),
            midtones: number(finish.curveMidtones, 0, -30, 30),
            highlights: number(finish.curveHighlights, 0, -30, 30)
        };
        if (curve.shadows || curve.midtones || curve.highlights) {
            var y1 = integer(64 + curve.shadows, 64, 1, 125);
            var y2 = integer(128 + curve.midtones, 128, y1 + 1, 190);
            var y3 = integer(192 + curve.highlights, 192, y2 + 1, 254);
            doc.activeLayer.adjustCurves([[0, 0], [64, y1], [128, y2], [192, y3], [255, 255]]);
        }

        var exposure = number(finish.exposure, 0, -2, 2);
        if (Math.abs(exposure) > 0.001) {
            var exposureSettings = new ActionDescriptor();
            exposureSettings.putDouble(charIDToTypeID("Exps"), exposure);
            exposureSettings.putDouble(charIDToTypeID("Ofst"), 0);
            exposureSettings.putDouble(charIDToTypeID("Gmm "), 1);
            executeAction(charIDToTypeID("Exps"), exposureSettings, DialogModes.NO);
        }

        var vibrance = integer(finish.vibrance, 0, -50, 50);
        if (vibrance) {
            var vibranceSettings = new ActionDescriptor();
            vibranceSettings.putInteger(stringIDToTypeID("vibrance"), vibrance);
            vibranceSettings.putInteger(stringIDToTypeID("saturation"), 0);
            executeAction(stringIDToTypeID("vibrance"), vibranceSettings, DialogModes.NO);
        }
        var hue = integer(finish.hue, 0, -20, 20);
        var saturation = integer(finish.saturation, 0, -30, 30);
        var lightness = integer(finish.lightness, 0, -20, 20);
        if (hue || saturation || lightness) doc.activeLayer.adjustHueSaturation(hue, saturation, lightness);
    }

    function cropDocument(doc) {
        var sourceWidth = px(doc.width);
        var sourceHeight = px(doc.height);
        var angle = Number(RPP_CONFIG.straightenDegrees) || 0;
        if (Math.abs(angle) > 0.001) doc.rotateCanvas(angle);
        var width = px(doc.width);
        var height = px(doc.height);
        var orientation = RPP_CONFIG.orientation;
        if (orientation === "auto") orientation = width >= height ? "landscape" : "portrait";
        var ratio = orientation === "portrait" ? 2 / 3 : 3 / 2;
        var radians = Math.abs(angle) * Math.PI / 180;
        var cosine = Math.cos(radians);
        var sine = Math.sin(radians);
        var maxCropHeight = Math.min(sourceWidth / (ratio * cosine + sine), sourceHeight / (ratio * sine + cosine));
        if (!isFinite(maxCropHeight) || maxCropHeight <= 0) maxCropHeight = Math.min(height, width / ratio);
        maxCropHeight = Math.min(maxCropHeight, height, width / ratio);
        var cropHeight = maxCropHeight * number(RPP_CONFIG.cropScale, 0.96, 0.5, 1);
        var cropWidth = cropHeight * ratio;
        if (orientation === "portrait") {
            cropWidth = Math.max(2, Math.floor(cropWidth / 2) * 2);
            cropHeight = cropWidth * 3 / 2;
        } else {
            cropHeight = Math.max(2, Math.floor(cropHeight / 2) * 2);
            cropWidth = cropHeight * 3 / 2;
        }
        var centerX = number(RPP_CONFIG.cropCenterX, 0.5, 0, 1) * width;
        var centerY = number(RPP_CONFIG.cropCenterY, 0.5, 0, 1) * height;
        centerX = clamp(centerX, cropWidth / 2, width - cropWidth / 2);
        centerY = clamp(centerY, cropHeight / 2, height - cropHeight / 2);
        var left = clamp(Math.round(centerX - cropWidth / 2), 0, width - cropWidth);
        var top = clamp(Math.round(centerY - cropHeight / 2), 0, height - cropHeight);
        doc.crop([UnitValue(left, "px"), UnitValue(top, "px"), UnitValue(left + cropWidth, "px"), UnitValue(top + cropHeight, "px")]);
    }

    if (!RPP_CONFIG.inputs || RPP_CONFIG.inputs.length !== 5) throw new Error("Merge to HDR Pro requires exactly five input files.");
    if (!RPP_CONFIG.overwrite && (fileExists(RPP_CONFIG.psd) || fileExists(RPP_CONFIG.jpeg))) {
        throw new Error("An HDR output file already exists and overwrite is disabled.");
    }

    var originalDialogs = app.displayDialogs;
    var originalUnits = app.preferences.rulerUnits;
    var doc = null;
    try {
        app.displayDialogs = DialogModes.NO;
        app.preferences.rulerUnits = Units.PIXELS;

        // Use Adobe's installed Merge To HDR Pro automation. Setting 32-bit plus
        // ACR toning is the scripted equivalent of "Complete Toning in Adobe Camera Raw".
        $.global.runMergeToHDRFromScript = true;
        var scriptsPath = app.path + "/" + localize("$$$/ScriptingSupport/InstalledScripts=Presets/Scripts");
        var mergeScript = new File(scriptsPath + "/Merge To HDR.jsx");
        if (!mergeScript.exists) throw new Error("Photoshop's installed Merge To HDR.jsx script was not found.");
        $.evalFile(mergeScript);
        mergeToHDR.outputBitDepth = 32;
        mergeToHDR.useAlignment = true;
        mergeToHDR.useACRToning = true;
        mergeToHDR.invokeACRFilter = function () {
            return executeAction(stringIDToTypeID("Adobe Camera Raw Filter"), cameraRawDescriptor(RPP_CONFIG.cameraRaw), DialogModes.NO);
        };
        var files = [];
        for (var inputIndex = 0; inputIndex < RPP_CONFIG.inputs.length; inputIndex += 1) files.push(new File(RPP_CONFIG.inputs[inputIndex]));
        mergeToHDR.mergeFilesToHDR(files, true, -2);

        doc = app.activeDocument;
        if (!doc) throw new Error("Merge to HDR Pro did not create an output document.");
        if (doc.mode !== DocumentMode.RGB) doc.changeMode(ChangeMode.RGB);
        if (doc.bitsPerChannel !== BitsPerChannelType.THIRTYTWO) doc.bitsPerChannel = BitsPerChannelType.THIRTYTWO;
        cropDocument(doc);
        applyPhotoshopFinish(doc, RPP_CONFIG.photoshopFinish);

        // Preserve the completed HDR master as a 32 Bits/Channel PSD.
        if (doc.bitsPerChannel !== BitsPerChannelType.THIRTYTWO) throw new Error("The HDR document is not 32 Bits/Channel before PSD save.");
        var psdOptions = new PhotoshopSaveOptions();
        psdOptions.layers = true;
        psdOptions.embedColorProfile = true;
        doc.saveAs(new File(RPP_CONFIG.psd), psdOptions, true, Extension.LOWERCASE);

        doc.flatten();
        if (doc.bitsPerChannel !== BitsPerChannelType.EIGHT) doc.bitsPerChannel = BitsPerChannelType.EIGHT;
        var jpegOptions = new JPEGSaveOptions();
        jpegOptions.quality = 12;
        jpegOptions.embedColorProfile = true;
        jpegOptions.formatOptions = FormatOptions.STANDARDBASELINE;
        doc.saveAs(new File(RPP_CONFIG.jpeg), jpegOptions, true, Extension.LOWERCASE);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = app.open(new File(RPP_CONFIG.jpeg));
        var previewWidth = px(doc.width);
        var previewHeight = px(doc.height);
        var previewLongest = Math.max(previewWidth, previewHeight);
        if (previewLongest > 1600) {
            var previewFactor = 1600 / previewLongest;
            doc.resizeImage(UnitValue(Math.round(previewWidth * previewFactor), "px"), UnitValue(Math.round(previewHeight * previewFactor), "px"), null, ResampleMethod.BICUBICSHARPER);
        }
        var previewOptions = new JPEGSaveOptions();
        previewOptions.quality = 10;
        previewOptions.embedColorProfile = true;
        previewOptions.formatOptions = FormatOptions.STANDARDBASELINE;
        doc.saveAs(new File(RPP_CONFIG.identificationPreview), previewOptions, true, Extension.LOWERCASE);
    } finally {
        if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);
        app.displayDialogs = originalDialogs;
        app.preferences.rulerUnits = originalUnits;
    }
}());
