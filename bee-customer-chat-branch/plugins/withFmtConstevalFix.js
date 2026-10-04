/**
 * Patches fmt's base.h after pod install so FMT_USE_CONSTEVAL is off.
 * Fixes fmt 11.0.2 + Apple Clang (Xcode 26.4+) consteval errors when compiling fmt from source.
 * @see https://github.com/expo/expo/issues/44229
 */
const { withPodfile } = require("@expo/config-plugins");

const MARKER = "# [expo] fmt FMT_USE_CONSTEVAL fix";

/** @param {string} source @param {number} openParenIdx index of '(' */
function indexAfterMatchingCloseParen(source, openParenIdx) {
  if (source[openParenIdx] !== "(") return -1;
  let depth = 1;
  let i = openParenIdx + 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    i++;
  }
  return depth === 0 ? i : -1;
}

function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }

    const needle = "react_native_post_install(";
    const start = contents.indexOf(needle);
    if (start === -1) {
      console.warn(
        "[withFmtConstevalFix] react_native_post_install( not found in Podfile; skipping fmt fix.",
      );
      return config;
    }

    const openParenIdx = start + needle.length - 1;
    const afterClose = indexAfterMatchingCloseParen(contents, openParenIdx);
    if (afterClose < 0) {
      console.warn("[withFmtConstevalFix] could not parse Podfile; skipping fmt fix.");
      return config;
    }

    const injection = `
    ${MARKER} — https://github.com/expo/expo/issues/44229
    begin
      fmt_pod = installer.sandbox.pod_dir("fmt")
      if fmt_pod
        fmt_base = File.join(fmt_pod, "include", "fmt", "base.h")
        if File.exist?(fmt_base)
          file_content = File.read(fmt_base)
          patched = file_content.gsub(/^\\s*#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1\\s*$/, "# define FMT_USE_CONSTEVAL 0")
          if patched != file_content
            File.chmod(0644, fmt_base)
            File.write(fmt_base, patched)
          end
        end
      end
    end
`;

    config.modResults.contents =
      contents.slice(0, afterClose) + injection + contents.slice(afterClose);
    return config;
  });
}

module.exports = withFmtConstevalFix;
