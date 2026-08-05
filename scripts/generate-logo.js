import fs from "fs";
const b64 = fs.readFileSync("public/icone-cbmam.png").toString("base64");
const content = `export const CBMAM_LOGO_BASE64 = "data:image/png;base64,${b64}";\n`;
fs.writeFileSync("src/lib/cbmam-logo.ts", content);
console.log("✅ Base64 CBMAM logo generated, length:", b64.length);
